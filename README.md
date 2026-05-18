# Jewerly of Soul — v2 (premium polish)

Личная мастерская браслетов из натуральных полудрагоценных камней.
Это **v2** — фокус на премиум-уровне UX/визуала: motion-system, atmosphere, hero refinement, bracelet cards redesign, inspiration feed evolution.

- **Stable v1** живёт на старом репо: <https://prozorovsergey.github.io/kamushki_v2/>
- **v2 (этот репо)** будет на: <https://prozorovsergey.github.io/jewerly-of-soul/>

## Цель v2

Перевести сайт из «хорошего проекта» в уровень premium handcrafted jewelry experience / modern luxury digital atelier / Apple-level polish — с сохранением spiritual/mineral atmosphere и handcrafted feeling.

Эталоны: Aesop · Arc'teryx · premium fashion landing pages · luxury jewelry boutiques · editorial experiences.

## Стек

Тот же что и в v1: HTML / CSS / Vanilla JS / GitHub Pages.

Без React/Vue, без бандлеров, без npm зависимостей. ES-модули, layered architecture (core / api / services / ui / pages), WebGL PBR-рендер камней, PWA с offline-кэшем.

## Что улучшаем (по приоритету)

1. **Motion system + atmosphere** — единая архитектура движений: easing-tokens, scroll-reveal v2, page-transitions, ambient motion, premium hover. *(текущий приоритет)*
2. **Hero refinement** — layered lighting, cinematic atmosphere, premium typography composition.
3. **Bracelet cards redesign** — карточки как luxury collectible objects: material feeling, depth, glow.
4. **Inspiration feed evolution** — editorial-magazine стиль: masonry, immersive preview modal.
5. **Premium mobile experience** — gesture feeling, sticky behavior, thumb-zone.
6. **Advanced microinteractions** — magnetic effects, tactile hover, loading polish.
7. **Advanced typography system** — clamp, fluid spacing, optical alignment.
8. **Premium atmosphere** — soft lighting, atmospheric gradients, calm luxury.

## Performance constraint

Несмотря на все визуальные апгрейды:

- сохранить fast loading
- сохранить Lighthouse performance
- не перегружать GPU
- избегать layout thrashing

Все анимации — через `transform` / `opacity`, с `will-change` только там, где реально нужно, и со снятием его после конца.

## Запуск локально

Чисто статика, никаких dev-зависимостей:

```bash
# В корне проекта
python -m http.server 8000
# открыть http://localhost:8000
```

Любой статический сервер подойдёт.

## Структура

```
.
├── index.html                  главная
├── constructor.html            конструктор браслета
├── stones.html                 каталог камней (66 шт)
├── inspiration.html            лента сообщества
├── idea.html                   детальная карточка идеи
├── profile.html                личный кабинет
├── login.html / register.html  аутентификация
├── contact.html                связаться с мастером
├── create-idea.html            точка входа на сохранение
│
├── sw.js                       Service Worker (offline-кэш)
├── manifest.webmanifest        PWA-манифест
├── robots.txt / sitemap.xml    SEO
│
├── assets/
│   └── stones/                 PNG-альбедо 66 камней
│
├── data/
│   └── stones.json             каталог: id, name, element, цвет, энергия
│
├── styles/
│   ├── tokens.css              design system (цвета, типографика, motion)
│   ├── base.css                reset + типографические утилиты
│   ├── layout.css              site-header / site-footer / bottom-nav
│   ├── components.css          кнопки, чипы, поля, тосты, модалки, скелетоны
│   └── pages/                  специфика страниц
│
└── js/
    ├── core/                   stoneGenerator, bracelet, exporter, webgl/, database
    ├── api/                    local-storage API + interfaces
    ├── services/               authService, ideaService, userService, favoritesService
    ├── ui/                     layout, modal, toast, reveal, theme, tilt, cursor,
    │                           pageTransitions, miniBracelet, ideaCard, stoneDetail
    └── pages/                  логика каждой страницы
```

## История

- **v1** (`kamushki_v2` repo) — рабочий MVP диплома: 66 камней с WebGL PBR-рендером, конструктор браслетов, мок-сообщество с seed-данными, PWA, светлая/тёмная темы, mobile bottom-nav.
- **v2** (этот репо) — premium polish этап.
