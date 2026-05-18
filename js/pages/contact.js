/**
 * contact.js
 * ----------------------------------------------------------------
 * Форма обратной связи — собирает поля и открывает mailto:
 * с предзаполненным письмом.
 */

import { MASTER_EMAIL } from '../core/exporter.js';

const form = document.getElementById('contactForm');
if (form) {
    form.addEventListener('submit', e => {
        e.preventDefault();

        const data = new FormData(form);
        const name    = (data.get('name')    || '').toString().trim();
        const from    = (data.get('from')    || '').toString().trim();
        const message = (data.get('message') || '').toString().trim();

        if (!name || !from || !message) {
            // Подсветим пустые поля
            form.querySelectorAll('[required]').forEach(f => {
                f.style.borderColor = f.value.trim() ? '' : 'var(--el-fire)';
            });
            return;
        }

        const subject = `Сообщение с сайта — ${name}`;
        const body = [
            `От: ${name} (${from})`,
            '',
            message,
            '',
            '— отправлено с jewerlyofsoul.ru',
        ].join('\n');

        const href = `mailto:${MASTER_EMAIL}`
            + `?subject=${encodeURIComponent(subject)}`
            + `&body=${encodeURIComponent(body)}`;

        window.location.href = href;
    });

    // Снимаем красную границу при вводе
    form.querySelectorAll('[required]').forEach(f => {
        f.addEventListener('input', () => { f.style.borderColor = ''; });
    });
}
