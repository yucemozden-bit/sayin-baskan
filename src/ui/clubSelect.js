// src/ui/clubSelect.js — AÇILIŞ / KULÜP SEÇİMİ ("SAYIN BAŞKAN") — sb- görsel katman (2026-07 Design uyarlaması).
// Kariyerin kapısı: kayıtlı kariyer · mod seçimi · Kulüpler/Dosyalar sekmeleri · kulüp kartları (stat grid) ·
// 2. lig dip başlangıcı · sınırsız yeniden çevirme. Topbar yok (kariyer henüz başlamadı).
import { TIERS, TUNING } from '../config.js';
import { fmt, esc } from './frame.js';
import { MODES } from '../engines/meta.js';
import { clubPalette } from './theme.js';

const DEF_RENK = { kucuk: '#2E7D5B', orta: '#D4A62A', buyuk: '#7B1E3B' };
const DEF_LORE = {
  kucuk: 'Göl kenarında iki kuşaktır sönmeyen bir ocak. Tribün elli kişi, borç birkaç kuruş, beklenti sıfır — istediğin hikâyeyi yazacak boş bir sayfa.',
  orta: 'Şehrin orta direği. Ne dev ne cüce; tribün kalabalık, kasa idare eder. "Bu takım daha iyisini hak ediyor" — sen göstereceksin.',
  buyuk: 'Vitrin kupa dolu, kasa bomboş. Üç maç kazanırsan efsane, üç maç kaybedersen "istifa" tezahüratı seninle.',
};
const ETIKET = { kucuk: 'TAŞRA', orta: 'ŞEHİR', buyuk: 'DEV' };
const TIP_TR = { kucuk: 'Taşra', orta: 'Şehir takımı', buyuk: 'Dev' };
const ZORLUK_KULUP = { kucuk: 'Kolay', orta: 'Orta', buyuk: 'Zor', lig2: 'Çok Zor' };
const beklentiTr = { kumede_kal: 'Küme hattından uzak dur', ust_yari: 'Üst yarıya otur', sampiyonluk: 'Kupayı kaldır' };
const TAGS = {
  kucuk: 'Kasa dar, kadro zayıf — ama kimse sana hesap sormaz',
  orta: 'Ne dar ne bol — dengeli bir masa',
  buyuk: 'Borç ağır, sabır yok — ilk yenilgide manşetsin',
};
const fanFmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'mn' : n >= 1000 ? Math.round(n / 1000) + ' bin' : String(n));
const stadFmt = (n) => Math.round(n).toLocaleString('tr-TR');

function statGrid(rows) {
  return `<div class="sb-cc-stats">${rows.map(([k, v, cls]) => `<div class="sb-cc-stat"><span>${k}</span><b class="${cls || ''}">${v}</b></div>`).join('')}</div>`;
}

