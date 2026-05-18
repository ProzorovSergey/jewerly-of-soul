/**
 * register.js — обработка регистрации.
 */
import * as auth from '../services/authService.js';
import { toast } from '../ui/toast.js';

const form = document.getElementById('registerForm');

form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = new FormData(form);
    const username    = (data.get('username') || '').toString().trim();
    const password    = (data.get('password') || '').toString();
    const displayName = (data.get('displayName') || '').toString().trim();

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Создаю…';
    try {
        await auth.register({ username, password, displayName });
        toast.success('Аккаунт создан');
        setTimeout(() => location.href = 'profile.html', 300);
    } catch (err) {
        toast.error(err.message || 'Не получилось');
        btn.disabled = false;
        btn.textContent = 'Создать аккаунт';
    }
});
