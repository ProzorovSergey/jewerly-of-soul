/**
 * login.js — обработка формы входа.
 */
import * as auth from '../services/authService.js';
import { toast } from '../ui/toast.js';

const form = document.getElementById('loginForm');

form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = new FormData(form);
    const username = (data.get('username') || '').toString().trim();
    const password = (data.get('password') || '').toString();

    if (!username || !password) {
        toast.error('Заполните логин и пароль');
        return;
    }

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Вхожу…';
    try {
        await auth.login({ username, password });
        toast.success('С возвращением!');
        const params = new URLSearchParams(location.search);
        const ret = params.get('return') || 'profile.html';
        setTimeout(() => location.href = ret, 250);
    } catch (err) {
        toast.error(err.message || 'Не получилось войти');
        btn.disabled = false;
        btn.textContent = 'Войти';
    }
});