export function render(G) {
  const tab = G._selTab || 'kulup';
  const mode = G._modeSel || 'klasik';
  const ids = G._identities || {};
  const modBtns = Object.entries(MODES).map(([k, m]) =>
    `<button class="sb-mode ${mode === k ? 'is-active' : ''}" data-act="setMode" data-arg="${k}" data-tip="${esc(m.tanitim)}">${esc(m.ad)}</button>`).join('');

  // — Kulüp kartı —
  const clubCard = (tier) => {
    const T = TIERS[tier], id = ids[tier];
    const isim = id ? id.name : { kucuk: 'Gölköy SK', orta: 'Yıldızspor', buyuk: 'Ezeli FK' }[tier];
    const havuzLore = id && (G.data.teams || []).find((t) => t.name === id.name)?.lore;
    const lore = havuzLore || DEF_LORE[tier];
    const renk = clubPalette((id && id.renk) || DEF_RENK[tier]).club;
    const tag = tier === 'orta' ? '<span class="sb-cc-yeni">yeni başkana göre</span>' : `<span class="sb-cc-etiket">${ETIKET[tier]}</span>`;
    return `<button class="sb-club-card ${tier === 'orta' ? 'is-featured' : ''}" data-act="selectClub" data-arg="${tier}" style="--tc:${renk}">
      <div class="sb-cc-strip"></div>
      <div class="sb-cc-head">
        <span class="sb-cc-badge">${esc((isim || 'K')[0])}</span>
        <div class="sb-cc-title"><b>${esc(isim)}</b><i>1. Lig · ${TIP_TR[tier]}</i></div>
        ${tag}
      </div>
      <p class="sb-cc-lore">${esc(lore)}</p>
      ${statGrid([
      ['GÜÇ', T.temelGuc], ['STADYUM', stadFmt(T.stad)],
      ['BÜTÇE', `${fmt(T.kasa)}mn`], ['BORÇ', `${fmt(T.borc)}mn`, T.borc > 40 ? 'neg' : T.borc < 20 ? 'pos' : ''],
      ['TARAFTAR', fanFmt(T.fan)], ['ZORLUK', ZORLUK_KULUP[tier]],
    ])}
      <div class="sb-cc-hedef">◎ Hedef: <b>${beklentiTr[T.beklenti]}</b></div>
      <div class="sb-cc-note">✦ ${TAGS[tier]}</div>
    </button>`;
  };

  let body;
  if (tab === 'senaryo') {
    const scs = ((G.data.scenarios && G.data.scenarios.scenarios) || []);
    body = `<div class="sb-club-grid">${scs.map((sc) => `<button class="sb-club-card sb-club-senaryo" data-act="selectScenario" data-arg="${sc.id}" style="--tc:var(--neg)">
      <div class="sb-cc-strip"></div>
      <div class="sb-cc-head"><span class="sb-cc-badge">${esc((sc.ad || 'D')[0])}</span><div class="sb-cc-title"><b>${esc(sc.ad)}</b><i>${ETIKET[sc.tier] || (sc.tier || '').toUpperCase()} · Ağır Senaryo</i></div><span class="sb-cc-etiket" style="color:var(--neg)">SENARYO</span></div>
      <p class="sb-cc-lore">${esc(sc.tanitim)}</p>
      <div class="sb-cc-hedef">◎ Hedef: <b>${esc(sc.hedef.metin)}</b></div>
    </button>`).join('')}</div>`;
  } else {
    // 2. Lig dip kartı (geniş)
    const T2 = TIERS.kucuk, D2 = TUNING.LEAGUE.LIG2_START, id2 = ids.lig2;
    const l2guc = T2.temelGuc - D2.gucDrop, l2kadro = Math.round(T2.kadroDeger * D2.kadroMult);
    const isim2 = id2 ? id2.name : 'Demiryolu SK';
    const renk2 = clubPalette((id2 && id2.renk) || '#C77B3B').club;
    const lig2Card = `<button class="sb-club-card sb-club-lig2" data-act="selectClub" data-arg="lig2" style="--tc:${renk2}">
      <div class="sb-cc-strip"></div>
      <span class="sb-cc-badge sb-cc-badge-lg">${esc((isim2 || 'D')[0])}</span>
      <div class="sb-lig2-mid">
        <div class="sb-cc-head sb-lig2-head"><span class="sb-cc-etiket sb-lig2-rozet">2. LİG · DİPTEN</span><div class="sb-cc-title"><b>${esc(isim2)}</b></div></div>
        <p class="sb-cc-lore">Kupa günleri fotoğraflarda kaldı. Tek yol yukarı: <b>ilk üçe gireceksin</b> — ya da bu lig sana ev olur. Yayın cılız, sponsor uzak, gişe zayıf.</p>
      </div>
      ${statGrid([
      ['GÜÇ', l2guc], ['STADYUM', stadFmt(Math.round(T2.stad * 0.4))],
      ['BÜTÇE', `${fmt(D2.kasa)}mn`], ['BORÇ', `${fmt(D2.borc)}mn`, 'pos'],
      ['TARAFTAR', fanFmt(Math.round(T2.fan * 0.3))], ['ZORLUK', ZORLUK_KULUP.lig2, 'neg'],
    ])}
    </button>`;
    body = `<div class="sb-club-grid">${['kucuk', 'orta', 'buyuk'].map(clubCard).join('')}</div>
      ${lig2Card}
      <div class="sb-gate-reroll">
        <button class="sb-btn" data-act="reroll">🎲 Masaya yeni dosyalar gelsin</button>
        <span class="sb-muted">İstediğin kadar çevir — her dosyada başka bir isim, başka bir hikâye.</span>
      </div>`;
  }

  const savedBar = G._devamVar ? `<div class="sb-saved">
      <span class="sb-saved-lbl">🖫 Kayıtlı kariyer: <b>${esc(G._devamVar.club)}</b> · Sezon ${G._devamVar.season}, Hafta ${G._devamVar.week}</span>
      <button class="sb-btn sb-btn-primary sb-btn-sm" data-act="contSave">Devam Et ▾</button>
      <button class="sb-mode sb-saved-sil" data-act="contSil" data-tip="Kayıtlı kariyeri sil">🗑</button>
      <span class="sb-saved-div"></span>
    </div>` : '';

  return `<div class="sb-root sb-gate">
    <div class="sb-atmo"></div><div class="sb-vignette"></div>
    <div class="sb-gate-wrap">
      <div class="sb-kicker">DEVİR TESLİM</div>
      <h1 class="sb-hero">SAYIN <span class="sb-hero-accent">BAŞKAN</span></h1>
      <p class="sb-hero-sub">Kongre dağıldı. Mühür hâlâ masada.</p>
      <div class="sb-gate-bar">${savedBar}${modBtns}</div>
      <div class="sb-gate-tabs">
        <button class="sb-tab ${tab === 'kulup' ? 'is-active' : ''}" data-act="selTab" data-arg="kulup">Kulüpler</button>
        <button class="sb-tab ${tab === 'senaryo' ? 'is-active' : ''}" data-act="selTab" data-arg="senaryo">Senaryolar</button>
        <span class="sb-muted sb-gate-tabnote">${esc(MODES[mode].tanitim)}</span>
      </div>
      <div class="sb-gate-body">${body}</div>
    </div>
  </div>`;
}
