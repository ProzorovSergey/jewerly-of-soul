/**
 * register.js — обработка регистрации.
 */
import * as auth from '../services/authService.js';
import { toast } from '../ui/toast.js';

const form = document.getElementById('registerForm');

form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = new FormData(form);
    const email       = (data.get('email') || '').toString().trim();
    const password    = (data.get('password') || '').toString();
    const displayName = (data.get('displayName') || '').toString().trim();
    const consent     = !!data.get('consent');
    const hp          = (data.get('hp') || '').toString();

    if (!consent) {
        toast.error('Подтвердите согласие на обработку персональных данных');
        return;
    }

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Создаю…';
    try {
        await auth.register({ email, password, displayName, consent, hp });
        toast.success('Аккаунт создан');
        setTimeout(() => location.href = 'profile.html', 300);
    } catch (err) {
        toast.error(err.message || 'Не получилось');
        btn.disabled = false;
        btn.textContent = 'Создать аккаунт';
    }
});
