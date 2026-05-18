/**
 * registerSW.js
 * ----------------------------------------------------------------
 * Регистрирует Service Worker. Если есть обновление — показывает
 * незаметный toast «обновление готово · перезагрузить».
 *
 * Работает только в production-окружении (через HTTPS или localhost).
 * file:// и непомеченные origins — Service Worker недоступен.
 */

import { toast } from './toast.js';

if ('serviceWorker' in navigator) {
    // Защита: не регистрируем SW при file:// или при отсутствии
    // безопасного контекста.
    if (window.isSecureContext) {
        // Откладываем регистрацию до полной загрузки страницы, чтобы
        // не конкурировать с критичными ресурсами.
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => {
                    // Следим за обновлениями
                    reg.addEventListener('updatefound', () => {
                        const newSW = reg.installing;
                        if (!newSW) return;
                        newSW.addEventListener('statechange', () => {
                            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                                // Уже есть активный SW — значит это апдейт
                                showUpdateToast(newSW);
                            }
                        });
                    });
                })
                .catch(err => console.warn('[sw] registration failed:', err));

            // Авто-релоад при смене controller'а (после SKIP_WAITING)
            let reloading = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (reloading) return;
                reloading = true;
                location.reload();
            });
        });
    }
}

function showUpdateToast(newSW) {
    // Простой toast с подсказкой; пользователь может перезагрузить сам.
    toast.info('Обновление готово — перезагрузите страницу', 6000);
    // Активируем нового SW через 4с автоматически, чтобы новый
    // контент подцепился без ручного действия (controllerchange
    // выше перезагрузит вкладку).
    setTimeout(() => {
        try { newSW.postMessage({ type: 'SKIP_WAITING' }); }
        catch (_) { /* noop */ }
    }, 4000);
}
