# Как сгенерировать реалистичные камни для Jewerly of Soul

Этот документ — практическая инструкция, как наполнить `assets/stones/` фотореалистичными PNG-картинками камней.

Когда в этой папке появляется файл `<id>.png`, WebGL-шейдер автоматически использует его как albedo (цвет поверхности) вместо процедурного. Поверх PNG добавляются Fresnel rim light, спекуляр и тень. Это даёт ощущение «фото бусины в студийной подсветке».

Сейчас в папке лежат **8 тестовых картинок** (amethyst, malachite, rose-quartz, lapis, labradorite, aventurine, tiger-eye, obsidian). Они НЕ фотореалистичные — это proof-of-concept, чтобы ты видел, как работает система. **Заменяй их на реальные AI-картинки** или просто удаляй — рендер откатится на procedural.

## Технические требования к PNG

- **Размер:** квадрат, 512×512 или 1024×1024 пикселей.
- **Формат:** PNG-32 с прозрачным фоном.
- **Содержимое:** одна гладкая полированная бусина в центре кадра. Бусина занимает **~95% по диаметру** (между бусиной и краем кадра небольшой воздух).
- **Освещение:** мягкое студийное, key-light слева-сверху. Без выраженных белых пересветов (наш шейдер добавит блик сверху).
- **Фон:** прозрачный (preferable) или ровный нейтральный (#0E0E14 / чёрный).
- **Имя файла:** `<id>.png`, где id — точно совпадает с полем `id` в `data/stones.json` (см. таблицу ниже).

## Универсальный AI-промпт

Этот промпт подходит для **Flux 1.1 Pro**, **Midjourney v7**, **DALL-E 3**, **Stable Diffusion XL** с фотографическим режимом. Просто подставляй название камня:

```
Macro studio photograph of a single polished {STONE_NAME} sphere bead,
8mm diameter, isolated on transparent background, soft diffused studio
lighting from upper-left, gentle ambient fill, no harsh specular
highlights, museum-quality polished finish, natural mineral inclusions
and veining visible, ultra-detailed surface texture, sharp focus,
shallow depth of field, color-accurate, photorealistic, professional
gemological photography, no logos, no text, centered composition,
filling 90% of the frame
```

**Negative prompt** (если поддерживается):
```
cartoon, illustration, painting, low quality, blurry, plastic, fake,
oversaturated, harsh lighting, white background, hand, person, logo,
text, watermark, multiple objects, jewelry setting, ring, necklace
```

**Параметры:**
- Aspect ratio: 1:1 (square)
- Quality: max / hi-fi
- Style: photographic / realistic
- Seed: можно фиксировать одинаковый для всех 66 камней — даст консистентное освещение.

### Лайфхак: батчем через ChatGPT/Claude → API

Если генерируешь через Flux API или OpenAI API, можно скриптом за 10 минут получить все 66 — просто прогнать таблицу ниже через цикл.

## Таблица 66 камней

Имя файла = `id.png`. «EN-name» — английское название, подставляется в `{STONE_NAME}` промпта.

| id | Русское название | EN name (для промпта) |
|---|---|---|
| `amethyst` | Аметист | amethyst |
| `rose-quartz` | Розовый кварц | rose quartz |
| `lepidolite` | Лепидолит | lepidolite |
| `charoite` | Чароит | charoite |
| `kunzite` | Кунцит | kunzite |
| `rhodonite` | Родонит | rhodonite |
| `rhodochrosite` | Родохрозит | rhodochrosite |
| `pink-opal` | Опал розовый | pink opal |
| `phosphosiderite` | Фосфосидерит | phosphosiderite |
| `rock-crystal` | Горный хрусталь | clear rock crystal quartz |
| `clear-quartz` | Кварц | clear quartz |
| `moonstone` | Лунный камень | rainbow moonstone |
| `white-jade` | Нефрит белый | white jade nephrite |
| `mother-of-pearl` | Перламутр | mother of pearl shell |
| `obsidian` | Обсидиан | black obsidian |
| `onyx` | Оникс | black onyx |
| `shungite` | Шунгит | shungite |
| `black-tourmaline` | Турмалин чёрный | black tourmaline schorl |
| `hematite` | Гематит | hematite metallic |
| `black-agate` | Агат чёрный | black agate |
| `green-jade` | Нефрит зелёный | green jade nephrite |
| `jadeite` | Жадеит | imperial jadeite |
| `malachite` | Малахит | malachite with concentric green bands |
| `aventurine` | Авантюрин | green aventurine with sparkles |
| `prehnite` | Пренит | prehnite |
| `unakite` | Унакит | unakite jasper |
| `chrysoprase` | Хризопраз | chrysoprase apple green |
| `amazonite` | Амазонит | amazonite turquoise green |
| `chrysocolla` | Хризоколла | chrysocolla blue green |
| `green-apatite` | Апатит зелёный | green apatite |
| `variscite` | Варисцит | variscite |
| `serpentine` | Серпентин | serpentine olive green |
| `green-grossular` | Гранат гроссуляр | grossular garnet green |
| `lapis` | Лазурит | lapis lazuli with pyrite flecks |
| `sodalite` | Содалит | sodalite blue with white veins |
| `blue-apatite` | Апатит синий | blue apatite |
| `angelite` | Ангелит | angelite pale blue |
| `kyanite` | Кианит | blue kyanite |
| `aquamarine` | Аквамарин | aquamarine pale blue |
| `larimar` | Ларимар | larimar caribbean blue |
| `blue-agate` | Агат голубой | blue lace agate |
| `dumortierite` | Дюмортьерит | dumortierite deep blue |
| `iolite` | Иолит | iolite violet-blue |
| `carnelian` | Сердолик | carnelian orange-red |
| `almandine-garnet` | Гранат альмадин | almandine garnet deep red |
| `hessonite-garnet` | Гранат гессонит | hessonite garnet orange honey |
| `red-jasper` | Яшма красная | red jasper |
| `bull-eye` | Бычий глаз | bull's eye chatoyant red-brown |
| `tiger-eye` | Тигровый глаз | tiger eye golden chatoyant |
| `hawk-eye` | Соколиный глаз | hawk's eye blue chatoyant |
| `cat-eye` | Кошачий глаз | cat's eye chrysoberyl chatoyant |
| `pyrite` | Пирит | golden pyrite metallic |
| `sunstone` | Солнечный камень | sunstone orange shimmer |
| `bronzite` | Бронзит | bronzite metallic brown |
| `pietersite` | Питерсит | pietersite golden chatoyant |
| `topaz` | Топаз | imperial topaz golden |
| `grey-agate` | Агат серый | grey banded agate |
| `moss-agate` | Агат моховой | moss agate green inclusions |
| `bamboo-agate` | Агат бамбуковый | bamboo agate caramel banded |
| `mexican-agate` | Агат мексиканский | crazy lace agate red |
| `labradorite` | Лабрадорит | labradorite with rainbow flash |
| `fluorite` | Флюорит | rainbow fluorite |
| `azurmalachite` | Азурмалахит | azurite malachite blue-green |
| `astrophyllite` | Астрофиллит | astrophyllite with golden needles |
| `astrophyllite-quartz` | Кварц с астрофиллитом | clear quartz with astrophyllite inclusions |
| `beryl` | Берилл | green beryl |

## Workflow «руками» (если используешь Midjourney или DALL-E через интерфейс)

1. Открой Midjourney / DALL-E.
2. Возьми промпт выше, подставь название из таблицы (например `lapis lazuli with pyrite flecks`).
3. Сгенерируй, выбери лучший вариант.
4. Открой в редакторе (Photoshop / GIMP / Photopea — бесплатно), убери фон (Remove Background).
5. Сохрани как PNG-32 с прозрачным фоном.
6. Назови файл `<id>.png` точно по таблице (например `lapis.png`).
7. Положи в `assets/stones/`.

## Workflow через API (если знаком с программированием)

Я могу подготовить Python-скрипт, который пройдёт по таблице и вызовет Flux/OpenAI API. Скажи — напишу.

## Что произойдёт после подкладывания PNG

- Сайт автоматически подхватит файл при следующей загрузке страницы (без перекомпиляции).
- На странице камней / в конструкторе бусина будет нарисована по PNG — сверху WebGL добавит rim light, специлярный блик и подповерхностное свечение (если `finish: "transparent"`).
- Для камней без PNG продолжит работать procedural-рендер. Можно начать с 10 камней — остальные подтянутся, когда у тебя дойдут руки.

## Тестовые PNG (уже в папке)

Сейчас в `assets/stones/` лежат 8 простых тестовых картинок. Они **не фотореалистичные**, это просто демонстрация работы pipeline:

- `amethyst.png` · `malachite.png` · `rose-quartz.png` · `lapis.png` · `labradorite.png` · `aventurine.png` · `tiger-eye.png` · `obsidian.png`

Удали их перед заливкой настоящих, или просто перезапиши.

## Если PNG неудачный

Иногда AI-картинка получается с криво обрезанным краем или странной формой. В этом случае:

1. Открой PNG в Photopea / GIMP.
2. Маска → круг по центру → инверсия → залить прозрачностью.
3. Сохрани.

Хорошие результаты обычно даёт **Flux 1.1 Pro** через fal.ai (бесплатные тестовые кредиты есть) — он лучше всего понимает «macro photography polished sphere».

---

Что-то непонятно — пиши, помогу.
