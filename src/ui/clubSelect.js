// src/ui/clubSelect.js — AÇILIŞ ZİNCİRİ Sahne 1: oyunun kapısı.
// Topbar yok (1a) · saha silueti + projektör huzmeleri (1b) · LORE anlatan kartlar (1c) ·
// mikro-SVG ikonlar (1d) · mod tooltip'leri (1e) · hover'da sahne kulüp rengine boyanır +
// uğultu (1f) · SINIRSIZ yeniden çevirme (1g) · "İlk kez mi?" satırı (1h).
import { TIERS, TUNING } from '../config.js';
import { fmt, esc } from './frame.js';
import { MODES } from '../engines/meta.js';
import { clubPalette } from './theme.js';

const DEF_RENK = { kucuk: '#2E7D5B', orta: '#D4A62A', buyuk: '#7B1E3B' };
// Varsayılan üçlünün lore'ları (teams.json havuz kulüpleri kendi lore'unu taşır)
const DEF_LORE = {
  kucuk: 'Göl kenarında iki kuşaktır sönmeyen bir ocak. Tribün elli kişi, borç birkaç kuruş, beklenti sıfır. Kimse senden bir şey ummuyor — istediğin hikâyeyi yazacak kadar boş bir sayfa.',
  orta: 'Şehrin orta direği. Ne dev ne cüce; tribün kalabalık, kasa idare eder. Yıllardır aynı cümleyi duyuyor: "Bu takım daha iyisini hak ediyor." Ediyor mu, sen göstereceksin.',
  buyuk: 'Vitrin kupa dolu, kasa bomboş. Kadro pahalı, borç dağ gibi, sabır ise çoktan tükendi. Burada üç maç kazanırsan efsanesin, üç maç kaybedersen "istifa" tezahüratı seninle.',
};

// 1d: 1px stroke mikro-SVG ikon seti (güç/kasa/kadro/beklenti) — emoji yok
const IKO = {
  guc: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1"><path d="M7 1L3 7h3l-1 4 4-6H6l1-4z"/></svg>',
  kasa: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1"><circle cx="6" cy="6" r="4.5"/><path d="M6 3.5v5M4.5 5h3M4.5 7h3"/></svg>',
  kadro: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1"><circle cx="4" cy="4" r="1.8"/><circle cx="8.5" cy="4.5" r="1.4"/><path d="M1.5 10c0-2 1.2-3 2.5-3s2.5 1 2.5 3M7 9.5c.2-1.4 1-2.2 1.8-2.2S10.8 8.2 11 9.5"/></svg>',
  beklenti: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1"><circle cx="6" cy="6" r="4.5"/><circle cx="6" cy="6" r="2"/><path d="M6 1v2M6 9v2M1 6h2M9 6h2"/></svg>',
};
const beklentiTr = { kumede_kal: 'Küme hattından uzak dur', ust_yari: 'Üst yarıya otur', sampiyonluk: 'Kupayı kaldır' };
// Tier etiketleri: TAŞRA/ŞEHİR/DEV (orta kartta rozet gösterildiği için ŞEHİR yalnızca senaryo kartında görünür)
const ETIKET = { kucuk: 'TAŞRA', orta: 'ŞEHİR', buyuk: 'DEV' };
const TAGS = {
  kucuk: 'Kasa dar, kadro zayıf — ama kimse sana hesap sormaz',
  orta: 'Ne dar ne bol — dengeli bir masa',
  buyuk: 'Borç ağır, sabır yok — ilk yenilgide manşetsin',
};

