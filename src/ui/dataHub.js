// src/ui/dataHub.js — VERİ MERKEZİ (FM tarzı, tam ekran analitik pano): KPI şeridi +
// sezon geçmişi + ekonomi grafiği + göstergeler + telkin karnesi + taraftar duyarlılığı.
import { fmt, gaugesBlock } from './frame.js';
import { telkinKarne } from '../actions.js';
import { boyutCard } from './congress.js';

const KARNE_TR = {
  tamkadro: 'Tam kadro', rotasyon: 'Rotasyon', gencler: 'Gençler', kale: 'Kalemizi koruyalım',
  'ht:soyunma': 'Soyunma odasına indi', 'ht:tribun': 'Tribünü ateşledi', 'ht:tdguven': "TD'ye güvendi",
  'late:dok': 'Her şeyi öne döktü', 'late:koru': 'Son dakikaları korudu',
};

function karneCard(G) {
  const canli = telkinKarne(G.telkinLog);
  const satirlar = Object.entries(canli).map(([k, v]) =>
    `<div class="l"><span>${KARNE_TR[k] || k}</span><b class="tnum">${v.n}<span class="muted" style="font-weight:normal;margin-left:5px">${v.W}G·${v.D}B·${v.L}M</span></b></div>`).join('');
  const toplam = (G.telkinLog || []).length;
  const gecen = G.lastSeason && G.lastSeason.telkinKarne;
  const gecenSatir = gecen && Object.keys(gecen).length
    ? `<div class="muted" style="font-size:11px;margin-top:8px;border-top:1px solid var(--line);padding-top:6px">Geçen sezon: ${Object.entries(gecen).map(([k, v]) => `${KARNE_TR[k] || k} ${v.n}`).join(' · ')}</div>` : '';
  return `<div class="card"><div class="overline">Telkin Karnesi <span class="muted" style="float:right;font-size:11px">${toplam} müdahale</span></div>
    <div class="fin-lines dh-fade" style="margin-top:6px">${satirlar || '<div class="muted" style="font-size:12px">Bu sezon hiç karışmadın — TD not etti: "sakin başkan".</div>'}</div>
    ${gecenSatir}</div>`;
}

// FM tarzı KPI karosu
function kpi(label, val, sub, tone) {
  return `<div class="dh-kpi ${tone || ''}"><i>${label}</i><b>${val}</b>${sub ? `<em>${sub}</em>` : ''}</div>`;
}

// Son form pulları (G.recent: 0=M, 1=B, 3=G)
function formStrip(G) {
  const son = (G.recent || []).slice(-6);
  if (!son.length) return '';
  const pul = (r) => r === 3 ? '<span class="w">G</span>' : r === 1 ? '<span class="d">B</span>' : '<span class="l">M</span>';
  return `<div class="dh-form">${son.map(pul).join('')}</div>`;
}

