// src/ui/congress.js — Kongre & seçim paneli (V3-C8 + §4 cila):
// oy projeksiyonu TREND ÇİZGİSİ + bileşen ▲▼ deltaları + soluk "neden" cümlesi +
// veri yokken "—" + seçili vaatlerin mini ilerleme barları.
import { TUNING } from '../config.js';
import { esc } from './frame.js';
import { promiseStatus, toneWord, midPromiseOptions, midPromiseCount } from '../actions.js';
import { condTr } from './promiseSelect.js';
import { sbShell } from './cockpit.js';

const NAMES = { sportif: 'Sportif', taraftar: 'Taraftar', mali: 'Mali', itibar: 'İtibar', soz: 'Söz Tutma' };

export function render(G) {
  const secimSezon = TUNING.SEASONS_PER_TERM - (((G.meta?.season || 1) - 1) % TUNING.SEASONS_PER_TERM);
  const sandik = secimSezon <= 1 ? 'SANDIK BU SEZON' : `SANDIK ${secimSezon} SEZON`;
  const proj = G.lastProj;
  if (!proj) {
    const bosBody = `<div class="kng-root kongre">
      <div class="kng-col" style="grid-column:1/-1;max-width:620px">
        <div class="card"><div class="bos-durum"><div class="iko">🗳</div><div class="cml">Sezon başladı, karne birikmedi — ilk maçlardan sonra projeksiyon burada canlanır.</div></div></div>
        ${delegeCard(G)}
        ${ultrasCard(G)}
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

  // YERLEŞİM DERSİ (sb- göçü): eski çok-sütunlu .panel-sayfa, sb kabuğu içinde tek dar sütuna
  // çöküp overflow:hidden ile 4. karttan sonrasını KIRPIYORDU (Yeni Söz/4 Boyut/Delege görünmez).
  // Çözüm: finans gibi AÇIK 3 sütunlu grid (kng-root) — hangi kart nerede, belirsizlik yok.
  const body = `<div class="kng-root kongre">
    <div class="kongre-gauge">
      <div class="kongre-gauge-track"><div class="kongre-gauge-fill ${proj.kazandi ? 'win' : 'lose'}" style="width:${Math.min(pct, 100)}%"></div></div>
      <span class="kongre-gauge-line" style="left:${Math.round(TUNING.WIN_LINE * 100)}%"></span>
      <div class="kongre-gauge-lbl"><span>bugünkü oy <b class="tnum">%${pct}</b></span><span class="muted">kazanma eşiği %${Math.round(TUNING.WIN_LINE * 100)}</span></div>
    </div>
    <div class="kng-col">
      <div class="card"><div class="overline">Oy Projeksiyonu · Trend</div><div style="margin-top:8px">${trend}</div></div>
      <div class="card"><div class="overline">Vaat İlerlemesi</div>
        <div style="margin-top:6px">${vows || '<span class="muted">Bu dönem vaat verilmedi — "laf değil, iş".</span>'}</div>
      </div>
      ${yeniSozCard(G)}
    </div>
    <div class="kng-col">
      <div class="card"><div class="overline">Bileşenler (geçen haftaya göre)</div>
        ${['sportif', 'taraftar', 'mali', 'itibar', 'soz'].map(compRow).join('')}
        <div style="padding:6px 0;border-top:1px solid var(--line);display:flex;justify-content:space-between">
          <span class="neg">Rakip çekiciliği (oyu düşürür)</span><b class="tnum neg">${Math.round(b.rival)}</b></div>
      </div>
      ${boyutCard(G)}
    </div>
    <div class="kng-col">
      ${delegeCard(G)}
      ${ultrasCard(G)}
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
      ? opts.map((p) => `<button class="cx-btn kongre-soz-btn" data-act="midPromise" data-arg="${p.id}" data-tip="${esc(`Koşul: ${condTr(p) || 'şartları dönem sonunda tartılır'} · zorluk ${p.difficulty}/5 — verirsen tribün coşar; tutarsan söz karnesi ▲, tutmazsan sicile leke + rakibe koz`)}"><span>${esc(p.name)}</span><span class="muted">${'★'.repeat(p.difficulty)}</span></button>`).join('')
      : '<div class="muted" style="font-size:11px">Verilebilecek uygun söz kalmadı.</div>');
  const sp = G.term?.socialProjects || 0;
  const buHafta = G._sosyalHafta === ((G.meta?.season || 1) + '|' + (G.meta?.week || 1));
  const spDolu = sp >= 3;
  return `<div class="card kongre-yenisoz"><div class="overline">Kürsüye Çık · Yeni Söz</div>
    <div class="muted" style="font-size:11px;margin:4px 0 8px">Sezon ortasında söz vermek tribünü coşturur, sandıktaki elini güçlendirir. Ama tutmazsan dönem sonu yaptırım.</div>
    ${inner}
    <button class="cx-btn" data-act="sosyalProje" ${spDolu || buHafta ? 'disabled' : ''} data-tip="${spDolu ? 'Dönem programı tamam (3/3)' : buHafta ? 'Haftada 1 proje — ekip zaten sahada' : '2mn: semt sahaları/okul ziyaretleri — taraftar +1; 3 proje sözü tutar (haftada 1)'}" style="margin-top:8px;width:100%">${spDolu ? '🏘 Sosyal Program TAMAM ✓ 3/3' : `🏘 Sosyal Proje Başlat (2mn) · ${sp}/3${buHafta ? ' · bu hafta yapıldı' : ''}`}</button></div>`;
}

