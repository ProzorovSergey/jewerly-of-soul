/**
 * reset-password.js — установка нового пароля по токену из письма.
 *
 * Токен берётся из адреса страницы: reset-password.html?token=…
 */
import * as auth from '../services/authService.js';
import { toast } from '../ui/toast.js';

const form = document.getElementById('resetForm');
const done = document.getElementById('resetDone');
const bad  = document.getElementById('resetBad');

const token = new URLSearchParams(location.search).get('token') || '';

// Нет токена в ссылке — сразу показываем «ссылка недействительна».
if (!token) {
    form.hidden = true;
    bad.hidden = false;
}

form.addEventListener('submit', async e => {
    e.preventDefault();
    const data      = new FormData(form);
    const password  = (data.get('password') || '').toString();
    const password2 = (data.get('password2') || '').toString();

    if (password.length < 6) {
        toast.error('Пароль должен быть не короче 6 символов');
        return;
    }
    if (password !== password2) {
        toast.error('Пароли не совпадают');
        return;
    }

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Сохраняю…';
    try {
        await auth.resetPassword(token, password);
        form.hidden = true;
        done.hidden = false;
        toast.success('Пароль обновлён');
    } catch (err) {
        const msg = err.message || 'Не удалось сменить пароль';
        // Недействительный/просроченный токен — показываем отдельный блок.
        if (/недействительн|истёк|истек|использован/i.test(msg)) {
            form.hidden = true;
            bad.hidden = false;
        } else {
            toast.error(msg);
            btn.disabled = false;
            btn.textContent = 'Сохранить пароль';
        }
    }
});
