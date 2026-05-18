/**
 * layout.js
 * ----------------------------------------------------------------
 * Общая шапка и подвал. Подписывается на authService и
 * перерисовывает блок пользователя при логине/выходе.
 */

import * as auth from '../services/authService.js';
import { ensureSeed } from '../services/seedService.js';
import './tilt.js';        // авто-подключение микровзаимодействий для всех [data-tilt]
import './reveal.js';      // scroll-reveal для [data-reveal]
import './cursor.js';      // premium-курсор (только на desktop)
import './registerSW.js';  // регистрация Service Worker для offline-режима
import './pageTransitions.js'; // плавные переходы между страницами (View Transitions API)
import { toggleTheme, effectiveTheme, onThemeChange } from './theme.js';

const NAV = [
    { id: 'home',         href: 'index.html',         label: 'Главная' },
    { id: 'constructor',  href: 'constructor.html',   label: 'Конструктор' },
    { id: 'stones',       href: 'stones.html',        label: 'Камни' },
    { id: 'inspiration',  href: 'inspiration.html',   label: 'Сообщество' },
    { id: 'contact',      href: 'contact.html',       label: 'Связаться' },
];

// Иконки для bottom-nav: 5 главных разделов (mobile-only, всегда виден)
const BOTTOM_NAV = [
    { id: 'home',         href: 'index.html',
      icon: '<path d="M3 12 12 3l9 9"/><path d="M5 10v10h14V10"/>',
      label: 'Главная' },
    { id: 'constructor',  href: 'constructor.html',
      icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="3.5" r="1.5"/><circle cx="12" cy="20.5" r="1.5"/><circle cx="3.5" cy="12" r="1.5"/><circle cx="20.5" cy="12" r="1.5"/>',
      label: 'Сборка' },
    { id: 'stones',       href: 'stones.html',
      icon: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18M3 12h18"/>',
      label: 'Камни' },
    { id: 'inspiration',  href: 'inspiration.html',
      icon: '<rect x="3" y="4" width="8" height="6" rx="1"/><rect x="13" y="4" width="8" height="10" rx="1"/><rect x="3" y="12" width="8" height="8" rx="1"/><rect x="13" y="16" width="8" height="4" rx="1"/>',
      label: 'Лента' },
    { id: 'contact',      href: 'contact.html',
      icon: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
      label: 'Связь' },
];

const PROTECTED_PAGES = new Set(['profile', 'create-idea']);

/** Заполнить шапку и подвал. */
export async function mountLayout() {
    // Засев seed-данных — один раз для всего сайта
    await ensureSeed();

    const active = document.body.dataset.page || 'home';

    renderHeader(active);
    renderBottomNav(active);
    renderFooter(active);

    // Защита страниц
    if (PROTECTED_PAGES.has(active)) {
        const me = await auth.getCurrentUser();
        if (!me) {
            // редирект на логин с return
            const ret = encodeURIComponent(location.pathname.split('/').pop());
            location.replace(`login.html?return=${ret}`);
            return;
        }
    }

    auth.onAuthChange(() => renderHeader(active));
}

function renderHeader(active) {
    const header = document.getElementById('siteHeader');
    if (!header) return;
    header.classList.add('site-header');
    header.innerHTML = `
        <div class="site-header__inner">
            <a href="index.html" class="site-header__brand" aria-label="Jewerly of Soul — главная">Jewerly of Soul</a>

            <nav class="site-nav" id="siteNav" aria-label="Основная навигация">
                ${NAV.filter(n => n.id !== 'home').map(n => `
                    <a href="${n.href}" class="site-nav__link${n.id === active ? ' is-active' : ''}">${n.label}</a>
                `).join('')}
            </nav>

            <div class="site-header__actions">
                <button class="theme-toggle" id="themeToggle" type="button" aria-label="Переключить тему">
                    <svg class="theme-toggle__icon theme-toggle__icon--moon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                    <svg class="theme-toggle__icon theme-toggle__icon--sun" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <circle cx="12" cy="12" r="4"/>
                        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"/>
                    </svg>
                </button>
                <span class="site-nav__user" id="siteNavUser">…</span>
            </div>
        </div>
    `;

    // Theme-toggle
    const themeBtn = header.querySelector('#themeToggle');
    if (themeBtn) {
        const syncBtn = () => {
            const eff = effectiveTheme();
            themeBtn.dataset.theme = eff;
            themeBtn.setAttribute('title', eff === 'light' ? 'Тёмная тема' : 'Светлая тема');
        };
        syncBtn();
        themeBtn.addEventListener('click', () => { toggleTheme(); syncBtn(); });
        onThemeChange(syncBtn);
    }

    renderUserSlot(active);
}

async function renderUserSlot(active) {
    const slot = document.getElementById('siteNavUser');
    if (!slot) return;
    let me = null;
    try { me = await auth.getCurrentUser(); } catch (_) { me = null; }

    if (!me) {
        slot.innerHTML = `
            <a href="login.html" class="user-slot user-slot--guest${active === 'login' ? ' is-active' : ''}">
                <svg class="user-slot__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                    <polyline points="10 17 15 12 10 7"/>
                    <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                <span class="user-slot__label">Вход</span>
            </a>
        `;
        return;
    }

    // Залогинен — прямая ссылка на профиль с аватаром и именем
    slot.innerHTML = `
        <a href="profile.html" class="user-slot${active === 'profile' ? ' is-active' : ''}" aria-label="Перейти в профиль">
            <span class="avatar">${escapeHtml(me.avatar || '✦')}</span>
            <span class="user-slot__name">${escapeHtml(me.displayName)}</span>
        </a>
    `;
}

function renderBottomNav(active) {
    // Создаём, если ещё нет
    let nav = document.getElementById('bottomNav');
    if (!nav) {
        nav = document.createElement('nav');
        nav.id = 'bottomNav';
        nav.className = 'bottom-nav';
        nav.setAttribute('aria-label', 'Нижняя навигация');
        document.body.appendChild(nav);
    }
    nav.innerHTML = BOTTOM_NAV.map(n => `
        <a href="${n.href}" class="bottom-nav__link${n.id === active ? ' is-active' : ''}" aria-label="${n.label}">
            <svg class="bottom-nav__icon" viewBox="0 0 24 24" aria-hidden="true">${n.icon}</svg>
            <span>${n.label}</span>
        </a>
    `).join('');
}

function renderFooter(active) {
    const footer = document.getElementById('siteFooter');
    if (!footer) return;
    footer.classList.add('site-footer');
    footer.innerHTML = `
        <div class="site-footer__inner">
            <div>
                <div class="site-footer__brand">Jewerly of Soul</div>
                <div class="site-footer__tagline">
                    Личная мастерская браслетов из натуральных камней.<br>
                    Композиции по запросу.
                </div>
            </div>
            <nav class="site-footer__nav" aria-label="Подвал">
                ${NAV.filter(n => n.id !== 'home').map(n => `
                    <a href="${n.href}" class="site-nav__link${n.id === active ? ' is-active' : ''}">${n.label}</a>
                `).join('')}
            </nav>
        </div>
        <div class="site-footer__bottom">
            <span>© ${new Date().getFullYear()} · сделано неспешно</span>
            <span>Ижевск, Россия</span>
        </div>
    `;
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
        { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
    ));
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountLayout);
} else {
    mountLayout();
}