// KONGRE 2.6: Delege blokları — 4 seçmen kütlesi; blok sandık eğilimi + ilişki + sofra butonu.
// İlişki nötr 50'de sandığa etkisi TAM 0 (autoplay-nötr) — kart bunu açıkça söyler.
function delegeCard(G) {
  const del = G.delege;
  if (!del) return '';
  const bloklar = G.lastProj?.breakdown?.bloklar;
  const dEtki = G.lastProj?.breakdown?.dEtki || 0;
  const hak = del.yemekHak ?? 0;
  const rows = Object.entries(TUNING.DELEGE.BLOK).map(([k, B]) => {
    const iliski = Math.round(del.bloklar?.[k] ?? 50);
    const oy = bloklar?.[k] ? Math.round(bloklar[k].oy) : null;
    const durum = iliski >= 70 ? '<span class="pos">sıcak</span>' : iliski < 30 ? '<span class="neg">soğuk</span>' : '<span class="muted">mesafeli</span>';
    const yemek = hak > 0
      ? `<button class="btn" style="padding:2px 8px;font-size:11px" data-act="delegeYemek" data-arg="${k}" data-tip="${TUNING.DELEGE.YEMEK.maliyet}mn: temsilcilerle sofra — ilişki +${TUNING.DELEGE.YEMEK.artis}">🍽 sofra</button>` : '';
    return `<div style="padding:5px 0;border-top:1px solid var(--line)">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
        <span>${B.ad} <span class="muted" style="font-size:10px">%${Math.round(B.pay * 100)} delege</span></span>
        <span style="display:flex;align-items:center;gap:6px">${oy != null ? `<b class="tnum" data-tip="bu blokta sandık eğilimi (0-100)">${oy}</b>` : '<span class="muted">—</span>'}${yemek}</span>
      </div>
      <div class="muted" style="font-size:11px;display:flex;justify-content:space-between"><span>${esc(B.kim)}</span><span>ilişki <b class="tnum">${iliski}</b> · ${durum}</span></div>
    </div>`;
  }).join('');
  return `<div class="card" style="margin-top:12px"><div class="overline">Delege Blokları — Sandığın Anatomisi</div>
    ${rows}
    <div class="muted" style="font-size:11px;margin-top:6px;display:flex;justify-content:space-between">
      <span>Blok ilişkilerinin oya net etkisi: <b class="tnum ${dEtki > 0 ? 'pos' : dEtki < 0 ? 'neg' : ''}">${dEtki > 0 ? '+' : ''}${dEtki.toFixed(1)} puan</b></span>
      <span>Sofra hakkı: ${hak}/${TUNING.DELEGE.YEMEK.hak} (dönemlik)</span>
    </div>
  </div>`;
}

// KONGRE 2.6: Tribünler — ultras gruplarının ilişkisi + aktif talepler (cevap butonları Inbox'ta)
function ultrasCard(G) {
  const gruplar = G.fanGroups || [];
  if (!gruplar.length) return '';
  const U = TUNING.ULTRAS;
  const rows = gruplar.map((g) => {
    const iliski = Math.round(g.iliski ?? 50);
    const talep = g.talep
      ? `<div style="font-size:11px;margin-top:2px"><span class="neg">●</span> Talep: <b>${esc((U.TALEPLER[g.talep.tip] || {}).ad || g.talep.tip)}</b> · cevap için ${Math.max(0, g.talep.sonAbs - (G.globalWeek || 0))} hafta — <span class="muted">dosya Inbox'ta</span></div>`
      : iliski >= U.DUVAR_ESIK
        ? '<div class="muted" style="font-size:11px;margin-top:2px">tribün sıcak — sezonda 1 bedava duvar gecesi ihtimali canlı</div>'
        : '';
    return `<div style="padding:5px 0;border-top:1px solid var(--line)">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span>${esc(g.name)} <span class="muted" style="font-size:10px">${g.radikal ? 'radikal' : 'ılımlı'}</span></span>
        <span class="tnum" data-tip="tribün liderleriyle ilişki (memnuniyetten ayrı — kararlarınla oynar)"><b>${iliski}</b> <span class="muted" style="font-size:10px">/ mem. ${Math.round(g.memnuniyet ?? 50)}</span></span>
      </div>
      ${talep}
    </div>`;
  }).join('');
  return `<div class="card" style="margin-top:12px"><div class="overline">Tribünler — Taraftar Grupları</div>
    ${rows}
    <div class="muted" style="font-size:11px;margin-top:4px">Talebi karşıla → coşku + Tribün Delegeleri ısınır · yok say → ${U.SURE} hafta sonra pankart iner.</div>
  </div>`;
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
