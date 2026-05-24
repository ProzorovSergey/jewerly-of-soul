<?php
/* =====================================================================
 *  auth.php — регистрация, вход, профиль
 * ===================================================================== */

/** Подобрать свободный username на основе почты. */
function derive_username($pdo, $email) {
    $base = strtolower(preg_replace('/[^a-z0-9_.-]/i', '', explode('@', $email)[0]));
    if (strlen($base) < 3) $base = 'user' . $base;
    $base = substr($base, 0, 50);

    $candidate = $base;
    $n = 1;
    while (true) {
        $st = $pdo->prepare('SELECT id FROM users WHERE username = ?');
        $st->execute([$candidate]);
        if (!$st->fetch()) return $candidate;
        $n++;
        $candidate = $base . $n;
    }
}

/** POST auth/register — регистрация нового пользователя. */
function handle_register($pdo) {
    rate_limit($pdo, 'auth/register', 6, 3600);
    $b = body();
    check_honeypot($b);
    $email       = strtolower(s($b['email'] ?? ''));
    $password    = is_scalar($b['password'] ?? null) ? (string)$b['password'] : '';
    $displayName = s($b['displayName'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Введите корректный e-mail');
    if (mb_strlen($email) > 190)        fail('Слишком длинный e-mail');
    if (mb_strlen($password) < 6)       fail('Пароль должен быть не короче 6 символов');
    if (mb_strlen($password) > 200)     fail('Слишком длинный пароль');
    if (mb_strlen($displayName) < 1)    fail('Укажите имя');
    if (mb_strlen($displayName) > 120)  fail('Слишком длинное имя');
    if (empty($b['consent']))           fail('Нужно согласие на обработку персональных данных');

    $st = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $st->execute([$email]);
    if ($st->fetch()) fail('Пользователь с такой почтой уже зарегистрирован');

    $cfg      = config();
    $id       = uuid();
    $username = derive_username($pdo, $email);
    $role     = ($email === strtolower(trim($cfg['admin_email'] ?? ''))) ? 'admin' : 'user';
    $hash     = password_hash($password, PASSWORD_DEFAULT);
    $avatar   = make_avatar($displayName);

    $st = $pdo->prepare(
        'INSERT INTO users
            (id, email, username, display_name, avatar, password_hash, role, created_at, likes, favorites, published_ideas)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)'
    );
    $st->execute([$id, $email, $username, $displayName, $avatar, $hash, $role, now(), '[]', '[]', '[]']);

    $session = open_session($pdo, $id);

    $st = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $st->execute([$id]);
    json_out(['user' => public_user($st->fetch()), 'session' => $session]);
}

/** POST auth/login — вход. */
function handle_login($pdo) {
    rate_limit($pdo, 'auth/login', 20, 600);
    $b = body();
    $email    = strtolower(s($b['email'] ?? ''));
    $password = is_scalar($b['password'] ?? null) ? (string)$b['password'] : '';

    if ($email === '' || $password === '') fail('Введите почту и пароль');

    $st = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $st->execute([$email]);
    $user = $st->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        fail('Неверная почта или пароль', 401);
    }

    $session = open_session($pdo, $user['id']);
    json_out(['user' => public_user($user), 'session' => $session]);
}

/** POST auth/logout — выход. */
function handle_logout($pdo) {
    $token = auth_token();
    if ($token) {
        $st = $pdo->prepare('DELETE FROM sessions WHERE token = ?');
        $st->execute([$token]);
    }
    json_out(['ok' => true]);
}

/** GET auth/me — текущий пользователь. */
function handle_me($pdo) {
    $user = current_user($pdo);
    json_out(['user' => $user ? public_user($user) : null]);
}

