<?php
/* =====================================================================
 *  ideas.php — идеи сообщества (лента, лайки, избранное)
 * ===================================================================== */

/** Идея для отдачи клиенту. */
function public_idea($row) {
    if (!$row) return null;
    return [
        'id'                => $row['id'],
        'authorId'          => $row['author_id'],
        'title'             => $row['title'],
        'description'       => $row['description'] !== null ? $row['description'] : '',
        'stones'            => json_field($row['stones']),
        'length'            => (int)$row['length'],
        'tags'              => json_field($row['tags']),
        'mood'              => $row['mood'] !== null ? $row['mood'] : '',
        'isPublic'          => ((int)$row['is_public']) === 1,
        'energyDescription' => $row['energy_description'] !== null ? $row['energy_description'] : '',
        'likesCount'        => (int)$row['likes_count'],
        'createdAt'         => to_iso($row['created_at']),
        'updatedAt'         => to_iso($row['updated_at']),
    ];
}

/** Прочитать идею по id (объект для клиента или null). */
function fetch_idea($pdo, $id) {
    $st = $pdo->prepare('SELECT * FROM ideas WHERE id = ?');
    $st->execute([$id]);
    return public_idea($st->fetch());
}

// --- JSON-массивы-колонки пользователя (likes / favorites / published_ideas) ---

function user_list_get($pdo, $userId, $column) {
    $allowed = ['likes', 'favorites', 'published_ideas'];
    if (!in_array($column, $allowed, true)) fail('Внутренняя ошибка', 500);
    $st = $pdo->prepare("SELECT `$column` AS c FROM users WHERE id = ?");
    $st->execute([$userId]);
    $row = $st->fetch();
    return $row ? json_field($row['c']) : [];
}

function user_list_save($pdo, $userId, $column, $list) {
    $allowed = ['likes', 'favorites', 'published_ideas'];
    if (!in_array($column, $allowed, true)) fail('Внутренняя ошибка', 500);
    $st = $pdo->prepare("UPDATE users SET `$column` = ? WHERE id = ?");
    $st->execute([json_encode(array_values($list), JSON_UNESCAPED_UNICODE), $userId]);
}

function user_list_add($pdo, $userId, $column, $value) {
    $list = user_list_get($pdo, $userId, $column);
    if (!in_array($value, $list, true)) {
        $list[] = $value;
        user_list_save($pdo, $userId, $column, $list);
    }
}

function user_list_remove($pdo, $userId, $column, $value) {
    $list = user_list_get($pdo, $userId, $column);
    $next = array_values(array_filter($list, function ($x) use ($value) { return $x !== $value; }));
    if (count($next) !== count($list)) {
        user_list_save($pdo, $userId, $column, $next);
    }
}

/** Переключить наличие id в массиве. @return bool — теперь присутствует. */
function user_list_toggle($pdo, $userId, $column, $value) {
    $list = user_list_get($pdo, $userId, $column);
    if (in_array($value, $list, true)) {
        $next = array_values(array_filter($list, function ($x) use ($value) { return $x !== $value; }));
        user_list_save($pdo, $userId, $column, $next);
        return false;
    }
    $list[] = $value;
    user_list_save($pdo, $userId, $column, $list);
    return true;
}

// --- Эндпоинты -------------------------------------------------------

