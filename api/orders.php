<?php
/* =====================================================================
 *  orders.php — заявки на сборку браслетов
 * ===================================================================== */

/** Допустимые статусы заявки. */
function order_statuses() {
    return ['new', 'accepted', 'in_progress', 'done', 'cancelled'];
}

/** POST orders/create — создать заявку (можно без входа). */
function handle_order_create($pdo) {
    rate_limit($pdo, 'orders/create', 12, 3600);
    $b  = body();
    check_honeypot($b);
    $me = current_user($pdo); // может быть null — заявки принимаются и от гостей

    $contactName   = s($b['contactName'] ?? '');
    $contactMethod = s($b['contactMethod'] ?? '');
    $contactValue  = s($b['contactValue'] ?? '');
    $comment       = s($b['comment'] ?? '');
    $composition   = $b['composition'] ?? null;
    $braceletLength = isset($b['braceletLength']) && is_numeric($b['braceletLength'])
        ? (int)$b['braceletLength'] : null;

    if (mb_strlen($contactName) < 1)   fail('Укажите, как к вам обращаться');
    if (mb_strlen($contactName) > 120) fail('Слишком длинное имя');
    if (mb_strlen($contactValue) < 1)  fail('Укажите контакт для связи');
    if (mb_strlen($contactValue) > 190) fail('Слишком длинный контакт');
    if (!in_array($contactMethod, ['telegram', 'phone', 'email', 'whatsapp', 'vk', 'other'], true)) {
        $contactMethod = 'other';
    }
    if (!is_array($composition) || count($composition) < 1) fail('Состав браслета пуст');
    if (count($composition) > 100)     fail('Слишком большой состав браслета');
    if (mb_strlen($comment) > 2000)    fail('Слишком длинный комментарий');
    if (empty($b['consent']))          fail('Нужно согласие на обработку персональных данных');

    // Уникальный публичный код
    $code = order_code();
    for ($i = 0; $i < 5; $i++) {
        $st = $pdo->prepare('SELECT id FROM orders WHERE public_code = ?');
        $st->execute([$code]);
        if (!$st->fetch()) break;
        $code = order_code();
    }

    $id = uuid();
    $st = $pdo->prepare(
        'INSERT INTO orders
            (id, public_code, user_id, contact_name, contact_method, contact_value,
             composition, bracelet_length, comment, status, admin_note, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
    );
    $st->execute([
        $id, $code, ($me ? $me['id'] : null),
        $contactName, $contactMethod, $contactValue,
        json_encode($composition, JSON_UNESCAPED_UNICODE),
        $braceletLength, ($comment !== '' ? $comment : null),
        'new', null, now(), now(),
    ]);

    $st = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
    $st->execute([$id]);
    json_out(['order' => public_order($st->fetch())]);
}

/** GET orders/mine — заявки текущего пользователя. */
function handle_orders_mine($pdo) {
    $me = require_user($pdo);
    $st = $pdo->prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC');
    $st->execute([$me['id']]);
    json_out(['orders' => array_map('public_order', $st->fetchAll())]);
}

/** GET orders/list — все заявки (только админ). ?status= — фильтр. */
function handle_orders_list($pdo) {
    require_admin($pdo);
    $status = isset($_GET['status']) ? trim($_GET['status']) : '';

    if ($status !== '' && in_array($status, order_statuses(), true)) {
        $st = $pdo->prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC');
        $st->execute([$status]);
    } else {
        $st = $pdo->query('SELECT * FROM orders ORDER BY created_at DESC');
    }
    json_out(['orders' => array_map('public_order', $st->fetchAll())]);
}

/** GET orders/get — одна заявка по ?id= или ?code=. */
function handle_order_get($pdo) {
    $id   = isset($_GET['id']) ? trim($_GET['id']) : '';
    $code = isset($_GET['code']) ? trim($_GET['code']) : '';

    if ($id !== '') {
        $st = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
        $st->execute([$id]);
    } elseif ($code !== '') {
        $st = $pdo->prepare('SELECT * FROM orders WHERE public_code = ?');
        $st->execute([strtoupper($code)]);
    } else {
        fail('Не указан идентификатор заявки');
    }

    $order = $st->fetch();
    if (!$order) fail('Заявка не найдена', 404);

    $me      = current_user($pdo);
    $isAdmin = $me && ($me['role'] ?? 'user') === 'admin';
    $isOwner = $me && $order['user_id'] && $order['user_id'] === $me['id'];
    if (!$isAdmin && !$isOwner) fail('Нет доступа к этой заявке', 403);

    json_out(['order' => public_order($order)]);
}

/** POST orders/status — сменить статус заявки (только админ). */
function handle_order_status($pdo) {
    require_admin($pdo);
    $b = body();

    $id     = s($b['id'] ?? '');
    $status = s($b['status'] ?? '');
    if ($id === '') fail('Не указана заявка');
    if (!in_array($status, order_statuses(), true)) fail('Недопустимый статус');

    $st = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
    $st->execute([$id]);
    $order = $st->fetch();
    if (!$order) fail('Заявка не найдена', 404);

    $adminNote = isset($b['adminNote']) ? s($b['adminNote']) : (string)$order['admin_note'];
    if (mb_strlen($adminNote) > 2000) fail('Слишком длинная заметка');

    $st = $pdo->prepare('UPDATE orders SET status = ?, admin_note = ?, updated_at = ? WHERE id = ?');
    $st->execute([$status, ($adminNote !== '' ? $adminNote : null), now(), $id]);

    $st = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
    $st->execute([$id]);
    json_out(['order' => public_order($st->fetch())]);
}
