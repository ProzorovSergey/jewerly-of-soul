<?php
/* =====================================================================
 *  users.php — публичные профили пользователей
 * ===================================================================== */

/** Публичный профиль (без приватных полей). */
function public_user_short($row, $publishedCount) {
    if (!$row) return null;
    return [
        'id'             => $row['id'],
        'username'       => $row['username'],
        'displayName'    => $row['display_name'],
        'avatar'         => $row['avatar'] ?: '✦',
        'createdAt'      => to_iso($row['created_at']),
        'publishedCount' => (int)$publishedCount,
    ];
}

/** Сколько публичных идей у пользователя. */
function count_published($pdo, $userId) {
    $st = $pdo->prepare('SELECT COUNT(*) AS c FROM ideas WHERE author_id = ? AND is_public = 1');
    $st->execute([$userId]);
    $r = $st->fetch();
    return $r ? (int)$r['c'] : 0;
}

/** GET users/get?id= или ?username= */
function handle_user_get($pdo) {
    $id = isset($_GET['id']) ? trim($_GET['id']) : '';
    $username = isset($_GET['username']) ? trim($_GET['username']) : '';

    if ($id !== '') {
        $st = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $st->execute([$id]);
    } elseif ($username !== '') {
        $st = $pdo->prepare('SELECT * FROM users WHERE username = ?');
        $st->execute([strtolower($username)]);
    } else {
        fail('Не указан пользователь');
    }

    $row = $st->fetch();
    if (!$row) json_out(['user' => null]);
    json_out(['user' => public_user_short($row, count_published($pdo, $row['id']))]);
}

/** GET users/list — все пользователи. */
function handle_user_list($pdo) {
    $users = $pdo->query('SELECT * FROM users ORDER BY created_at ASC')->fetchAll();

    // Счётчики публичных идей — одним запросом.
    $counts = [];
    foreach ($pdo->query('SELECT author_id, COUNT(*) AS c FROM ideas WHERE is_public = 1 GROUP BY author_id') as $r) {
        $counts[$r['author_id']] = (int)$r['c'];
    }

    $out = [];
    foreach ($users as $u) {
        $out[] = public_user_short($u, isset($counts[$u['id']]) ? $counts[$u['id']] : 0);
    }
    json_out(['users' => $out]);
}
