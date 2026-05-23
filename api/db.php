<?php
/* =====================================================================
 *  db.php — подключение к базе данных MySQL (PDO)
 * ===================================================================== */

/**
 * Вернуть подключение к БД (создаётся один раз за запрос).
 * @return PDO
 */
function db() {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $cfg = config();
    $dsn = 'mysql:host=' . $cfg['db_host'] . ';dbname=' . $cfg['db_name'] . ';charset=utf8mb4';

    try {
        $pdo = new PDO($dsn, $cfg['db_user'], $cfg['db_pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (PDOException $e) {
        json_out(['error' => 'Нет связи с базой данных. Проверь данные в api/config.php.'], 500);
    }

    return $pdo;
}
