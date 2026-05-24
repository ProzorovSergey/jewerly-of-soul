/**
 * forgot-password.js — запрос восстановления пароля.
 *
 * Отправляет почту на backend (auth/forgot). Ответ всегда «ок» —
 * наличие аккаунта не раскрывается. После отправки показываем
 * нейтральное сообщение «письмо отправлено, если аккаунт есть».
 */
import * as auth from '../services/authService.js';
import { toast } from '../ui/toast.js';

const form = document.getElementById('forgotForm');
const done = document.getElementById('forgotDone');

form.addEventListener('submit', async e => {
    e.preventDefault();
    const data  = new FormData(form);
    const email = (data.get('email') || '').toString().trim();
    const hp    = (data.get('hp') || '').toString();

    if (!email) {
        toast.error('Укажите e-mail');
        return;
    }

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Отправляю…';
    try {
        await auth.requestPasswordReset(email, hp);
        form.hidden = true;
        done.hidden = false;
    } catch (err) {
        toast.error(err.message || 'Не удалось отправить письмо');
        btn.disabled = false;
        btn.textContent = 'Прислать ссылку';
    }
});
