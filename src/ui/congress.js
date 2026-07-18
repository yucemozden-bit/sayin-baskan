// src/ui/congress.js — Kongre & seçim paneli (V3-C8 + §4 cila):
// oy projeksiyonu TREND ÇİZGİSİ + bileşen ▲▼ deltaları + soluk "neden" cümlesi +
// veri yokken "—" + seçili vaatlerin mini ilerleme barları.
import { TUNING } from '../config.js';
import { esc } from './frame.js';
import { promiseStatus, toneWord, midPromiseOptions, midPromiseCount } from '../actions.js';
import { sbShell } from './cockpit.js';

const NAMES = { sportif: 'Sportif', taraftar: 'Taraftar', mali: 'Mali', itibar: 'İtibar', soz: 'Söz Tutma' };

export function render(G) {
  const secimSezon = TUNING.SEASONS_PER_TERM - (((G.meta?.season || 1) - 1) % TUNING.SEASONS_PER_TERM);
  const sandik = secimSezon <= 1 ? 'SANDIK BU SEZON' : `SANDIK ${secimSezon} SEZON`;
  const proj = G.lastProj;
  if (!proj) {
    const bosBody = `<div style="flex:1;min-height:0;display:flex;flex-direction:column;gap:.7em;overflow:hidden">
      <div class="panel-sayfa kongre" style="flex:1;min-height:0">
        <div class="card"><div class="bos-durum"><div class="iko">🗳</div><div class="cml">Sezon başladı, karne birikmedi — ilk maçlardan sonra projeksiyon burada canlanır.</div></div></div>
      </div>
    </div>`;
    return sbShell(G, { crumb: `KONGRE · KARNE BİRİKMEDİ · ${sandik}`, title: 'Kongre Salonu', body: bosBody });
  }
  const b = proj.breakdown, prev = G.prevBreakdown;
  const pct = Math.round(proj.oyOrani * 100);

  // Trend çizgisi (haftalık geçmiş) — inline SVG polyline
  const hist = (G.voteHistory || []).slice(-34);
  let trend = '<div class="muted">—</div>';
  if (hist.length >= 2) {
    const W = 560, H = 80;
    const min = Math.min(...hist.map((x) => x.oy), 40), max = Math.max(...hist.map((x) => x.oy), 60);
    const px = (i) => (i / (hist.length - 1)) * (W - 8) + 4;
    const py = (v) => H - 6 - ((v - min) / Math.max(max - min, 1)) * (H - 14);
    const pts = hist.map((x, i) => `${px(i).toFixed(1)},${py(x.oy).toFixed(1)}`).join(' ');
    const winY = py(TUNING.WIN_LINE * 100);
    trend = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px">
      <line x1="4" y1="${winY}" x2="${W - 4}" y2="${winY}" stroke="var(--ink-3)" stroke-dasharray="4 4" stroke-width="1"/>
      <polyline points="${pts}" fill="none" stroke="var(--club-2)" stroke-width="2"/>
      <circle cx="${px(hist.length - 1)}" cy="${py(hist[hist.length - 1].oy)}" r="3" fill="var(--club-2)"/>
    </svg><div class="muted" style="font-size:11px">kesikli çizgi: kazanma eşiği %${Math.round(TUNING.WIN_LINE * 100)}</div>`;
  }

  const compRow = (k) => {
    const v = Math.round(b[k]);
    const d = prev ? Math.round(b[k] - prev[k]) : 0;
    const arrow = d > 0 ? `<span class="pos">▲${d}</span>` : d < 0 ? `<span class="neg">▼${-d}</span>` : '<span class="muted">—</span>';
    return `<div style="padding:6px 0;border-top:1px solid var(--line)">
      <div style="display:flex;justify-content:space-between"><span>${NAMES[k]}</span><span class="tnum"><b>${v}</b> ${arrow}</span></div>
      <div class="muted" style="font-size:11px">${nedeni(k, G, b)}</div>
    </div>`;
  };

  const vows = promiseStatus(G).map((v) => `<div style="padding:5px 0">
    <div style="display:flex;justify-content:space-between;font-size:13px"><span>${esc(v.name)}</span><span class="muted">${v.label}</span></div>
    <div class="track" style="height:6px;background:var(--bg-2);border-radius:3px;overflow:hidden;margin-top:3px">
      <div style="width:${v.pct}%;height:100%;background:${v.pct >= 55 ? 'var(--pos)' : 'var(--warn)'}"></div></div>
  </div>`).join('');

  const body = `<div style="flex:1;min-height:0;display:flex;flex-direction:column;gap:.7em;overflow:hidden">
    <div class="panel-sayfa kongre" style="flex:1;min-height:0">
    <div class="kongre-gauge">
      <div class="kongre-gauge-track"><div class="kongre-gauge-fill ${proj.kazandi ? 'win' : 'lose'}" style="width:${Math.min(pct, 100)}%"></div></div>
      <span class="kongre-gauge-line" style="left:${Math.round(TUNING.WIN_LINE * 100)}%"></span>
      <div class="kongre-gauge-lbl"><span>bugünkü oy <b class="tnum">%${pct}</b></span><span class="muted">kazanma eşiği %${Math.round(TUNING.WIN_LINE * 100)}</span></div>
    </div>
    <div class="card"><div class="overline">Oy Projeksiyonu · Trend</div><div style="margin-top:8px">${trend}</div></div>
    <div class="card" style="margin-top:12px"><div class="overline">Bileşenler (geçen haftaya göre)</div>
      ${['sportif', 'taraftar', 'mali', 'itibar', 'soz'].map(compRow).join('')}
      <div style="padding:6px 0;border-top:1px solid var(--line);display:flex;justify-content:space-between">
        <span class="neg">Rakip çekiciliği (oyu düşürür)</span><b class="tnum neg">${Math.round(b.rival)}</b></div>
    </div>
    <div class="card" style="margin-top:12px"><div class="overline">Vaat İlerlemesi</div>
      <div style="margin-top:6px">${vows || '<span class="muted">Bu dönem vaat verilmedi — "laf değil, iş".</span>'}</div>
    </div>
    ${yeniSozCard(G)}
    ${boyutCard(G)}
    </div>
  </div>`;
  const crumb = `KONGRE · SEÇİM OLSA %${pct} · ${proj.kazandi ? 'KAZANIR' : 'KAYBEDER'} · ${sandik}`;
  return sbShell(G, { crumb, title: 'Kongre Salonu', body });
}

// B2a+B2b: 4 boyutlu taraftar dökümü — TİS doluysa NET + buluşma butonları; boşsa SİSLİ
export function boyutCard(G) {
  const b = G.boyutlar;
  if (!b) return '';
  const tis = G.staff && G.staff.tis;
  const BOYUT_TR = { sonuc: 'Sonuçlar', transfer: 'Transferler', stil: 'Oyun Stili', kimlik: 'Kimlik' };
  const rows = ['sonuc', 'transfer', 'stil', 'kimlik'].map((k) => {
    const v = Math.round(b[k]);
    const goster = tis ? `<b class="tnum">${v}</b>` : `<span class="muted tnum">${v < 45 ? 'düşük?' : v > 65 ? 'iyi?' : '~orta'}</span>`; // sisli
    const bulusma = tis && k !== 'sonuc' && (G.tisBulusmaCount || 0) < 2
      ? ` <button class="btn" style="padding:2px 8px;font-size:11px" data-act="tisBulusma" data-arg="${k}">buluşma</button>` : '';
    return `<div style="padding:5px 0;border-top:1px solid var(--line)">
      <div style="display:flex;justify-content:space-between;align-items:center"><span>${BOYUT_TR[k]}</span><span>${goster}${bulusma}</span></div>
      ${tis && b.neden && b.neden[k] ? `<div class="muted" style="font-size:11px">${esc(b.neden[k])}</div>` : ''}
    </div>`;
  }).join('');
  return `<div class="card" style="margin-top:12px"><div class="overline">Taraftar Duyarlılığı — 4 Boyut</div>
    ${tis ? '' : '<div class="kongre-sisli">🌫 Sisli okuma — Taraftar İlişkileri koltuğu boş. Doldurunca net rakam gelir.</div>'}
    ${rows}
    ${tis ? `<div class="muted" style="font-size:11px;margin-top:4px">Buluşma hakkı: ${2 - (G.tisBulusmaCount || 0)}/2 (seçilen boyutu onarır, küçük masraf)</div>` : ''}
  </div>`;
}

// Oyun-içi yeni söz kartı — sezon ortasında kürsüye çıkıp söz ver (el güçlenir; tutulmazsa yaptırım)
function yeniSozCard(G) {
  if (G.phase !== 'SEASON_LOOP') return '';
  const midN = midPromiseCount(G);
  const opts = midPromiseOptions(G).slice(0, 5);
  const inner = midN >= 2
    ? '<div class="kongre-sisli">Bu dönem söz hakkın doldu (2/2) — önce verdiğin sözleri tut.</div>'
    : (opts.length
      ? opts.map((p) => `<button class="cx-btn kongre-soz-btn" data-act="midPromise" data-arg="${p.id}"><span>${esc(p.name)}</span><span class="muted">${'★'.repeat(p.difficulty)}</span></button>`).join('')
      : '<div class="muted" style="font-size:11px">Verilebilecek uygun söz kalmadı.</div>');
  const sp = G.term?.socialProjects || 0;
  const buHafta = G._sosyalHafta === ((G.meta?.season || 1) + '|' + (G.meta?.week || 1));
  const spDolu = sp >= 3;
  return `<div class="card kongre-yenisoz"><div class="overline">Kürsüye Çık · Yeni Söz</div>
    <div class="muted" style="font-size:11px;margin:4px 0 8px">Sezon ortasında söz vermek tribünü coşturur, sandıktaki elini güçlendirir. Ama tutmazsan dönem sonu yaptırım.</div>
    ${inner}
    <button class="cx-btn" data-act="sosyalProje" ${spDolu || buHafta ? 'disabled' : ''} data-tip="${spDolu ? 'Dönem programı tamam (3/3)' : buHafta ? 'Haftada 1 proje — ekip zaten sahada' : '2mn: semt sahaları/okul ziyaretleri — taraftar +1; 3 proje sözü tutar (haftada 1)'}" style="margin-top:8px;width:100%">${spDolu ? '🏘 Sosyal Program TAMAM ✓ 3/3' : `🏘 Sosyal Proje Başlat (2mn) · ${sp}/3${buHafta ? ' · bu hafta yapıldı' : ''}`}</button></div>`;
}

// §4: her bileşene tek soluk "neden" cümlesi (kural tabanlı)
function nedeni(k, G, b) {
  const hedef = G.club.hedefSira, pos = G.myPos || hedef;
  switch (k) {
    case 'sportif':
      return pos <= hedef ? `hedefin (${hedef}.) üstünde seyir` : `hedefin (${hedef}.) altında kalınıyor`;
    case 'taraftar': {
      const parts = [];
      parts.push(pos <= hedef ? 'beklenti üstü sıra' : 'beklenti altı sonuçlar');
      if (G.economy.ticketPrice <= 1.0) parts.push('makul kombine'); else if (G.economy.ticketPrice > 1.2) parts.push('pahalı bilet tepkisi');
      return parts.join(', ');
    }
    case 'mali': {
      const d = (G.termStartBorc ?? G.economy.borc) - G.economy.borc;
      return d > 5 ? 'borç eritiliyor' : d < -5 ? 'borç büyüyor' : 'borç yatay, kasa dengede';
    }
    case 'itibar':
      return `basın havası ${toneWord(G.mediaTone).toLowerCase()}${pos <= hedef ? ', beklenti üstü duruş' : ''}`;
    case 'soz': {
      const st = promiseStatus(G);
      const on = st.filter((x) => x.pct >= 55).length;
      return st.length === 0 ? 'söz verilmedi (nötr)' : `${on}/${st.length} vaat yolunda`;
    }
    default: return '';
  }
}
