// src/ui/playerCard.js — OYUNCU KARTI: kadroda oyuncuya tıklayınca açılan 3D dosya kartı.
// Deterministik SVG futbolcu avatarı (kulüp formalı büst; ten/saç/sakal çeşitli — düz vektör,
// telifsiz, her oyuncuda aynı yüz) + tüm kritik veriler: güç/potansiyel, değer/tahmini
// bedel/maaş/sözleşme, FORM/KONDİSYON/MUTLULUK + türetilmiş TD UYUMU / KULÜP AİDİYETİ /
// BAŞKANA GÜVEN çubukları + satış listesi & kiralık listesi aksiyonları.
import { esc, fmt } from './frame.js';

const POS_TR = { GK: 'Kaleci', DEF: 'Stoper', MID: 'Orta saha', FWD: 'Forvet' };
const POS_COL = { GK: 'var(--club)', DEF: 'var(--info)', MID: 'var(--pos)', FWD: 'var(--warn)' };

function h32(s) { let h = 0; const t = String(s); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return h; }
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// TD uyumu: oyuncu×hoca kimyası — kararlı (aynı ikili hep aynı), TD değişince değişir
export function tdUyum(p, coach) {
  return 42 + (h32(p.id + '|' + (coach?.name || '')) % 49); // 42-90
}
// Kulüp aidiyeti: köklü karakter + bağlam (kaptanlık bağlar; kiralık/satış listesi koparır)
export function aidiyet(p, G) {
  let a = 45 + (h32(p.name + '#aidiyet') % 41); // 45-85 taban
  if (p.id === G.captainId) a += 10;
  if (p.loanIn) a -= 25;
  if (p.vitrin) a -= 12;
  if (p.kiralikListe) a -= 8;
  return clamp(Math.round(a), 5, 99);
}
export function karakterOf(p) {
  const K = ['Lider ruhlu', 'Sakin ve dengeli', 'Hırslı', 'Alevlenebilir', 'Profesyonel', 'Mahalle çocuğu', 'Sessiz ama derin'];
  return K[h32(p.id + p.name) % K.length];
}

// ── SVG FUTBOLCU AVATARI — düz-vektör büst (faceless): kulüp forması + forma numarası,
// 6 ten × 6 saç rengi × 5 saç stili × sakal → yüzlerce farklı yüz. GK koyu forma giyer.
export function playerAvatar(p, size = 92) {
  const h = h32(p.id + '|' + p.name);
  const skins = ['#EDC9A3', '#E0B48A', '#C99B6E', '#A97C50', '#8A5A34', '#6E4426'];
  const hairsC = ['#241B12', '#3C2A18', '#5C4326', '#151515', '#6B4B2F', '#4A3B33'];
  const skin = skins[h % skins.length];
  const hair = hairsC[(h >>> 3) % hairsC.length];
  const stil = (h >>> 6) % 5;
  const sakal = (h >>> 9) % 10 < 3; // ~%30 sakal
  const no = (h % 29) + 1;
  const gk = p.pos === 'GK';
  const uid = 'av' + (h % 100000);
  // Saç stilleri: 0 kısa · 1 yandan ayrık · 2 kıvırcık · 3 uzunca · 4 sıfır (gölge)
  const sacPath = [
    `<path d="M30 36a18 18 0 0 1 36 0c0-11-6-19-18-19s-18 8-18 19z" fill="${hair}"/>`,
    `<path d="M30 35c2-10 8-16 18-16 11 0 17 6 18 15-6-6-10-7-14-3-6-5-16-4-22 4z" fill="${hair}"/>`,
    `<path d="M29 36c-2-13 8-21 19-21s21 8 19 21c-2-5-5-8-8-7 1-4-2-7-5-6-2-3-6-3-8 0-3-2-6 1-5 5-4-1-9 2-12 8z" fill="${hair}"/>`,
    `<path d="M28 44c-2-18 8-27 20-27s22 9 20 27l-5-2c2-12-4-19-15-19s-17 7-15 19z" fill="${hair}"/>`,
    `<path d="M31 33a17 17 0 0 1 34 0c0-9-7-15-17-15s-17 6-17 15z" fill="${hair}" opacity=".45"/>`,
  ][stil];
  return `<svg class="pc-ava" viewBox="0 0 96 96" width="${size}" height="${size}" aria-hidden="true">
    <defs>
      <radialGradient id="${uid}bg" cx="50%" cy="28%" r="82%"><stop offset="0" stop-color="rgba(var(--club-rgb),.38)"/><stop offset="1" stop-color="rgba(8,12,22,.95)"/></radialGradient>
      <linearGradient id="${uid}fr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${gk ? '#3a4d33' : 'var(--club-2)'}"/><stop offset="1" stop-color="${gk ? '#222d1d' : 'var(--club)'}"/></linearGradient>
    </defs>
    <circle cx="48" cy="48" r="47" fill="url(#${uid}bg)" stroke="rgba(255,255,255,.14)"/>
    <path d="M16 96c1-19 15-29 32-29s31 10 32 29z" fill="url(#${uid}fr)"/>
    <path d="M40 68l8 7 8-7-4-3h-8z" fill="rgba(10,15,26,.55)"/>
    <text x="48" y="89" text-anchor="middle" font-family="Archivo,system-ui,sans-serif" font-weight="800" font-size="13" fill="rgba(255,255,255,.85)">${no}</text>
    <rect x="43" y="55" width="10" height="13" rx="4" fill="${skin}"/>
    <circle cx="48" cy="42" r="17" fill="${skin}"/>
    ${sakal ? `<path d="M34 46a14 14 0 0 0 28 0c0 12-6 17-14 17s-14-5-14-17z" fill="${hair}" opacity=".85"/>` : ''}
    ${sacPath}
  </svg>`;
}

