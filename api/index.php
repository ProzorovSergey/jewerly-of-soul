<?php
/* =====================================================================
 *  index.php — единая точка входа backend «Jewerly of Soul»
 * ---------------------------------------------------------------------
 *  Все запросы идут сюда:  /api/?route=<маршрут>
 *  Например:               /api/?route=auth/login
 * ===================================================================== */

require __DIR__ . '/lib.php';
require __DIR__ . '/db.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/orders.php';
require __DIR__ . '/ideas.php';
require __DIR__ . '/users.php';

// --- CORS (на случай запросов с другого домена) ----------------------
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Auth-Token, Authorization');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$route = isset($_GET['route']) ? trim($_GET['route']) : '';

try {
    $pdo = db();
    switch ($route) {
        // --- Авторизация ---
        case 'auth/register': handle_register($pdo); break;
        case 'auth/login':    handle_login($pdo);    break;
        case 'auth/logout':   handle_logout($pdo);   break;
        case 'auth/me':       handle_me($pdo);       break;
        case 'auth/update':   handle_update($pdo);   break;

        // --- Заявки ---
        case 'orders/create': handle_order_create($pdo); break;
        case 'orders/mine':   handle_orders_mine($pdo);  break;
        case 'orders/list':   handle_orders_list($pdo);  break;
        case 'orders/get':    handle_order_get($pdo);    break;
        case 'orders/status': handle_order_status($pdo); break;

        // --- Идеи сообщества ---
        case 'ideas/create':   handle_idea_create($pdo);   break;
        case 'ideas/get':      handle_idea_get($pdo);      break;
        case 'ideas/update':   handle_idea_update($pdo);   break;
        case 'ideas/delete':   handle_idea_delete($pdo);   break;
        case 'ideas/list':     handle_idea_list($pdo);     break;
        case 'ideas/like':     handle_idea_like($pdo);     break;
        case 'ideas/favorite': handle_idea_favorite($pdo); break;

        // --- Пользователи ---
        case 'users/get':  handle_user_get($pdo);  break;
        case 'users/list': handle_user_list($pdo); break;

        // --- Проверка живости ---
        case 'ping': json_out(['ok' => true, 'time' => now()]); break;

        default:
            json_out(['error' => 'Неизвестный маршрут: ' . $route], 404);
    }
} catch (ApiError $e) {
    json_out(['error' => $e->getMessage()], $e->httpCode);
} catch (Throwable $e) {
    json_out(['error' => 'Внутренняя ошибка сервера'], 500);
}