export function render(G) {
  const tab = G._selTab || 'kulup';
  const mode = G._modeSel || 'klasik';
  // 1e: mod butonlarında 2 cümlelik fark tooltip'i (Ironman uyarısı net)
  const MOD_TIP = {
    klasik: 'Oyunun tamamı. Hata yaparsan geri dönersin. İlk dönemin buradan geçsin.',
    ironman: 'Tek dönem, tek şans. Kayıt yok, geri sarma yok. Ağır rozetler yalnız burada dağıtılır.',
    vitrin: 'Kurul her dönem masaya bir hedef koyar. Tutturamazsan destek çekilir, koltuk sallanır.',
    aile: 'Kurul yok, kredi yok. Her açığı cebinden kaparsın. Servet biterse kulüp de sen de bitersin.',
  };
  const modBtns = Object.entries(MODES).map(([k, m]) =>
    `<button class="btn ${mode === k ? 'on' : ''}" data-act="setMode" data-arg="${k}" data-tip="${esc(MOD_TIP[k] || m.tanitim)}">${m.ad}</button>`).join('');
  const tabBtns = `<div class="btnrow" style="justify-content:center;margin:10px 0">
    <button class="btn ${tab === 'kulup' ? 'on' : ''}" data-act="selTab" data-arg="kulup">Kulüpler</button>
    <button class="btn ${tab === 'senaryo' ? 'on' : ''}" data-act="selTab" data-arg="senaryo">Dosyalar</button>
  </div>`;

  let body;
  if (tab === 'senaryo') {
    const scs = ((G.data.scenarios && G.data.scenarios.scenarios) || []);
    body = `<div class="tiers">${scs.map((sc) => `<button class="tier tier--senaryo" data-act="selectScenario" data-arg="${sc.id}">
      <div class="serit" style="--tc:var(--neg)"></div>
      <div class="micro" style="color:var(--neg)">${(ETIKET[sc.tier] || sc.tier.toUpperCase())} · AĞIR DOSYA</div>
      <h3 style="margin-top:6px">${esc(sc.ad)}</h3>
      <p class="lore">${esc(sc.tanitim)}</p>
      <span class="tag">🎯 ${esc(sc.hedef.metin)}</span>
    </button>`).join('')}</div>`;
  } else {
    const ids = G._identities || {};
    const cards = ['kucuk', 'orta', 'buyuk'].map((tier) => {
      const T = TIERS[tier], id = ids[tier];
      const isim = id ? id.name : { kucuk: 'Gölköy SK', orta: 'Yıldızspor', buyuk: 'Ezeli FK' }[tier];
      // 1c: LORE — havuz kulübü kendi hikâyesini, varsayılan kulüp tier hikâyesini anlatır
      const havuzLore = id && (G.data.teams || []).find((t) => t.name === id.name)?.lore;
      const lore = havuzLore || DEF_LORE[tier];
      const renk = clubPalette((id && id.renk) || DEF_RENK[tier]).club;
      return `<button class="tier" data-act="selectClub" data-arg="${tier}" style="--tc:${renk}"
        onmouseenter="document.querySelector('.gate').style.setProperty('--gate-glow','${renk}');globalThis.SBhover&&globalThis.SBhover()">
        <div class="serit"></div>
        <span class="rozet">${tier === 'orta' ? '<span class="badge" style="background:var(--pos);color:#10131C">yeni başkana göre</span>' : `<span class="micro">${ETIKET[tier]}</span>`}</span>
        <div class="arma">${esc((isim || 'K')[0])}</div>
        <h3>${esc(isim)}</h3>
        <p class="lore">${esc(lore)}</p>
        ${tier === 'orta' ? `<div class="micro" style="letter-spacing:.5px;text-transform:none;margin-bottom:6px;color:var(--ink-2)">İlk dönemin mi? ${esc(isim)} ile başla.</div>` : ''}
        <div class="stat-mini">
          <span data-tip="Takımın sahadaki gücü">${IKO.guc} ${T.temelGuc}</span>
          <span data-tip="Kasada ne var, sırtında ne var">${IKO.kasa} ${T.kasa}/${T.borc}mn</span>
          <span data-tip="Kadronun piyasadaki değeri">${IKO.kadro} ${fmt(T.kadroDeger)}mn</span>
          <span data-tip="Camia senden ne bekliyor">${IKO.beklenti} ${beklentiTr[T.beklenti]}</span>
        </div>
        ${id ? `<div class="stat-mini" style="margin-top:2px">
          <span>🏟 ${esc(id.stadName)}</span><span>· ${id.founded}</span><span>· ${esc(id.fanChar.ad)}</span>
        </div>` : ''}
        <span class="tag">${TAGS[tier]}</span>
      </button>`;
    }).join('');
    // 2. LİG BAŞLANGICI — en zor mod: küçük tier'dan BİR TIK DAHA düşük güç/kasa/kadro
    const T2 = TIERS.kucuk, D2 = TUNING.LEAGUE.LIG2_START, id2 = ids.lig2;
    const l2guc = T2.temelGuc - D2.gucDrop, l2kadro = Math.round(T2.kadroDeger * D2.kadroMult);
    const isim2 = id2 ? id2.name : 'Demiryolu SK';
    const renk2 = clubPalette((id2 && id2.renk) || '#C77B3B').club;
    const lig2Card = `<button class="tier tier--lig2" data-act="selectClub" data-arg="lig2" style="--tc:${renk2}"
      onmouseenter="document.querySelector('.gate').style.setProperty('--gate-glow','${renk2}');globalThis.SBhover&&globalThis.SBhover()">
      <div class="serit"></div>
      <div class="lig2-arma">${esc((isim2 || 'D')[0])}</div>
      <div class="lig2-orta">
        <div class="lig2-head"><span class="lig2-rozet">2. LİG · DİPTEN</span><h3>${esc(isim2)}</h3></div>
        <p class="lore">Kupa günleri fotoğraflarda kaldı. Kulüp 2. lige demir attı, bütçe cılız, tribün sabırsız. Yayından üç kuruş, sponsordan hiç. Tek bir yol var: yukarı. <b>İlk üçe gireceksin</b> — ya da bu lig sana ev olacak.</p>
        <div class="stat-mini">
          <span data-tip="Takımın sahadaki gücü">${IKO.guc} ${l2guc}</span>
          <span data-tip="Kasada ne var, sırtında ne var">${IKO.kasa} ${D2.kasa}/${D2.borc}mn</span>
          <span data-tip="Kadronun piyasadaki değeri">${IKO.kadro} ${fmt(l2kadro)}mn</span>
          <span data-tip="Hedef">${IKO.beklenti} Yukarı çık — ilk 3</span>
          <span data-tip="Lig geliri">📉 Yayın cılız, sponsor uzak, gişe zayıf</span>
        </div>
      </div>
    </button>`;
    body = `<div class="tiers">${cards}</div>
      ${lig2Card}
      <div style="margin-top:14px">
        <button class="btn" data-act="reroll">🎲 Masaya yeni dosyalar gelsin</button>
        <div class="muted" style="font-size:11px;margin-top:4px">İstediğin kadar çevir. Her dosyada başka bir isim, başka bir hikâye, başka bir tribün çıkar.</div>
      </div>`;
  }

  return `<div class="scene gate" style="max-width:1000px;text-align:center">
    <div class="overline">Devir Teslim</div>
    <h1 style="margin:6px 0 0;color:var(--club-2)">SAYIN BAŞKAN</h1>
    <div class="cizgi"></div>
    <p class="muted" style="margin:10px 0 0;font-style:italic">Kongre dağıldı. Mühür hâlâ masada.</p>
    ${G._devamVar ? `<div class="devam-banner">
      <span>💾 Kayıtlı kariyer: <b>${esc(G._devamVar.club)}</b> · Sezon ${G._devamVar.season}, Hafta ${G._devamVar.week}</span>
      <button class="devam" data-act="contSave" style="padding:8px 20px;font-size:13px">Devam Et ►</button>
      <button class="btn" data-act="contSil" data-tip="Kayıtlı kariyeri sil" style="padding:6px 10px;font-size:11px">🗑</button>
    </div>` : ''}
    <div class="btnrow" style="justify-content:center;margin-top:14px">${modBtns}</div>
    <div class="muted" style="font-size:12px;margin-top:4px">${esc(MODES[mode].tanitim)}</div>
    ${tabBtns}
    ${body}
  </div>`;
}
