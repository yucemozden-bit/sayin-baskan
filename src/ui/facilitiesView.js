// src/ui/facilitiesView.js — TESİSLER "kulüp kampüsü" (görsel şölen v2):
// tam ekran 3×2 pano, SVG ikonlu 3B plakalar, LED seviye şeridi, ihale sahnesi.
// Kaydırma yok — 6 tesis viewport'u doldurur.
import { fmt } from './frame.js';
import { upgradeCost, canUpgrade, effectiveUpgradeCost, facilityDiscountMult, FACILITIES } from '../engines/facilities.js';

const AD = {
  stadyum: 'Stadyum', antrenman: 'Antrenman Tesisi', tibbi: 'Tıbbi Merkez',
  akademi: 'Akademi', scout: 'Gözlemci Ağı', ticari: 'Ticari Ofis',
};
const ETKI = {
  stadyum: 'Ev avantajı, kapasite ve isim hakkı geliri (sv≥7). Tribün büyüdükçe şehir arkanda.',
  antrenman: 'Oyuncular hızlı gelişir, kondisyon çabuk toparlar. Formun mutfağı.',
  tibbi: 'Sakatlıklar kısalır, riski düşer. Revir boş kalır, kadro sahada kalır.',
  akademi: 'Genç üretimi ve altyapı gücü. Vitrinin de vaatlerin de kaynağı.',
  scout: 'Transfer isabeti ve hedef kalitesi artar; oyuncu güçleri netleşir (gözlem sisi daralır).',
  ticari: 'Sponsor ve forma geliri büyür. Kasanın sessiz ortağı.',
};
// ═══ TESİS SAHNELERİ — asset yok: prosedürel SVG "fotoğraf" (gece, kulüp renkli, seviyeye tepkili) ═══
// lvl 0-10 sahneye işler: stadyumun tribünü büyür, akademinin fidanları çoğalır, scout radarı genişler.
function sahne(f, lvl) {
  const dolu = Math.max(0, Math.min(10, lvl)) / 10;         // 0..1 gelişmişlik
  const S = SCENE[f]; return S ? S(dolu) : '';
}
const SCENE = {
  stadyum: (d) => `<svg class="tesis-sahne" viewBox="0 0 320 132" preserveAspectRatio="xMidYMax slice">
    <defs><radialGradient id="st-p" cx="50%" cy="130%" r="90%"><stop offset="0" stop-color="rgba(63,191,127,.4)"/><stop offset="1" stop-color="rgba(63,191,127,.03)"/></radialGradient>
    <linearGradient id="st-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(var(--club-rgb),.16)"/><stop offset="1" stop-color="transparent"/></linearGradient></defs>
    <rect width="320" height="132" fill="url(#st-sky)"/>
    <path d="M20 20 L20 ${58 - d * 10} M300 20 L300 ${58 - d * 10}" stroke="rgba(255,255,255,.25)" stroke-width="2"/>
    <rect x="10" y="14" width="20" height="8" rx="2" fill="var(--club-2)"/><rect x="290" y="14" width="20" height="8" rx="2" fill="var(--club-2)"/>
    <path d="M20 22 L-6 78 L46 78 Z" fill="rgba(240,205,110,${.05 + d * .12})"/><path d="M300 22 L274 78 L326 78 Z" fill="rgba(240,205,110,${.05 + d * .12})"/>
    <path d="M0 ${96 - d * 22} L70 ${60 - d * 18} L250 ${60 - d * 18} L320 ${96 - d * 22} L320 132 L0 132 Z" fill="rgba(255,255,255,.05)"/>
    <path d="M0 ${100 - d * 20} L70 ${66 - d * 16} L250 ${66 - d * 16} L320 ${100 - d * 20} L320 132 L0 132 Z" fill="rgba(6,10,20,.5)"/>
    <ellipse cx="160" cy="150" rx="150" ry="46" fill="url(#st-p)"/>
    <path d="M160 116 v40 M96 150 h128" stroke="rgba(255,255,255,.18)"/><circle cx="160" cy="150" r="18" fill="none" stroke="rgba(255,255,255,.18)"/>
  </svg>`,
  antrenman: (d) => `<svg class="tesis-sahne" viewBox="0 0 320 132" preserveAspectRatio="xMidYMax slice">
    <defs><radialGradient id="an-p" cx="50%" cy="120%" r="90%"><stop offset="0" stop-color="rgba(63,191,127,.32)"/><stop offset="1" stop-color="rgba(63,191,127,.03)"/></radialGradient></defs>
    <rect width="320" height="132" fill="url(#an-p)"/>
    <path d="M40 60 h60 v-14 h-60 Z" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="2"/>
    ${Array.from({ length: 3 + Math.round(d * 4) }, (_, i) => `<path d="M${120 + i * 26} 112 l6 14 h-12 Z" fill="rgba(240,160,48,${.5 + d * .4})"/>`).join('')}
    <path d="M30 118 h70 M30 108 h70 M30 98 h70" stroke="rgba(255,255,255,${.08 + d * .12})" stroke-width="2"/>
    <path d="M30 98 v22 M48 98 v22 M66 98 v22 M84 98 v22 M100 98 v22" stroke="rgba(255,255,255,${.06 + d * .1})"/>
    <circle cx="250" cy="60" r="8" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="2"/>
    <path d="M250 68 v40" stroke="rgba(255,255,255,.18)" stroke-width="2"/>
  </svg>`,
  tibbi: (d) => `<svg class="tesis-sahne" viewBox="0 0 320 132" preserveAspectRatio="xMidYMid slice">
    <defs><radialGradient id="tb-g" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="rgba(224,82,82,.14)"/><stop offset="1" stop-color="transparent"/></radialGradient></defs>
    <rect width="320" height="132" fill="url(#tb-g)"/>
    <path d="M20 74 h90 l14 -30 18 60 16 -46 12 24 h110" fill="none" stroke="rgba(224,82,82,${.5 + d * .4})" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <g transform="translate(250 60)"><rect x="-22" y="-22" width="44" height="44" rx="10" fill="rgba(255,255,255,.05)" stroke="rgba(224,82,82,.5)"/><path d="M-4 -14 h8 v10 h10 v8 h-10 v10 h-8 v-10 h-10 v-8 h10 Z" fill="var(--pos)" opacity="${.4 + d * .5}"/></g>
    <circle cx="60" cy="40" r="2.5" fill="var(--pos)"/><circle cx="120" cy="96" r="2.5" fill="var(--pos)"/>
  </svg>`,
  akademi: (d) => `<svg class="tesis-sahne" viewBox="0 0 320 132" preserveAspectRatio="xMidYMax slice">
    <defs><linearGradient id="ak-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(var(--club-rgb),.14)"/><stop offset="1" stop-color="transparent"/></linearGradient></defs>
    <rect width="320" height="132" fill="url(#ak-g)"/>
    <g transform="translate(60 44)"><path d="M-26 4 L0 -8 L26 4 L0 16 Z" fill="var(--club)" opacity=".8"/><path d="M0 16 v12" stroke="var(--club-2)" stroke-width="2"/><circle cx="0" cy="30" r="3" fill="var(--club-2)"/><path d="M14 10 v10" stroke="var(--club-2)" stroke-width="1.5"/></g>
    ${Array.from({ length: 3 + Math.round(d * 5) }, (_, i) => { const x = 130 + i * 24; const h = 24 + (i % 3) * 10 + d * 14; return `<g transform="translate(${x} ${120})"><path d="M0 0 v-${h}" stroke="rgba(63,191,127,${.4 + d * .4})" stroke-width="2.5"/><path d="M0 -${h} q-9 -6 -14 -${h * .5 + 4}" fill="none" stroke="rgba(63,191,127,.5)" stroke-width="2"/><path d="M0 -${h * .7} q9 -5 14 -${h * .4 + 3}" fill="none" stroke="rgba(63,191,127,.5)" stroke-width="2"/></g>`; }).join('')}
    <path d="M20 120 h280" stroke="rgba(255,255,255,.1)"/>
  </svg>`,
  scout: (d) => `<svg class="tesis-sahne" viewBox="0 0 320 132" preserveAspectRatio="xMidYMid slice">
    <defs><radialGradient id="sc-g" cx="30%" cy="55%" r="75%"><stop offset="0" stop-color="rgba(78,143,217,.16)"/><stop offset="1" stop-color="transparent"/></radialGradient></defs>
    <rect width="320" height="132" fill="url(#sc-g)"/>
    <g transform="translate(70 66)" fill="none" stroke="rgba(78,143,217,${.3 + d * .3})" stroke-width="1.5">
      ${[16, 32, 48, 64].map((r, i) => `<circle r="${r}" opacity="${1 - i * .18}"/>`).join('')}
      <line x1="-64" y1="0" x2="64" y2="0"/><line x1="0" y1="-64" x2="0" y2="64"/></g>
    <g transform="translate(70 66)"><path d="M0 0 L${52 * Math.cos(-.6)} ${52 * Math.sin(-.6)} A52 52 0 0 1 52 0 Z" fill="rgba(78,143,217,${.1 + d * .15})"/></g>
    ${Array.from({ length: 2 + Math.round(d * 4) }, (_, i) => { const px = 120 + (i * 47) % 180, py = 30 + (i * 53) % 80; return `<g transform="translate(${px} ${py})"><path d="M0 0 c-6 -8 -6 -14 0 -18 c6 4 6 10 0 18 Z" fill="var(--club-2)" opacity="${.5 + d * .4}"/><circle cx="0" cy="-11" r="3" fill="rgba(6,10,20,.7)"/></g>`; }).join('')}
  </svg>`,
  ticari: (d) => `<svg class="tesis-sahne" viewBox="0 0 320 132" preserveAspectRatio="xMidYMax slice">
    <defs><linearGradient id="tc-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(var(--club-rgb),.16)"/><stop offset="1" stop-color="transparent"/></linearGradient></defs>
    <rect width="320" height="132" fill="url(#tc-g)"/>
    ${Array.from({ length: 5 }, (_, i) => { const x = 30 + i * 40, h = 30 + ((i * 37) % 50) + d * 24; return `<rect x="${x}" y="${120 - h}" width="28" height="${h}" rx="2" fill="rgba(255,255,255,${.04 + d * .05})" stroke="rgba(var(--club-rgb),.2)"/>${Array.from({ length: Math.round(h / 14) }, (_, j) => `<rect x="${x + 5}" y="${118 - h + 6 + j * 12}" width="6" height="5" fill="rgba(240,205,110,${.2 + d * .5})"/><rect x="${x + 16}" y="${118 - h + 6 + j * 12}" width="6" height="5" fill="rgba(240,205,110,${.15 + d * .4})"/>`).join('')}`; }).join('')}
    <path d="M24 92 l40 -22 34 12 44 -34 40 14" fill="none" stroke="var(--pos)" stroke-width="2.5" opacity="${.5 + d * .4}"/>
    <path d="M186 82 l16 -6 -2 16" fill="none" stroke="var(--pos)" stroke-width="2.5" opacity="${.5 + d * .4}"/>
    <circle cx="270" cy="46" r="14" fill="none" stroke="var(--club-2)" stroke-width="2"/><text x="270" y="52" text-anchor="middle" font-size="18" font-weight="800" fill="var(--club-2)" opacity="${.4 + d * .5}">₺</text>
  </svg>`,
};
const _svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const IKON = {
  stadyum: _svg('<path d="M3 10c0-2.2 4-4 9-4s9 1.8 9 4v4c0 2.2-4 4-9 4s-9-1.8-9-4z"/><path d="M3 10c0 2.2 4 4 9 4s9-1.8 9-4"/><path d="M7.5 6.8V4.5M16.5 6.8V4.5M12 6V3.5"/>'),
  antrenman: _svg('<path d="M12 5.5L6 19h12z"/><path d="M9 12.5h6"/><circle cx="12" cy="3.8" r="1.3"/>'),
  tibbi: _svg('<path d="M12 3.5l7 2.5v5c0 4.4-2.8 7.2-7 9.5-4.2-2.3-7-5.1-7-9.5v-5z"/><path d="M12 8v6M9 11h6"/>'),
  akademi: _svg('<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.8V16c0 1.2 2.5 2.5 5.5 2.5s5.5-1.3 5.5-2.5v-4.2"/><path d="M21 10v5"/>'),
  scout: _svg('<circle cx="10" cy="10.5" r="5.5"/><path d="M14.2 14.7L20 20.5"/><path d="M7.8 10.5a2.2 2.2 0 012.2-2.2"/>'),
  ticari: _svg('<circle cx="9" cy="9" r="5"/><path d="M9 6.8v4.4M7.5 8h3"/><path d="M14.5 13.5a5 5 0 105 5"/><path d="M13 20h7M16.5 16.5v3.5"/>'),
};

