/**
 * toast.js
 * ----------------------------------------------------------------
 * Лёгкие нотификации. Stack в правом нижнем углу, авто-исчезновение.
 *
 *   import { toast } from '../ui/toast.js';
 *   toast.success('Идея сохранена');
 *   toast.error('Не получилось войти');
 *   toast.info('Подсказка');
 */

const STACK_ID = 'toastStack';

function ensureStack() {
    let s = document.getElementById(STACK_ID);
    if (s) return s;
    s = document.createElement('div');
    s.id = STACK_ID;
    s.className = 'toast-stack';
    s.setAttribute('role', 'status');
    s.setAttribute('aria-live', 'polite');
    document.body.appendChild(s);
    return s;
}

function show(message, kind = 'info', ms = 3200) {
    const stack = ensureStack();
    const node = document.createElement('div');
    node.className = `toast toast--${kind}`;
    node.textContent = message;
    stack.appendChild(node);
    // forced reflow + animate-in
    requestAnimationFrame(() => node.classList.add('is-in'));
    setTimeout(() => {
        node.classList.remove('is-in');
        node.classList.add('is-out');
        setTimeout(() => node.remove(), 280);
    }, ms);
}

export const toast = {
    info:    (m, ms) => show(m, 'info', ms),
    success: (m, ms) => show(m, 'success', ms),
    error:   (m, ms) => show(m, 'error', ms),
    warn:    (m, ms) => show(m, 'warn', ms),
};