/** POST auth/update — обновление профиля. */
function handle_update($pdo) {
    $user = require_user($pdo);
    $b = body();

    $fields = [];
    $values = [];

    if (isset($b['displayName'])) {
        $dn = s($b['displayName']);
        if (mb_strlen($dn) < 1 || mb_strlen($dn) > 120) fail('Некорректное имя');
        $fields[] = 'display_name = ?';
        $values[] = $dn;
    }
    if (isset($b['avatar'])) {
        $av = s($b['avatar']);
        if (mb_strlen($av) > 16) $av = mb_substr($av, 0, 16);
        $fields[] = 'avatar = ?';
        $values[] = ($av !== '' ? $av : '✦');
    }
    foreach (['likes' => 'likes', 'favorites' => 'favorites', 'publishedIdeas' => 'published_ideas'] as $key => $col) {
        if (isset($b[$key]) && is_array($b[$key])) {
            $fields[] = "$col = ?";
            $values[] = json_encode(array_values($b[$key]), JSON_UNESCAPED_UNICODE);
        }
    }

    if ($fields) {
        $values[] = $user['id'];
        $st = $pdo->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?');
        $st->execute($values);
    }

    $st = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $st->execute([$user['id']]);
    json_out(['user' => public_user($st->fetch())]);
}

/**
 * POST auth/forgot — запрос восстановления пароля.
 * Ответ всегда одинаков (ok), чтобы не раскрывать, есть ли аккаунт.
 */
function handle_forgot($pdo) {
    rate_limit($pdo, 'auth/forgot', 5, 3600);
    $b = body();
    check_honeypot($b);

    $email = strtolower(s($b['email'] ?? ''));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Введите корректный e-mail');

    $st = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $st->execute([$email]);
    $user = $st->fetch();

    // Демо-авторы сообщества (seed) не могут восстанавливать пароль.
    if ($user && ($user['password_hash'] ?? '') !== 'seed-no-login') {
        // Старые токены этого пользователя — гасим.
        $pdo->prepare('DELETE FROM password_resets WHERE user_id = ?')->execute([$user['id']]);

        $token   = token_gen();
        $expires = date('Y-m-d H:i:s', time() + 3600); // ссылка живёт 1 час
        $pdo->prepare(
            'INSERT INTO password_resets (token, user_id, created_at, expires_at) VALUES (?,?,?,?)'
        )->execute([$token, $user['id'], now(), $expires]);

        $link = site_base_url() . '/reset-password.html?token=' . $token;
        $msg  = "Здравствуйте!\n\n"
              . "Вы запросили восстановление пароля на сайте Jewerly of Soul.\n"
              . "Чтобы задать новый пароль, перейдите по ссылке (действительна 1 час):\n\n"
              . $link . "\n\n"
              . "Если вы не запрашивали восстановление пароля — просто проигнорируйте это письмо, "
              . "с вашим аккаунтом ничего не произойдёт.\n\n"
              . "— Jewerly of Soul";
        send_mail($user['email'], 'Восстановление пароля — Jewerly of Soul', $msg);
    }

    json_out(['ok' => true]);
}

/** POST auth/reset — установить новый пароль по токену из письма. */
function handle_reset($pdo) {
    rate_limit($pdo, 'auth/reset', 12, 3600);
    $b = body();

    $token    = s($b['token'] ?? '');
    $password = is_scalar($b['password'] ?? null) ? (string)$b['password'] : '';

    if ($token === '')             fail('Ссылка восстановления недействительна');
    if (mb_strlen($password) < 6)  fail('Пароль должен быть не короче 6 символов');
    if (mb_strlen($password) > 200) fail('Слишком длинный пароль');

    $st = $pdo->prepare('SELECT * FROM password_resets WHERE token = ?');
    $st->execute([$token]);
    $row = $st->fetch();
    if (!$row) fail('Ссылка восстановления недействительна или уже использована');

    if (strtotime($row['expires_at']) < time()) {
        $pdo->prepare('DELETE FROM password_resets WHERE token = ?')->execute([$token]);
        fail('Срок действия ссылки истёк. Запросите восстановление пароля заново.');
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        ->execute([$hash, $row['user_id']]);

    // Токен использован — удаляем все токены и старые сессии пользователя.
    $pdo->prepare('DELETE FROM password_resets WHERE user_id = ?')->execute([$row['user_id']]);
    $pdo->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$row['user_id']]);

    json_out(['ok' => true]);
}
