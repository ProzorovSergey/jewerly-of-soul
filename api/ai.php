<?php
/* =====================================================================
 *  ai.php — описание энергетики браслета через нейросеть (OpenAI)
 * ---------------------------------------------------------------------
 *  Ключ API задаётся в config.php (поле openai_api_key).
 *
 *  Пока ключ не задан ИЛИ нейросеть недоступна — эндпоинт отдаёт
 *  result = null. В этом случае сайт сам показывает описание по
 *  встроенным правилам (js/core/aiAssistant.js). Сайт работает
 *  в любом случае — без ключа просто нет «настоящего» ИИ.
 * ===================================================================== */

/** POST ai/describe — сгенерировать описание энергетики браслета. */
function handle_ai_describe($pdo) {
    rate_limit($pdo, 'ai/describe', 30, 3600);
    $b = body();

    $stones = (isset($b['stones']) && is_array($b['stones'])) ? $b['stones'] : [];
    $length = (isset($b['length']) && is_numeric($b['length'])) ? (int)$b['length'] : 180;
    if (!count($stones))      fail('Состав браслета пуст');
    if (count($stones) > 100) fail('Слишком большой состав браслета');

    $cfg = config();
    $key = trim($cfg['openai_api_key'] ?? '');

    // Ключ не задан — пусть фронтенд покажет описание по правилам.
    if ($key === '') {
        json_out(['result' => null, 'source' => 'unconfigured']);
    }

    // --- Сводка состава для запроса к нейросети ---
    $lines = [];
    foreach ($stones as $s) {
        $name = isset($s['name']) ? s($s['name']) : '';
        if ($name === '') continue;
        $el = isset($s['element']) ? s($s['element']) : '';
        $en = (isset($s['energy']) && is_array($s['energy']))
            ? implode(', ', array_map('strval', $s['energy'])) : '';
        $sz = (isset($s['size']) && is_numeric($s['size'])) ? ((int)$s['size'] . ' мм') : '';
        $lines[] = '- ' . $name
            . ($el ? ' (стихия: ' . $el . ')' : '')
            . ($en ? '; энергии: ' . $en : '')
            . ($sz ? '; размер бусины: ' . $sz : '');
    }
    if (!count($lines)) fail('Не удалось определить состав браслета');

    $lengthCm = round($length / 10, 1);
    $userPrompt =
        "Браслет из натуральных камней, длина {$lengthCm} см. Состав:\n"
        . implode("\n", $lines) . "\n\n"
        . "Опиши энергетику этого браслета тёплым, образным, но не пафосным языком "
        . "на русском. Дай практическую рекомендацию (кому и в каких ситуациях носить) "
        . "и предложи 3 коротких поэтичных названия для браслета.";

    $systemPrompt =
        "Ты — мастер-консультант мастерской браслетов из натуральных камней «Jewerly of Soul». "
        . "Пишешь по-русски, тепло и со вкусом, без эзотерического пафоса и без обещаний "
        . "лечебного или магического эффекта. "
        . "Отвечай СТРОГО валидным JSON-объектом с полями: "
        . "energyDescription (строка, 2–4 предложения), "
        . "recommendations (строка, 1–2 предложения), "
        . "nameSuggestions (массив ровно из 3 коротких строк-названий).";

    $result = ai_openai_chat($key, ($cfg['openai_model'] ?? 'gpt-4o-mini'), $systemPrompt, $userPrompt);

    // Любая ошибка нейросети — не валим запрос: result = null,
    // фронтенд покажет описание по встроенным правилам.
    if ($result === null) {
        json_out(['result' => null, 'source' => 'ai-error']);
    }
    json_out(['result' => $result, 'source' => 'openai']);
}

/**
 * Запрос к OpenAI Chat Completions.
 * @return array|null  [ energyDescription, recommendations, nameSuggestions ] либо null
 */
function ai_openai_chat($key, $model, $systemPrompt, $userPrompt) {
    if (!function_exists('curl_init')) return null;

    $payload = [
        'model'    => $model,
        'messages' => [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user',   'content' => $userPrompt],
        ],
        'temperature'     => 0.8,
        'max_tokens'      => 600,
        'response_format' => ['type' => 'json_object'],
    ];

    $ch = curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $key,
        ],
        CURLOPT_TIMEOUT        => 25,
        CURLOPT_CONNECTTIMEOUT => 10,
    ]);
    $raw  = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false || $code < 200 || $code >= 300) return null;

    $data    = json_decode($raw, true);
    $content = $data['choices'][0]['message']['content'] ?? '';
    if (!is_string($content) || $content === '') return null;

    $parsed = json_decode($content, true);
    if (!is_array($parsed)) return null;

    $names = [];
    if (isset($parsed['nameSuggestions']) && is_array($parsed['nameSuggestions'])) {
        foreach ($parsed['nameSuggestions'] as $n) {
            if (is_scalar($n)) {
                $clean = mb_substr(trim((string)$n), 0, 60);
                if ($clean !== '') $names[] = $clean;
            }
        }
    }

    $energy = isset($parsed['energyDescription']) && is_scalar($parsed['energyDescription'])
        ? trim((string)$parsed['energyDescription']) : '';
    if ($energy === '') return null;   // пустой ответ — считаем ошибкой

    return [
        'energyDescription' => mb_substr($energy, 0, 2000),
        'recommendations'   => isset($parsed['recommendations']) && is_scalar($parsed['recommendations'])
            ? mb_substr(trim((string)$parsed['recommendations']), 0, 1000) : '',
        'nameSuggestions'   => array_slice($names, 0, 3),
    ];
}