export function render(G) {
  // ── İHALE SAHNESİ: 3 firma teklifi — büyük karar anı ──
  if (G.tender) {
    const t = G.tender;
    const offers = t.offers.map((o, i) => `<div class="ihale-kart ${o.type === 'B' ? 'vurgulu' : ''}">
      <div class="overline">Teklif ${o.type} · ${o.firm}</div>
      <div class="ihale-bedel led">${fmt(o.cost)}<i>mn</i></div>
      <div class="ihale-desc">${o.desc}</div>
      <button class="cx-btn ${o.type === 'B' ? 'on' : ''}" data-act="tender" data-arg="${i}" ${G.economy.kasa < o.cost ? 'disabled' : ''}>${G.economy.kasa < o.cost ? 'Kasa yetmiyor' : 'Bu firmayı seç'}</button>
    </div>`).join('');
    return `<div class="tesis-wrap tesis-ihale">
      <div class="tesis-head">
        <div><div class="overline">Tesis İhalesi · ${AD[t.tesis] || t.tesis}</div><h2>Firma Teklifleri</h2></div>
        <span class="tesis-kasa"><i>KASA</i><b>${fmt(G.economy.kasa)}mn</b></span>
      </div>
      <div class="ihale-grid">${offers}</div>
      <div class="btnrow" style="justify-content:center"><button class="cx-btn" data-act="tenderCancel">İhaleden vazgeç</button></div>
    </div>`;
  }

  // ── KAMPÜS PANOSU: 6 tesis, tam ekran ──
  const cards = FACILITIES.map((f) => {
    const lvl = G.facilities[f];
    const disc = facilityDiscountMult(G, f);
    const cost = effectiveUpgradeCost(G, f);
    const ok = canUpgrade(G, f);
    const maks = lvl >= 10;
    const segs = Array.from({ length: 10 }, (_, i) => `<span class="seg ${i < lvl ? 'dolu' : ''}"></span>`).join('');
    const indirim = disc < 0.999
      ? `<span class="tesis-indirim">−%${Math.round((1 - disc) * 100)} <s>${fmt(upgradeCost(f, lvl))}mn</s></span>` : '';
    return `<div class="tesis-kart">
      <div class="tesis-kart-ust">
        <span class="tesis-ikon">${IKON[f] || ''}</span>
        <div class="tesis-ad"><b>${AD[f] || f}</b><i>SEVİYE ${lvl}/10</i></div>
        <span class="tesis-lvl led">${lvl}</span>
      </div>
      <div class="tesis-seviye">${segs}</div>
      <div class="tesis-etki">${ETKI[f]}</div>
      <div class="tesis-sahne-wrap">${sahne(f, lvl)}</div>
      <div class="tesis-alt">
        ${indirim}
        <button class="cx-btn tesis-btn ${ok ? '' : 'kilit'}" data-act="upgrade" data-arg="${f}" ${ok ? '' : 'disabled'}
          data-tip="${maks ? 'Maksimum seviye' : ok ? 'İhale aç — 3 firma teklif getirir' : 'Kasa yetersiz'}">
          ${maks ? 'TAMAMLANDI' : `İHALE AÇ · ~${fmt(cost)}mn`}
        </button>
      </div>
    </div>`;
  }).join('');
  // KADIN TAKIMI ŞUBESİ — "Kadın Takımını Kuracağım" sözünün gerçek mekaniği
  const kt = G.womensTeam && G.womensTeam.active;
  const kadinSerit = `<div class="tesis-kadin ${kt ? 'aktif' : ''}">
    <span class="tesis-ikon">⚽</span>
    <div class="tesis-ad"><b>Kadın Futbol Şubesi</b><i>${kt ? `KURULDU · Sezon ${G.womensTeam.kurulusSezon}` : 'KURULMADI'}</i></div>
    ${kt
    ? '<span class="badge" style="margin-left:auto">aktif — camia gururlu</span>'
    : `<button class="cx-btn" data-act="kadinTakim" style="margin-left:auto" ${G.economy.kasa < 8 ? 'disabled' : ''} data-tip="Kuruluş 8mn + haftalık bakım. Taraftar +3, itibar +2; 'Kadın Takımını Kuracağım' sözünü tutar">Kur · 8mn</button>`}
  </div>`;
  return `<div class="tesis-wrap">
    <div class="tesis-head">
      <div><div class="overline">Tesisler · Kulüp Kampüsü</div><h2>Altyapı Yatırımı</h2></div>
      <span class="tesis-kasa" data-tip="Yatırıma hazır nakit"><i>KASA</i><b>${fmt(G.economy.kasa)}mn</b></span>
    </div>
    <div class="tesis-grid">${cards}</div>
    ${kadinSerit}
  </div>`;
}
