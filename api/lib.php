<?php
/* =====================================================================
 *  lib.php — общие функции backend
 * ===================================================================== */

mb_internal_encoding('UTF-8');

/** Настройки из config.php (загружаются один раз). */
function config() {
    static $cfg = null;
    if ($cfg === null) {
        $cfg = require __DIR__ . '/config.php';
    }
    return $cfg;
}

/** Ошибка API с HTTP-кодом. */
class ApiError extends Exception {
    public $httpCode;
    public function __construct($message, $httpCode = 400) {
        parent::__construct($message);
        $this->httpCode = $httpCode;
    }
}

/** Прервать обработку с понятной ошибкой. */
function fail($message, $httpCode = 400) {
    throw new ApiError($message, $httpCode);
}

/** Отдать JSON-ответ и завершить выполнение. */
function json_out($data, $httpCode = 200) {
    if (!headers_sent()) {
        http_response_code($httpCode);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Прочитать тело запроса как JSON-массив. */
function body() {
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) return [];
    $data = json_decode($raw, true);
    if (!is_array($data)) fail('Некорректный формат запроса');
    return $data;
}

/** Безопасно привести значение запроса к обрезанной строке. */
function s($v) {
    return is_scalar($v) ? trim((string)$v) : '';
}

/** Сгенерировать UUID v4. */
function uuid() {
    $d = random_bytes(16);
    $d[6] = chr((ord($d[6]) & 0x0f) | 0x40);
    $d[8] = chr((ord($d[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d), 4));
}

/** Случайный токен сессии (64 hex-символа). */
function token_gen() {
    return bin2hex(random_bytes(32));
}

/** Короткий публичный код заявки, например JOS-7K3M9P. */
function order_code() {
    $alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    $s = '';
    for ($i = 0; $i < 6; $i++) {
        $s .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }
    return 'JOS-' . $s;
}

/** Текущие дата-время в формате БД. */
function now() {
    return date('Y-m-d H:i:s');
}

/** Дата БД → ISO-8601. */
function to_iso($dt) {
    if (!$dt) return null;
    return date('c', strtotime($dt));
}

/** Аватар-инициалы из имени. */
function make_avatar($displayName) {
    $name = trim($displayName);
    if ($name === '') return '✦';
    $parts = preg_split('/\s+/u', $name);
    if (count($parts) === 1) {
        return mb_strtoupper(mb_substr($parts[0], 0, 2));
    }
    return mb_strtoupper(mb_substr($parts[0], 0, 1) . mb_substr($parts[1], 0, 1));
}

/** Токен авторизации из заголовков или параметров запроса. */
function auth_token() {
    if (!empty($_SERVER['HTTP_X_AUTH_TOKEN'])) {
        return trim($_SERVER['HTTP_X_AUTH_TOKEN']);
    }
    $h = '';
    if (!empty($_SERVER['HTTP_AUTHORIZATION']))          $h = $_SERVER['HTTP_AUTHORIZATION'];
    elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) $h = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    if ($h !== '' && preg_match('/Bearer\s+(\S+)/i', $h, $m)) {
        return $m[1];
    }
    if (!empty($_GET['token'])) return trim($_GET['token']);
    return null;
}

/** Текущий пользователь (строка БД) или null. */
function current_user($pdo) {
    $token = auth_token();
    if (!$token) return null;

    $st = $pdo->prepare('SELECT * FROM sessions WHERE token = ?');
    $st->execute([$token]);
    $session = $st->fetch();
    if (!$session) return null;

    if (strtotime($session['expires_at']) < time()) {
        $del = $pdo->prepare('DELETE FROM sessions WHERE token = ?');
        $del->execute([$token]);
        return null;
    }

    $st = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $st->execute([$session['user_id']]);
    $user = $st->fetch();
    return $user ?: null;
}

/** Требовать вход. */
function require_user($pdo) {
    $user = current_user($pdo);
    if (!$user) fail('Нужно войти в аккаунт', 401);
    return $user;
}

/** Требовать права администратора. */
function require_admin($pdo) {
    $user = require_user($pdo);
    if (($user['role'] ?? 'user') !== 'admin') {
        fail('Доступ только для администратора', 403);
    }
    return $user;
}

/** Открыть новую сессию для пользователя. */
function open_session($pdo, $userId) {
    $cfg = config();
    $ttlDays = (int)($cfg['session_ttl_days'] ?? 30);
    $token = token_gen();
    $expires = date('Y-m-d H:i:s', time() + $ttlDays * 86400);

    $st = $pdo->prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)');
    $st->execute([$token, $userId, now(), $expires]);

    return [
        'token'     => $token,
        'userId'    => $userId,
        'expiresAt' => to_iso($expires),
    ];
}

/** JSON-поле БД → массив. */
function json_field($raw) {
    if ($raw === null || $raw === '') return [];
    $v = json_decode($raw, true);
    return is_array($v) ? $v : [];
}

/** Объект пользователя для отдачи владельцу аккаунта (без пароля). */
function public_user($row) {
    if (!$row) return null;
    return [
        'id'             => $row['id'],
        'email'          => $row['email'],
        'username'       => $row['username'],
        'displayName'    => $row['display_name'],
        'avatar'         => $row['avatar'] ?: '✦',
        'role'           => $row['role'] ?? 'user',
        'createdAt'      => to_iso($row['created_at']),
        'likes'          => json_field($row['likes'] ?? null),
        'favorites'      => json_field($row['favorites'] ?? null),
        'publishedIdeas' => json_field($row['published_ideas'] ?? null),
    ];
}

/** Объект заявки для отдачи клиенту. */
function public_order($row) {
    if (!$row) return null;
    return [
        'id'             => $row['id'],
        'publicCode'     => $row['public_code'],
        'userId'         => $row['user_id'],
        'contactName'    => $row['contact_name'],
        'contactMethod'  => $row['contact_method'],
        'contactValue'   => $row['contact_value'],
        'composition'    => json_field($row['composition']),
        'braceletLength' => $row['bracelet_length'] !== null ? (int)$row['bracelet_length'] : null,
        'comment'        => $row['comment'],
        'status'         => $row['status'],
        'adminNote'      => $row['admin_note'],
        'createdAt'      => to_iso($row['created_at']),
        'updatedAt'      => to_iso($row['updated_at']),
    ];
}
