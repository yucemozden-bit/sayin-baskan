// src/ui/seasonEnd.js — Sezon sonu karne kartı (V3-C12 MVP) + M5: sezonun 3 anı
// + RETENTION: "gelecek sezon hedefin" ileri-çekme kancası (bırakma noktasını köprüler).
import { fmt, esc } from './frame.js';
import { nextObjectives } from '../engines/objectives.js';

export function render(G) {
  const s = G.lastSeason;
  const lig = G.lig || 1;
  let zone, zoneCls;
  if (lig === 2) { // 2. ligde ilk 3 = terfi; kupa/avrupa/küme yok
    if (s.pos <= 3) { zone = 'TERFİ ⬆️'; zoneCls = 'pos'; }
    else { zone = '2. Ligde kaldı'; zoneCls = ''; }
  } else {
    zone = s.champion ? 'ŞAMPİYON 🏆' : s.pos <= 4 ? 'Avrupa kupaları' : s.relegated ? 'KÜME DÜŞTÜ ⚠' : 'Ligde kaldı';
    zoneCls = s.champion ? 'pos' : s.relegated ? 'neg' : '';
  }
  return `<div class="scene">
    <div class="overline">Sezon ${G.meta.season} Sonu · Karne</div>
    <h1 style="font-size:40px;margin:8px 0;color:var(--club-2)">${s.pos}. sıra</h1>
    <div class="sub ${zoneCls}" style="font-weight:700;letter-spacing:1px">${zone}</div>
    <div class="card" style="text-align:left;margin-top:18px;max-width:360px;margin-inline:auto">
      <div class="fin-lines">
        <div class="l"><span>Galibiyet / Beraberlik / Mağlubiyet</span><b class="tnum">${s.W} / ${s.D} / ${s.L}</b></div>
        <div class="l"><span>Attığı / Yediği</span><b class="tnum">${s.GF} / ${s.GA}</b></div>
        <div class="l"><span>Kasa</span><b class="tnum">${fmt(G.economy.kasa)}mn</b></div>
        <div class="l"><span>Borç</span><b class="tnum">${fmt(G.economy.borc)}mn</b></div>
        <div class="l"><span>Güven / Taraftar</span><b class="tnum">${Math.round(G.gauges.guven)} / ${Math.round(G.gauges.taraftar)}</b></div>
      </div>
    </div>
    ${(G.sezonAnlari && G.sezonAnlari.length) ? `<div class="card" style="text-align:left;margin-top:12px;max-width:420px;margin-inline:auto">
      <div class="overline">Sezonun ${G.sezonAnlari.length} Anı — Başkanın Defterinden</div>
      ${G.sezonAnlari.map((a) => `<div class="muted" style="font-size:12px;padding:4px 0;border-top:1px solid var(--line)">${a.etki > 0 ? '✦' : '✧'} <b style="color:var(--ink-1)">${esc(a.t)}</b> — ${esc(a.b)}</div>`).join('')}
    </div>` : ''}
    ${s.hikaye ? `<div class="muted" style="margin-top:10px;font-style:italic;font-size:13px">${esc(s.hikaye)}</div>` : ''}
    ${forwardHook(G)}
  </div>`;
}

// RETENTION: gelecek sezona köprü — 2-3 somut hedef + seçim uyarısı. "Bir sezon daha" itkisi.
function forwardHook(G) {
  let objs = [];
  try { objs = nextObjectives(G).filter((o) => o.kind !== 'kriz').slice(0, 3); } catch {}
  const sonSezon = ((G.career && G.career.seasons) || 0) % (G.SEASONS_PER_TERM || 3) === (G.SEASONS_PER_TERM || 3) - 1;
  const secimSatiri = sonSezon
    ? `<div class="se-secim">🗳️ Önümüzdeki sezon <b>kongre seçimi</b> var — mandat sandıkta belli olacak.</div>` : '';
  if (!objs.length && !secimSatiri) return '';
  return `<div class="card se-forward" style="max-width:420px;margin:14px auto 0;text-align:left">
    <div class="overline">Gelecek Sezon · Hedefin</div>
    ${objs.map((o) => `<div class="se-obj"><span>${o.icon} ${esc(o.text)}</span>
      <div class="se-obj-tr"><i style="width:${Math.round((o.pct || 0) * 100)}%"></i></div></div>`).join('')}
    ${secimSatiri}
  </div>`;
}