const renk = (v) => (v >= 62 ? 'var(--pos)' : v >= 45 ? 'var(--warn)' : 'var(--neg)');
const bar = (lbl, v, col, tip) => `<div class="pc-bar" data-tip="${esc(tip || '')}"><i>${lbl}</i><span class="tr"><b style="width:${clamp(Math.round(v), 3, 100)}%;background:${col || renk(v)}"></b></span><em class="tnum">${Math.round(v)}</em></div>`;

export function render(G) {
  const p = (G.squad || []).find((x) => String(x.id) === String(G._pcard));
  if (!p) return '';
  const tier = p.overall >= 75 ? 't1' : p.overall >= 60 ? 't2' : p.overall >= 45 ? 't3' : 't4';
  const uyum = tdUyum(p, G.coach);
  const aid = aidiyet(p, G);
  const guven = Math.round(p.baskanaGuven ?? 50);
  const bedel = Math.round(p.marketValue * 1.12 * 10) / 10; // tahmini bonservis (piyasa primi)
  const potChip = p.age < 24 && (p.potential || p.overall) > p.overall + 2
    ? '<span class="pc-chip pot" data-tip="Genç — tavanı mevcut gücünün üstünde; doğru gelişimle patlar">POTANSİYEL ★</span>' : '';
  return `<div class="pcard-ovl" data-act="pcardClose">
    <div class="pcard ${tier}" data-act="noop">
      <button class="pc-close" data-act="pcardClose" aria-label="Kapat">✕</button>
      <span class="pcard-wm">${esc((p.name || '?')[0])}</span>
      <div class="pc-head">
        ${playerAvatar(p, 92)}
        <div class="pc-kim">
          <div class="pc-nm">${esc(p.name)}</div>
          <div class="pc-chips">
            <span class="pc-chip" style="border-color:${POS_COL[p.pos]};color:${POS_COL[p.pos]}">${POS_TR[p.pos] || p.pos}</span>
            <span class="pc-chip">${p.age} yaş</span>
            ${p.age <= 21 ? '<span class="pc-chip g">GENÇ</span>' : ''}
            ${p.id === G.captainId ? '<span class="pc-chip c" data-tip="Kaptan">C</span>' : ''}
            ${p.loanIn ? '<span class="pc-chip i">KİRALIK</span>' : ''}
            ${p.vitrin ? '<span class="pc-chip i">SATIŞTA</span>' : ''}
            ${p.kiralikListe ? '<span class="pc-chip i">KİRALIK LİSTESİNDE</span>' : ''}
            ${p.injuryWeeks > 0 ? `<span class="pc-chip i">🩹 ${p.injuryWeeks} HAFTA</span>` : ''}
            ${p.suspensionWeeks > 0 ? `<span class="pc-chip i">🟥 CEZALI</span>` : ''}
            ${potChip}
          </div>
          <div class="pc-karakter">💬 Karakter: <b>${karakterOf(p)}</b></div>
        </div>
        <div class="pc-rate ${tier}" data-tip="Mevcut güç"><b>${p.overall}</b><i>GÜÇ</i></div>
      </div>
      <div class="pc-stats">
        <span class="pc-cell"><i>DEĞER</i><b>${fmt(p.marketValue)}mn</b></span>
        <span class="pc-cell" data-tip="Bugün satılsa piyasa primiyle beklenen bedel"><i>TAHMİNİ BEDEL</i><b>~${fmt(bedel)}mn</b></span>
        <span class="pc-cell"><i>MAAŞ</i><b>${fmt(p.wage)}mn<em>/sezon</em></b></span>
        <span class="pc-cell"><i>SÖZLEŞME</i><b>${p.contractYears ?? '—'} yıl</b></span>
      </div>
      <div class="pc-bars">
        ${bar('FORM', p.form, null, 'Son haftalardaki saha performansı')}
        ${bar('KONDİSYON', p.fitness, null, 'Bacaklardaki güç — rotasyonla toparlar')}
        ${bar('MUTLULUK', p.morale, null, 'Moral — satış listesi ve kötü seriler yıpratır')}
        ${bar('TD UYUMU', uyum, 'var(--info)', 'Hocayla sahadaki kimyası — TD değişirse bu da değişir')}
        ${bar('KULÜP AİDİYETİ', aid, 'var(--club-2)', 'Armaya bağlılık — kaptanlık bağlar, satış listesi koparır')}
        ${bar('BAŞKANA GÜVEN', guven, 'var(--pos)', 'Sana güveni — verdiğin kararlar iz bırakır')}
      </div>
      <div class="pc-actions">
        ${p.loanIn
      ? '<span class="muted" style="font-size:11px">🔒 Kiralık oyuncu — sezon sonu asıl kulübüne döner; satılamaz, listelenemez.</span>'
      : `<button class="cx-btn ${p.vitrin ? 'on' : ''}" data-act="vitrin" data-arg="${p.id}" data-tip="${p.vitrin ? 'Satış listesinden geri çek' : 'Menajerlere sinyal gider; teklifler 2-4 haftada gelir'}">${p.vitrin ? '🏷 Satıştan çek' : 'Satış listesine koy'}</button>
         <button class="cx-btn ${p.kiralikListe ? 'on' : ''}" data-act="kiralikListe" data-arg="${p.id}" data-tip="${p.kiralikListe ? 'Kiralık listesinden çek' : 'Pencere açıkken alt sıralardan kiralık dosyası gelebilir'}">${p.kiralikListe ? '↩ Kiralıktan çek' : 'Kiralık listesine koy'}</button>`}
        <button class="cx-btn pc-kapat" data-act="pcardClose">Kapat</button>
      </div>
    </div>
  </div>`;
}
