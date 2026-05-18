/**
 * exporter.js
 * ----------------------------------------------------------------
 * Экспорт готового браслета:
 *   - PNG с canvas (старое поведение, для обратной совместимости);
 *   - exportCard — высокое разрешение, картинка-карточка с браслетом
 *     и составом (как в сообществе);
 *   - JSON-сборка.
 */

import { renderBracelet } from './bracelet.js';
import { generateStoneTexture } from './stoneGenerator.js';

/** Сгенерировать имя файла с датой. */
function timestamp() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
        + `_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/**
 * Скачать содержимое (Blob или строку) как файл.
 */
function download(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Освобождаем ресурс чуть позже, чтобы Safari успел
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Скачать canvas как PNG.
 * @param {HTMLCanvasElement} canvas
 * @param {String} [prefix]
 */
export function exportPNG(canvas, prefix = 'bracelet') {
    canvas.toBlob(blob => {
        if (!blob) return;
        download(`${prefix}_${timestamp()}.png`, blob);
    }, 'image/png');
}

/**
 * Экспорт «карточки браслета» — высокое разрешение, как в сообществе:
 *   • большой рендер браслета сверху;
 *   • подпись «Состав · N камней»;
 *   • двухколоночный список камней с иконками;
 *   • подвал с длиной и брендом.
 *
 * Полотно 1080×1400 (3:4, удобно для соцсетей и заказа в Telegram).
 *
 * @param {Object} bracelet           state.bracelet — { length, stones[] }
 * @param {Object} [options]
 * @param {String} [options.prefix]   префикс имени файла
 * @param {String} [options.title]    заголовок (если есть)
 * @returns {Promise<void>}           ждать готовности перед UI-уведомлением
 */
export async function exportCard(bracelet, options = {}) {
    const { prefix = 'bracelet', title = '' } = options;

    // ---- Полотно (3:4) ----
    const W = 1080;
    const H = 1400;
    const card = document.createElement('canvas');
    card.width = W;
    card.height = H;
    const ctx = card.getContext('2d');

    // ---- Фон ----
    // Тёплый тёмный градиент, как в hero на сайте
    const bg = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, W);
    bg.addColorStop(0, '#15131A');
    bg.addColorStop(1, '#06060A');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ---- Хэдер: бренд ----
    ctx.fillStyle = '#D9B879';
    ctx.font = '500 24px "Manrope", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Jewerly of Soul', 60, 70);

    ctx.fillStyle = '#8A847A';
    ctx.font = '400 14px "Manrope", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('· браслет', W - 60, 70);

    // ---- Title (если задан) ----
    let braceletY = 110;
    if (title) {
        ctx.fillStyle = '#E8E4DD';
        ctx.font = '500 40px "Fraunces", "Times New Roman", serif';
        ctx.textAlign = 'center';
        // Может обрезать длинное название; для простоты — fillText
        ctx.fillText(title, W / 2, braceletY + 30);
        braceletY += 50;
    }

    // ---- Большой рендер браслета (квадрат 780×780, центр-верх) ----
    const BR_SIZE = 780;
    const brX = (W - BR_SIZE) / 2;
    const brY = braceletY;
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = BR_SIZE;
    tmpCanvas.height = BR_SIZE;
    renderBracelet(tmpCanvas, bracelet, { showGuide: false });
    ctx.drawImage(tmpCanvas, brX, brY);

    // ---- Разделитель ----
    const sepY = brY + BR_SIZE + 30;
    ctx.fillStyle = 'rgba(217, 184, 121, 0.30)';
    ctx.fillRect(W / 2 - 24, sepY, 48, 1);

    // ---- Заголовок «СОСТАВ» ----
    const stones = bracelet.stones || [];
    ctx.fillStyle = '#8A847A';
    ctx.font = '500 13px "Manrope", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`СОСТАВ · ${stones.length} ${pluralStones(stones.length)}`, 60, sepY + 40);

    // ---- Список состава в 2 колонки ----
    const listTop = sepY + 70;
    const colW = (W - 60 * 2 - 30) / 2;    // 2 колонки, gap 30
    const rowH = 48;
    const iconSize = 32;

    // Для каждого камня рисуем строку: иконка | название | мета
    stones.forEach((s, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 60 + col * (colW + 30);
        const y = listTop + row * rowH;

        // Иконка камня (procedural; если PNG уже в кэше — drawImage возьмёт его)
        const tex = generateStoneTexture(s.stone, iconSize, i);
        ctx.drawImage(tex, x, y, iconSize, iconSize);

        // Название
        ctx.fillStyle = '#E8E4DD';
        ctx.font = '500 16px "Fraunces", "Times New Roman", serif';
        ctx.textAlign = 'left';
        ctx.fillText(truncate(s.stone.name, 22), x + iconSize + 14, y + 20);

        // Мета (размер · стихия)
        ctx.fillStyle = '#8A847A';
        ctx.font = '400 12px "Manrope", system-ui, sans-serif';
        ctx.fillText(`${s.size} мм · ${s.stone.element || ''}`, x + iconSize + 14, y + 38);
    });

    // ---- Подвал ----
    const footerY = H - 70;
    ctx.fillStyle = 'rgba(217, 184, 121, 0.30)';
    ctx.fillRect(60, footerY - 30, W - 120, 1);

    const lengthCm = (bracelet.length || 180) / 10;
    ctx.fillStyle = '#8A847A';
    ctx.font = '400 13px "Manrope", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`длина ${lengthCm} см · ${stones.length} ${pluralStones(stones.length)}`, 60, footerY);

    ctx.textAlign = 'right';
    ctx.fillText('jewerlyofsoul · ' + new Date().getFullYear(), W - 60, footerY);

    // ---- Скачиваем ----
    return new Promise(resolve => {
        card.toBlob(blob => {
            if (blob) download(`${prefix}_${timestamp()}.png`, blob);
            resolve();
        }, 'image/png');
    });
}

function truncate(s, max) {
    s = String(s || '');
    return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

/**
 * Скачать объект как JSON.
 * @param {Object} data
 * @param {String} [prefix]
 */
export function exportJSON(data, prefix = 'bracelet') {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    download(`${prefix}_${timestamp()}.json`, blob);
}

/**
 * Адрес почты мастера. Меняй здесь, если переименуешь почту бренда.
 */
export const MASTER_EMAIL = 'jewerlyofsoul25@gmail.com';

/**
 * Сформировать ссылку mailto: с готовым письмом-заявкой.
 *
 * @param {Object} data     результат serializeBracelet
 * @param {String} [note]   необязательный комментарий заказчика
 * @returns {String}        строка вида "mailto:...?subject=...&body=..."
 */
export function buildMailto(data, note = '') {
    const subject = `Заказ браслета — ${data.stones_count} ${pluralStones(data.stones_count)}, ${data.length_cm} см`;

    const lines = [];
    lines.push('Здравствуйте!');
    lines.push('Хочу заказать браслет по этой композиции:');
    lines.push('');
    lines.push(`Длина: ${data.length_cm} см (${data.length_mm} мм)`);
    lines.push(`Камней в браслете: ${data.stones_count}`);
    lines.push('');
    lines.push('Состав по порядку:');
    data.stones.forEach(s => {
        lines.push(`  ${s.position}. ${s.name} · ${s.size_mm} мм`);
    });
    lines.push('');
    if (note) {
        lines.push('Комментарий:');
        lines.push(note);
        lines.push('');
    }
    lines.push('PS: к этому письму прикладываю PNG-превью браслета.');
    lines.push('');
    lines.push('Спасибо!');

    const body = lines.join('\n');

    return `mailto:${MASTER_EMAIL}`
        + `?subject=${encodeURIComponent(subject)}`
        + `&body=${encodeURIComponent(body)}`;
}

function pluralStones(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'камень';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'камня';
    return 'камней';
}