export function render(G) {
  const seasons = (G.history && G.history.seasons) || [];
  const rows = seasons.map((s, i) => {
    const av = (s.GF != null && s.GA != null) ? `${s.GF}:${s.GA}` : '—';
    const l2 = (s.lig || 1) === 2;
    const durum = l2 ? (s.pos <= 3 ? '⬆️' : '2.L') : (s.champion ? '🏆' : s.pos <= 4 ? '⭐' : s.pos >= 16 ? '⚠' : '·');
    return `<tr>
      <td>S${i + 1}${l2 ? ' <span class="dh-lig2tag">2.L</span>' : ''}</td><td class="tnum" style="color:var(--club-2);font-weight:700">${s.pos}.</td>
      <td class="tnum">${s.W}-${s.D}-${s.L}</td><td class="tnum muted">${av}</td>
      <td>${durum}</td></tr>`;
  }).join('');

  const led = G.lastLedger;
  const p = G.power || {};
  const pos = G.myPos || '—', hedef = G.club.hedefSira;
  const sent = G.sentiment;
  const mt = G.mediaTone || 0;
  const kasa = G.economy.kasa, borc = G.economy.borc;

  // KPI ŞERİDİ
  const lig2 = (G.lig || 1) === 2;
  const hero = `<div class="dh-hero">
    ${kpi(lig2 ? '2. Lig Sırası' : 'Lig Sırası', `${pos}${pos !== '—' ? '.' : ''}`, lig2 ? 'terfi: ilk 3' : `hedef ${hedef}.`, (typeof pos === 'number' && pos <= hedef) ? 'pos' : (typeof pos === 'number' && pos >= 16 && !lig2) ? 'neg' : '')}
    ${kpi('Takım Gücü', Math.round(p.efektif || 0), `temel ${Math.round(p.temel || 0)}`, 'accent')}
    ${kpi('Kasa', fmt(kasa), 'mn', kasa >= 0 ? 'pos' : 'neg')}
    ${kpi('Borç', fmt(borc), 'mn', borc > kasa * 1.5 ? 'neg' : '')}
    ${kpi('Net / Hafta', led ? `${led.net >= 0 ? '+' : ''}${fmt(led.net)}` : '—', 'mn', led ? (led.net >= 0 ? 'pos' : 'neg') : '')}
    ${kpi('Sosyal Nabız', sent != null ? `${Math.round(sent)}` : '—', sent != null ? (sent > 20 ? '🟢 coşkulu' : sent < -20 ? '🔴 gergin' : '⚪ dengeli') : '', sent != null ? (sent > 20 ? 'pos' : sent < -20 ? 'neg' : '') : '')}
  </div>`;

  // EKONOMİ — çift bar grafiği
  let ekoBlok;
  if (led) {
    const g = led.gelir.toplam, gd = led.gider.toplam, mx = Math.max(g, gd, 1);
    ekoBlok = `<div class="dh-bars">
      <div class="dh-bar gelir"><div class="dh-bar-top"><span>Gelir</span><b class="tnum pos">${fmt(g)}mn</b></div><div class="dh-bar-tr"><i style="width:${Math.round(g / mx * 100)}%"></i></div></div>
      <div class="dh-bar gider"><div class="dh-bar-top"><span>Gider</span><b class="tnum neg">${fmt(gd)}mn</b></div><div class="dh-bar-tr"><i style="width:${Math.round(gd / mx * 100)}%"></i></div></div>
      <div class="dh-net"><span>Haftalık net</span><b class="tnum ${led.net >= 0 ? 'pos' : 'neg'}">${led.net >= 0 ? '+' : ''}${fmt(led.net)}mn</b></div>
    </div>`;
  } else {
    ekoBlok = '<div class="muted" style="font-size:12px;padding:10px 0">İlk maç oynanınca haftalık bilanço burada.</div>';
  }

  return `<div class="dh-wrap">
    <div class="tr-head">
      <div><div class="overline">Veri Merkezi</div><h2 style="margin:2px 0 0">Analitik</h2></div>
      <span class="tesis-kasa" style="border-color:var(--line)"><i>SEZON</i><b style="color:var(--ink-1);font-size:15px">S${G.worldSeason || 1} · H${G.meta.week} · D${G.meta.term}</b></span>
    </div>
    ${hero}
    <div class="dh-grid">
      <div class="dh-col">
        <div class="card dh-tall">
          <div class="overline">Sezon Geçmişi <span style="float:right">${formStrip(G)}</span></div>
          <div class="dh-table-wrap dh-fade">
            <table class="dh-table"><thead><tr><th>Sezon</th><th>Sıra</th><th>G-B-M</th><th>Averaj</th><th></th></tr></thead>
            <tbody>${rows || '<tr><td class="muted" colspan="5" style="padding:14px 0">Henüz tamamlanmış sezon yok — ilk sezonu bitir, tarihin burada birikecek.</td></tr>'}</tbody></table>
          </div>
        </div>
      </div>
      <div class="dh-col">
        <div class="card"><div class="overline">Göstergeler</div><div style="margin-top:6px">${gaugesBlock(G.gauges)}</div></div>
        <div class="card dh-tall"><div class="overline">Ekonomi <span class="muted" style="float:right;font-size:11px">bu hafta</span></div>${ekoBlok}
          <div class="fin-lines" style="margin-top:auto;border-top:1px solid var(--line);padding-top:6px">
            <div class="l"><span>Kasa</span><b class="tnum ${kasa >= 0 ? 'pos' : 'neg'}">${fmt(kasa)}mn</b></div>
            <div class="l"><span>Borç</span><b class="tnum">${fmt(borc)}mn</b></div>
            <div class="l"><span>Medya tonu</span><b class="tnum">${mt.toFixed(1)} ${mt > 0.5 ? '🟢' : mt < -0.5 ? '🔴' : '⚪'}</b></div>
          </div>
        </div>
      </div>
      <div class="dh-col">
        ${karneCard(G)}
        ${boyutCard(G)}
      </div>
    </div>
  </div>`;
}