/** POST ideas/create — создать идею (автор = текущий пользователь). */
function handle_idea_create($pdo) {
    $me = require_user($pdo);
    $b = body();

    $title = s($b['title'] ?? '');
    if ($title === '') $title = 'Без названия';
    if (mb_strlen($title) > 200) fail('Слишком длинное название');

    $description = s($b['description'] ?? '');
    if (mb_strlen($description) > 4000) fail('Слишком длинное описание');

    $stones = (isset($b['stones']) && is_array($b['stones'])) ? array_values($b['stones']) : [];
    if (count($stones) > 200) fail('Слишком большой состав');

    $tags   = (isset($b['tags']) && is_array($b['tags'])) ? array_values($b['tags']) : [];
    $length = (isset($b['length']) && is_numeric($b['length'])) ? (int)$b['length'] : 180;
    $mood   = s($b['mood'] ?? '');
    $energy = s($b['energyDescription'] ?? '');
    $isPublic = !empty($b['isPublic']) ? 1 : 0;

    $id = uuid();
    $now = now();
    $st = $pdo->prepare(
        'INSERT INTO ideas
            (id, author_id, title, description, stones, length, tags, mood,
             is_public, energy_description, likes_count, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
    );
    $st->execute([
        $id, $me['id'], $title, ($description !== '' ? $description : null),
        json_encode($stones, JSON_UNESCAPED_UNICODE), $length,
        json_encode($tags, JSON_UNESCAPED_UNICODE),
        ($mood !== '' ? $mood : null), $isPublic,
        ($energy !== '' ? $energy : null), 0, $now, $now,
    ]);

    if ($isPublic) user_list_add($pdo, $me['id'], 'published_ideas', $id);

    json_out(['idea' => fetch_idea($pdo, $id)]);
}

/** GET ideas/get?id= — одна идея. */
function handle_idea_get($pdo) {
    $id = isset($_GET['id']) ? trim($_GET['id']) : '';
    if ($id === '') fail('Не указан id идеи');
    json_out(['idea' => fetch_idea($pdo, $id)]); // null, если не найдена
}

/** POST ideas/update — изменить идею (только автор). */
function handle_idea_update($pdo) {
    $me = require_user($pdo);
    $b = body();
    $id = s($b['id'] ?? '');
    if ($id === '') fail('Не указан id идеи');

    $st = $pdo->prepare('SELECT * FROM ideas WHERE id = ?');
    $st->execute([$id]);
    $idea = $st->fetch();
    if (!$idea) fail('Идея не найдена', 404);
    if ($idea['author_id'] !== $me['id']) fail('Это не ваша идея', 403);

    $wasPublic = ((int)$idea['is_public']) === 1;
    $newPublic = $wasPublic;

    $fields = [];
    $values = [];
    if (isset($b['title']))       { $t = s($b['title']); $fields[] = 'title = ?';       $values[] = ($t !== '' ? $t : 'Без названия'); }
    if (isset($b['description'])) { $fields[] = 'description = ?'; $values[] = s($b['description']); }
    if (isset($b['stones']) && is_array($b['stones'])) { $fields[] = 'stones = ?'; $values[] = json_encode(array_values($b['stones']), JSON_UNESCAPED_UNICODE); }
    if (isset($b['tags']) && is_array($b['tags']))     { $fields[] = 'tags = ?';   $values[] = json_encode(array_values($b['tags']), JSON_UNESCAPED_UNICODE); }
    if (isset($b['length']) && is_numeric($b['length'])) { $fields[] = 'length = ?'; $values[] = (int)$b['length']; }
    if (isset($b['mood']))        { $fields[] = 'mood = ?';        $values[] = s($b['mood']); }
    if (isset($b['energyDescription'])) { $fields[] = 'energy_description = ?'; $values[] = s($b['energyDescription']); }
    if (isset($b['isPublic']))    { $newPublic = !empty($b['isPublic']); $fields[] = 'is_public = ?'; $values[] = $newPublic ? 1 : 0; }

    $fields[] = 'updated_at = ?';
    $values[] = now();
    $values[] = $id;
    $up = $pdo->prepare('UPDATE ideas SET ' . implode(', ', $fields) . ' WHERE id = ?');
    $up->execute($values);

    if ($wasPublic !== $newPublic) {
        if ($newPublic) user_list_add($pdo, $idea['author_id'], 'published_ideas', $id);
        else            user_list_remove($pdo, $idea['author_id'], 'published_ideas', $id);
    }
    json_out(['idea' => fetch_idea($pdo, $id)]);
}

/** POST ideas/delete — удалить идею (только автор). */
function handle_idea_delete($pdo) {
    $me = require_user($pdo);
    $b = body();
    $id = s($b['id'] ?? '');
    if ($id === '') fail('Не указан id идеи');

    $st = $pdo->prepare('SELECT * FROM ideas WHERE id = ?');
    $st->execute([$id]);
    $idea = $st->fetch();
    if (!$idea) json_out(['ok' => true]);             // уже нет — считаем успехом
    if ($idea['author_id'] !== $me['id']) fail('Это не ваша идея', 403);

    $del = $pdo->prepare('DELETE FROM ideas WHERE id = ?');
    $del->execute([$id]);
    user_list_remove($pdo, $idea['author_id'], 'published_ideas', $id);

    json_out(['ok' => true]);
}

/** GET ideas/list — лента с фильтрами. */
function handle_idea_list($pdo) {
    $where  = [];
    $params = [];

    if (!empty($_GET['authorId'])) { $where[] = 'author_id = ?'; $params[] = trim($_GET['authorId']); }
    if (isset($_GET['isPublic']) && $_GET['isPublic'] !== '') {
        $where[] = 'is_public = ?';
        $params[] = ($_GET['isPublic'] === '1' || $_GET['isPublic'] === 'true') ? 1 : 0;
    }
    if (!empty($_GET['mood'])) { $where[] = 'mood = ?'; $params[] = trim($_GET['mood']); }

    $sql = 'SELECT * FROM ideas';
    if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
    $sort = isset($_GET['sort']) ? $_GET['sort'] : 'recent';
    $sql .= ($sort === 'popular')
        ? ' ORDER BY likes_count DESC, created_at DESC'
        : ' ORDER BY created_at DESC';

    $st = $pdo->prepare($sql);
    $st->execute($params);
    $ideas = array_map('public_idea', $st->fetchAll());

    // Фильтры по JSON-полям — проще и надёжнее применить в PHP.
    $tag     = isset($_GET['tag']) ? trim($_GET['tag']) : '';
    $stoneId = isset($_GET['stoneId']) ? trim($_GET['stoneId']) : '';
    $search  = isset($_GET['search']) ? mb_strtolower(trim($_GET['search'])) : '';

    if ($tag !== '' || $stoneId !== '' || $search !== '') {
        $ideas = array_values(array_filter($ideas, function ($i) use ($tag, $stoneId, $search) {
            if ($tag !== '' && !in_array($tag, $i['tags'], true)) return false;
            if ($stoneId !== '') {
                $has = false;
                foreach ($i['stones'] as $s) {
                    if (isset($s['id']) && $s['id'] === $stoneId) { $has = true; break; }
                }
                if (!$has) return false;
            }
            if ($search !== '') {
                $hay = mb_strtolower($i['title'] . ' ' . $i['description'] . ' ' . implode(' ', $i['tags']));
                if (mb_strpos($hay, $search) === false) return false;
            }
            return true;
        }));
    }

    json_out(['ideas' => $ideas]);
}

/** POST ideas/like — поставить/снять лайк. */
function handle_idea_like($pdo) {
    $me = require_user($pdo);
    $b = body();
    $ideaId = s($b['ideaId'] ?? '');
    if ($ideaId === '') fail('Не указан id идеи');

    $st = $pdo->prepare('SELECT id, likes_count FROM ideas WHERE id = ?');
    $st->execute([$ideaId]);
    $idea = $st->fetch();
    if (!$idea) fail('Идея не найдена', 404);

    $nowLiked = user_list_toggle($pdo, $me['id'], 'likes', $ideaId);
    $count = (int)$idea['likes_count'] + ($nowLiked ? 1 : -1);
    if ($count < 0) $count = 0;
    $up = $pdo->prepare('UPDATE ideas SET likes_count = ? WHERE id = ?');
    $up->execute([$count, $ideaId]);

    json_out(['liked' => $nowLiked, 'likesCount' => $count]);
}

/** POST ideas/favorite — добавить/убрать из избранного. */
function handle_idea_favorite($pdo) {
    $me = require_user($pdo);
    $b = body();
    $ideaId = s($b['ideaId'] ?? '');
    if ($ideaId === '') fail('Не указан id идеи');

    $favorited = user_list_toggle($pdo, $me['id'], 'favorites', $ideaId);
    json_out(['favorited' => $favorited]);
}
