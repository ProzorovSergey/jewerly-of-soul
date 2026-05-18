/**
 * modal.js
 * ----------------------------------------------------------------
 * Простая модалка. Поддерживает HTML-контент и кнопки.
 *
 *   const m = openModal({
 *       title: 'Сохранить идею',
 *       body: '<form>...</form>',
 *       buttons: [
 *           { label: 'Отмена', kind: 'ghost', onClick: ({ close }) => close() },
 *           { label: 'Сохранить', kind: 'primary', onClick: async ({ root, close }) => { ... } },
 *       ],
 *       onClose() {...},
 *   });
 */

export function openModal({ title = '', body = '', buttons = [], onClose, dismissible = true, className = '' } = {}) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const box = document.createElement('div');
    box.className = 'modal' + (className ? ' ' + className : '');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    if (title) box.setAttribute('aria-label', title);

    let bodyHTML = '';
    if (title) bodyHTML += `<div class="modal__head">
        <h2 class="modal__title">${escapeHtml(title)}</h2>
        ${dismissible ? '<button class="modal__close" aria-label="закрыть">×</button>' : ''}
    </div>`;
    bodyHTML += `<div class="modal__body">${body}</div>`;
    if (buttons.length) {
        bodyHTML += '<div class="modal__actions">';
        buttons.forEach((b, i) => {
            const kind = b.kind || 'ghost';
            bodyHTML += `<button class="btn btn--${kind}" data-btn="${i}">${escapeHtml(b.label)}</button>`;
        });
        bodyHTML += '</div>';
    }
    box.innerHTML = bodyHTML;
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    requestAnimationFrame(() => backdrop.classList.add('is-in'));

    function close(result) {
        backdrop.classList.remove('is-in');
        backdrop.classList.add('is-out');
        setTimeout(() => {
            backdrop.remove();
            if (typeof onClose === 'function') onClose(result);
            // Возвращаем фокус туда, где он был до открытия модалки
            if (previousActive && typeof previousActive.focus === 'function') {
                previousActive.focus();
            }
        }, 200);
        document.removeEventListener('keydown', onKey);
    }

    // Запоминаем активный элемент для возврата фокуса
    const previousActive = document.activeElement;

    function focusableInModal() {
        return [...box.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
        )];
    }

    function onKey(e) {
        if (dismissible && e.key === 'Escape') { e.preventDefault(); close(); return; }
        if (e.key === 'Tab') {
            // Focus-trap: ходим по кругу внутри модалки
            const items = focusableInModal();
            if (!items.length) return;
            const first = items[0];
            const last  = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault(); last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault(); first.focus();
            }
        }
    }
    document.addEventListener('keydown', onKey);

    // Фокус на первый элемент модалки при открытии
    requestAnimationFrame(() => {
        const first = focusableInModal()[0];
        if (first) first.focus();
    });

    if (dismissible) {
        backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
        const cb = box.querySelector('.modal__close');
        if (cb) cb.addEventListener('click', () => close());
    }

    buttons.forEach((b, i) => {
        const node = box.querySelector(`button[data-btn="${i}"]`);
        if (!node) return;
        node.addEventListener('click', () => {
            if (typeof b.onClick === 'function') {
                Promise.resolve(b.onClick({ root: box, close })).catch(err => {
                    console.error(err);
                });
            } else {
                close();
            }
        });
    });

    return { root: box, close };
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
        { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
    ));
}
