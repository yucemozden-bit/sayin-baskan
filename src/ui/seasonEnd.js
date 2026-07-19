// src/ui/seasonEnd.js — SEZON SONU TÖRENİ (sb-cinematic tam-ekran, scroll YOK):
// sol karne paneli · orta sezonun anıları + hikaye · sağ aile karnesi + gelecek sezon köprüsü.
// Eski dar tek kolon + kaydırma yerine genişliğe yayılan 3 panel (kullanıcı isteği 2026-07-20).
import { fmt, esc } from './frame.js';
import { nextObjectives } from '../engines/objectives.js';
import { sbTopbar } from './cockpit.js';

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
  // 📈 GEÇEN SEZONLA KIYAS (motivasyon): yükseliş kutlanır, düşüş dürter
  const sz = (G.history?.seasons || []);
  const onceki = sz.length >= 2 ? sz[sz.length - 2] : null;
  const kiyas = (!onceki || (onceki.lig || 1) !== lig) ? ''
    : (() => {
      const d = onceki.pos - s.pos;
      return d > 0 ? `<div class="se-kiyas pos">▲ Geçen sezona göre ${d} basamak YÜKSELİŞ (${onceki.pos}. → ${s.pos}.)</div>`
        : d < 0 ? `<div class="se-kiyas neg">▼ Geçen sezona göre ${-d} basamak geriledin (${onceki.pos}. → ${s.pos}.)</div>`
          : '<div class="se-kiyas muted">— Geçen sezonla aynı basamak: istikrar da bir cevaptır</div>';
    })();

  const avg = s.GF - s.GA;
  const karne = `<div class="card se-card">
    <div class="overline">Sezon Karnesi</div>
    <div class="se-gbm">
      <div class="se-gbm-h" data-tip="Galibiyet"><b class="pos">${s.W}</b><i>G</i></div>
      <div class="se-gbm-h" data-tip="Beraberlik"><b>${s.D}</b><i>B</i></div>
      <div class="se-gbm-h" data-tip="Mağlubiyet"><b class="neg">${s.L}</b><i>M</i></div>
    </div>
    <div class="fin-lines">
      <div class="l"><span>Attığı / Yediği</span><b class="tnum">${s.GF} / ${s.GA} <span class="${avg > 0 ? 'pos' : avg < 0 ? 'neg' : 'muted'}">(${avg > 0 ? '+' : ''}${avg})</span></b></div>
      <div class="l"><span>Kasa</span><b class="tnum">${fmt(G.economy.kasa)}mn</b></div>
      <div class="l"><span>Borç</span><b class="tnum ${G.economy.borc > 0 ? 'neg' : 'pos'}">${fmt(G.economy.borc)}mn</b></div>
      <div class="l"><span>Üye Güveni / Taraftar</span><b class="tnum">${Math.round(G.gauges.guven)} / ${Math.round(G.gauges.taraftar)}</b></div>
    </div>
  </div>`;

  const anilar = (G.sezonAnlari && G.sezonAnlari.length)
    ? `<div class="card se-card">
      <div class="overline">Sezonun ${G.sezonAnlari.length} Anı — Başkanın Defterinden</div>
      ${G.sezonAnlari.map((a) => `<div class="se-ani ${a.etki > 0 ? 'iyi' : 'koyu'}"><span class="se-ani-ik">${a.etki > 0 ? '✦' : '✧'}</span><div><b>${esc(a.t)}</b><i>${esc(a.b)}</i></div></div>`).join('')}
      ${s.hikaye ? `<div class="se-hikaye">${esc(s.hikaye)}</div>` : ''}
    </div>`
    : `<div class="card se-card">
      <div class="overline">Başkanın Defterinden</div>
      <div class="se-ani koyu"><span class="se-ani-ik">✧</span><div><b>Sakin bir sezon</b><i>Defter bu yıl az yazdı — büyük anlar önümüzdeki sezonların işi.</i></div></div>
      ${s.hikaye ? `<div class="se-hikaye">${esc(s.hikaye)}</div>` : ''}
    </div>`;

  const bbNote = s.champion ? 'Şampiyonluk sezonu kapandı — şehir hâlâ bayramda'
    : s.relegated ? '2. Lig yolculuğu başlıyor — hedef anında terfi'
      : `${s.pos}. sıra ile kapandı · yeni sezon planı masada`;

  return `<div class="sb-root sb-cinematic se-root">
    <div class="sb-atmo"></div><div class="sb-vignette"></div>
    ${sbTopbar(G, { phaseChip: `SEZON ${G.meta.season} KAPANIŞI` })}
    <div class="sb-body sb-body-col se-body">
      <div class="se-hero">
        <div class="overline">Sezon ${G.meta.season} Sonu · Karne</div>
        <h1 class="se-pos">${s.pos}. sıra</h1>
        <div class="se-zone ${zoneCls}">${zone}</div>
        ${kiyas}
      </div>
      <div class="se-grid">
        ${karne}
        ${anilar}
        <div class="se-kol">${aileKarnesi(G)}${forwardHook(G)}</div>
      </div>
    </div>
    <footer class="sb-bottombar">
      <div class="sb-bb-l"><span class="sb-bb-k">SEZON SONU</span><span class="sb-bb-note">${esc(bbNote)}</span></div>
      <button class="sb-btn sb-btn-primary" data-act="devam">Yeni Sezona Başla ▸</button>
    </footer>
  </div>`;
}

// AİLE KARNESİ — sezon kulüpte nasıl geçtiyse evde de bir karşılığı var (Özel Hayat köprüsü).
// Tek satırlık dört sayaç + evin son hâli; veri yoksa (çok eski kayıt) blok hiç çizilmez.
function aileKarnesi(G) {
  const oz = G.ozel; if (!oz || !oz.sezon) return '';
  const S = oz.sezon, ev = Math.round(oz.g?.ev ?? 0);
  const evSoz = ev >= 65 ? 'ev sıcak' : ev >= 45 ? 'ev dengede' : 'evde buzlu rüzgâr';
  return `<div class="card se-card">
    <div class="overline">Aile Karnesi — ${esc(oz.aile?.es || '')} Hanım'ın Defterinden</div>
    <div class="fin-lines" style="margin-top:6px">
      <div class="l"><span>Çözülen ikilem / kaçan fırsat</span><b class="tnum">${S.ikilem} / ${S.kacan}</b></div>
      <div class="l"><span>Düzenlenen davet</span><b class="tnum">${S.davet}</b></div>
      <div class="l"><span>Kulübe kişisel destek</span><b class="tnum">${S.bagis ? '₺' + S.bagis + 'mn' : '—'}</b></div>
      <div class="l"><span>Ev huzuru (sezon kapanışı)</span><b class="tnum">${ev} · ${evSoz}</b></div>
    </div>
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
  return `<div class="card se-card se-forward">
    <div class="overline">Gelecek Sezon · Hedefin</div>
    ${objs.map((o) => `<div class="se-obj"><span>${o.icon} ${esc(o.text)}</span>
      <div class="se-obj-tr"><i style="width:${Math.round((o.pct || 0) * 100)}%"></i></div></div>`).join('')}
    ${secimSatiri}
  </div>`;
}
