// src/ui/clubView.js — KULÜP KİMLİĞİ v3 (kulup-ekrani-inceleme.md):
// Boş kutular tek satıra indi, başarım duvarı MODAL'a taşındı (yerine 6 çubuklu özet +
// "en yakın 3 hedef"), oyunun omurgası geldi: MÜHÜRLÜ SÖZLER canlı ilerleme + KONGRE & GÜVEN
// paneli. Yönetim kadrosu sayısal fayda listesi. "Emekli Ol" Ayarlar'a taşındı.
import { esc, fmt } from './frame.js';
import { describeStaff, ROLE_TR } from '../models/staff.js';
import { promiseStatus } from '../actions.js';

const TAG_TR = {
  SAMPIYONLUK_YARISI: '🏆 ŞAMPİYONLUK YARIŞI', KRIZ_KULUBU: '🔥 KRİZ KULÜBÜ', BORC_BATAGI: '💸 BORÇ BATAĞI',
  YENIDEN_DOGUS: '🌅 YENİDEN DOĞUŞ', ALTYAPI_DEVRIMI: '🌱 ALTYAPI DEVRİMİ', SECIM_SATHI: '🗳 SEÇİM SATHI', NORMAL: 'SAKİN SULAR',
};
const ROLE_ICON = { gm: '◆', cfo: '💰', akademi: '🌱', basin: '🎙', stat: '📊', tis: '🤝' };
// Her koltuğun OYUNA gerçek katkısı (tekrar cümle yerine sayısal/ओmut fayda)
const ROLE_FAYDA = {
  cfo: 'Faiz pazarlığı güçlenir · nakit projeksiyonu netleşir',
  akademi: 'Gençler daha hızlı gelişir',
  basin: 'Manşet söndürme hakkı açılır',
  stat: 'Maç günü deneyimi/geliri ↑',
  tis: 'Taraftar 4 boyutu NETLEŞİR + buluşma hakkı',
};

export function render(G) {
  const c = G.career || { titles: 0, termsWon: 0, bestPos: 18, seasons: 0 };
  const tierTr = { kucuk: 'Küçük', orta: 'Orta', buyuk: 'Büyük' }[G.club.tier] || G.club.tier;
  const tag = TAG_TR[G.currentTag] || TAG_TR.NORMAL;
  const mono = esc((G.club.name || 'S')[0]);

  // ── SOL: Künye (kompakt, hedef sıra Kongre paneline taşındı) ──
  const kunyeCard = `<div class="card klub-kunye"><span class="klub-arma-fil">${mono}</span>
    <div class="overline">Künye</div>
    <div class="fin-lines klub-kunye-lines">
      <div class="l"><span>Kuruluş</span><b class="tnum">${G.club.founded || '—'}</b></div>
      ${G.club.sehir ? `<div class="l"><span>Şehir</span><b>${esc(G.club.sehir)}</b></div>` : ''}
      <div class="l"><span>Stadyum</span><b>${esc(G.club.stadName || '—')}</b></div>
      <div class="l"><span>Ezeli rakip</span><b>${esc(G.club.rivalName || '—')}</b></div>
      <div class="l"><span>Statü</span><b>${tierTr} kulüp</b></div>
      <div class="l"><span>Taraftar</span><b class="tnum">${(G.club.fanCount / 1000).toFixed(0)}b</b></div>
      <div class="l"><span>Kadro değeri</span><b class="tnum">${fmt(G.club.kadroDeger)}mn</b></div>
      <div class="l"><span>Dönem / Sezon</span><b class="tnum">${G.meta.term} / ${c.seasons || 0}</b></div>
    </div></div>`;

  return `<div class="klub-wrap">
    <div class="klub-head">
      <div class="klub-head-l"><span class="klub-crest">${mono}</span>
        <div><div class="overline">Kulüp Kimliği</div><h1>${esc(G.club.name)}</h1></div></div>
      <span class="badge klub-tag" data-tip="Kulübün anlatı iklimi: güven + kurul + taraftar + borç durumundan türeyen dönem etiketi">${tag}</span>
    </div>
    <div class="klub-grid">
      <div class="klub-col">${kunyeCard}${tierYolu(G)}${muzeBlok(G)}</div>
      <div class="klub-col">${sozlerCard(G)}${yonetimCard(G)}</div>
      <div class="klub-col">${basarimOzet(G)}${kongreGuven(G)}${defterBlok(G)}</div>
    </div>
  </div>`;
}

// ── ORTA: MÜHÜRLÜ SÖZLER — vaat ekranında verilen sözlerin CANLI takibi (oyunun omurgası) ──
function sozlerCard(G) {
  const st = promiseStatus(G);
  const kalan = 3 - (((G.history && G.history.seasons) || []).length % 3);
  const rows = st.length ? st.map((v) => `<div class="soz-row">
      <span class="soz-ad">▸ ${esc(v.name)}</span>
      <span class="soz-track"><b style="width:${Math.max(4, v.pct)}%;background:${v.pct >= 90 ? 'var(--pos)' : v.pct >= 50 ? 'var(--club-2)' : 'var(--warn)'}"></b></span>
      <em class="soz-lbl">${esc(v.label)}</em>
    </div>`).join('')
    : '<div class="klub-bos" style="padding:8px 0">Bu dönem söz verilmedi — "Laf değil, iş."</div>';
  return `<div class="card"><div class="overline">Mühürlü Sözler <span class="muted" style="float:right;font-size:11px">Kongre: ${kalan} sezon</span></div>
    <div class="soz-list">${rows}</div>
  </div>`;
}

// ── SAĞ: KONGRE & GÜVEN — üye güveni / kurul / taraftar + geri sayım + rakip kulis ──
function kongreGuven(G) {
  const kalan = 3 - (((G.history && G.history.seasons) || []).length % 3);
  const kurulOrt = (G.board || []).length
    ? Math.round(G.board.reduce((a, m) => a + (m.loyalty ?? 50), 0) / G.board.length) : null;
  const bar = (ad, v, tip) => v == null ? '' : `<div class="kg-row" data-tip="${esc(tip || '')}">
      <span>${ad}</span><span class="kg-track"><b style="width:${Math.max(3, Math.round(v))}%;background:${v >= 60 ? 'var(--pos)' : v >= 42 ? 'var(--warn)' : 'var(--neg)'}"></b></span><em class="tnum">%${Math.round(v)}</em>
    </div>`;
  return `<div class="card"><div class="overline">Kongre & Güven</div>
    <div class="kg-list">
      ${bar('ÜYE GÜVENİ', G.gauges.guven, 'Kongre üyelerinin sana güveni — seçimin bel kemiği')}
      ${kurulOrt != null ? bar('KURUL', kurulOrt, 'Yönetim kurulu sadakati (ortalama)') : '<div class="muted" style="font-size:11px">Kurul yok — Aile Kulübü.</div>'}
      ${bar('TARAFTAR', G.gauges.taraftar, 'Tribünün nabzı')}
    </div>
    <div class="kg-alt">
      <span>Kongre: <b>${kalan} sezon sonra</b> · Kurul beklentisi: <b>${G.club.hedefSira}.</b> sıra</span>
      ${G.rakipKulis ? `<span class="kg-rakip">Rakip aday kulisten "<b>${esc(G.rakipKulis)}</b>" sözü hazırlıyor.</span>` : ''}
    </div>
  </div>`;
}

// M2: tier merdiveni — küçük → orta → büyük (korunur)
function tierYolu(G) {
  const sira = ['kucuk', 'orta', 'buyuk'];
  const tr = { kucuk: 'Küçük', orta: 'Orta', buyuk: 'Büyük' };
  const cur = sira.indexOf(G.club.tier);
  const nodes = sira.map((t, i) => `<div class="tier-node ${i === cur ? 'aktif' : i < cur ? 'gecti' : ''}"><span class="tier-dot"></span><span class="tier-ad">${tr[t]}</span></div>`).join('<span class="tier-cizgi"></span>');
  const gecmis = (G.tierHistory || []).slice(-2).map((h) => `<div class="muted" style="font-size:11px">${h.dir === 'up' ? '▲' : '▼'} ${h.term}. dönem: ${tr[h.from]} → ${tr[h.to]}</div>`).join('');
  return `<div class="card"><div class="overline">Tier Yolculuğu</div>
    <div class="tier-track">${nodes}</div>${gecmis}
    ${G.tierShift ? '<div class="muted" style="font-size:11px;margin-top:4px">Geçiş sürüyor — yeni seviye 1 sezonda oturur.</div>' : ''}
  </div>`;
}

// ── YÖNETİM KADROSU — FARE ODAKLI: açıklamalar ekranda DEĞİL, hover tooltip'te.
// Boş koltukta "+ dosya" yerine hover'da parlayan zarif ⊕ ikonu. Ekranda sadece rol + isim.
function yonetimCard(G) {
  const row = (r, s, fixed) => {
    const dolu = fixed || !!s;
    const isim = fixed ? esc(G.gm?.name || '—') : (s ? esc(s.name) : '');
    const fayda = fixed ? 'Transfer dosyalarını yürütür — dosyayı o getirir, imza sende.' : ROLE_FAYDA[r] || '';
    const tip = dolu && !fixed ? `${fayda} · ${esc(describeStaff(s))} · ${fmt(s.wage)}mn/sezon` : fayda;
    return `<div class="staff-row ${dolu ? 'dolu' : 'bos'}" data-tip="${tip}">
      <span class="seat-ico">${ROLE_ICON[fixed ? 'gm' : r]}</span>
      <b class="sr-rol">${fixed ? 'Genel Menajer' : ROLE_TR[r]}</b>
      ${fixed ? `<span class="sr-isim">${isim}</span><span class="seat-tag">sabit</span>`
      : dolu ? `<span class="sr-isim">${isim}</span><span class="seat-dot" data-tip="Koltuk dolu"></span>`
        : `<span class="sr-bos">koltuk boş</span><button class="seat-plus" data-act="staffFile" data-arg="${r}" data-tip="Aday dosyası iste — ${fayda}" aria-label="Aday dosyası">⊕</button>`}
    </div>`;
  };
  return `<div class="card"><div class="overline">Yönetim Kadrosu <span class="muted" style="float:right;font-size:11px">6 koltuk</span></div>
    <div class="staff-list">${row('gm', null, true)}${['cfo', 'akademi', 'basin', 'stat', 'tis'].map((r) => row(r, G.staff && G.staff[r], false)).join('')}</div>
  </div>`;
}

// ── MÜZE — FARE ODAKLI: 48 mikro kupa yuvası matrisi (12×4). Kazanılan CANLI renkli
// (hover'da detay tooltip'i), boş yuva silik. "Vitrin boş" yazısı YOK — yuvalar konuşur.
function muzeBlok(G) {
  const mirasAktif = (G.promises || []).some((p) => p.id === 'P19' && p.kept === null);
  const rozet = mirasAktif ? ' <span class="badge">Kulüp Mirası vaadi aktif · ×1.5</span>' : '';
  const items = (G.museum || []).slice(0, 48);
  const iko = (t) => (t === 'kupa' ? '🏆' : t === 'jubile' ? '🎗' : t === 'kuskun' ? '🖤' : '📜');
  const slots = Array.from({ length: 48 }, (_, i) => {
    const k = items[i];
    return k
      ? `<span class="muze-slot dolu" data-tip="${esc(k.t)} — ${esc(k.b)}">${iko(k.tip)}</span>`
      : `<span class="muze-slot" data-tip="Boş yuva — tarih yazılmayı bekliyor">🏆</span>`;
  }).join('');
  return `<div class="card"><div class="overline">Müze / Rekorlar${rozet} <span class="muted" style="float:right;font-size:11px">${items.length}/48 yuva</span></div>
    <div class="muze-matris">${slots}</div>
  </div>`;
}

// ── DEFTER — FARE ODAKLI: çok dar YATAY zaman çizgisi (son 3 kritik karar).
// Düğüme hover → tarih (Sezon/Hafta) + detay tooltip'te. Boş düğümler silik bekler.
function defterBlok(G) {
  const n = (G.defter || []).length;
  const son3 = (G.defter || []).slice(-3).reverse();
  const nodes = Array.from({ length: 3 }, (_, i) => {
    const a = son3[i];
    return a
      ? `<div class="dft-node dolu" data-tip="S${a.sezon} H${a.hafta} — ${esc(a.b)}"><span class="dft-dot ${a.etki > 0 ? 'p' : 'm'}"></span><b>${esc(a.t)}</b></div>`
      : '<div class="dft-node" data-tip="Büyük kararlar kendini buraya yazar"><span class="dft-dot"></span><b>karar bekleniyor</b></div>';
  }).join('<span class="dft-ciz"></span>');
  return `<div class="card"><div class="overline">Başkanın Defteri <span class="muted" style="float:right;font-size:11px">${n} an</span></div>
    <div class="dft-timeline">${nodes}</div>
  </div>`;
}

// ── BAŞARIM ÖZETİ — 6 kategori çubuğu + "en yakın 3 hedef" + Tümünü Gör (modal) ──
const KAT_META = {
  Koltuk: { ikon: '🪑', renk: '212,169,64' },
  Saha: { ikon: '⚽', renk: '63,191,127' },
  Kasa: { ikon: '💰', renk: '240,205,110' },
  Ocak: { ikon: '🌱', renk: '110,200,120' },
  Kimlik: { ikon: '🛡', renk: '120,150,235' },
  Acı: { ikon: '🔥', renk: '224,110,82' },
};
const KAT_SIRA = ['Koltuk', 'Saha', 'Kasa', 'Ocak', 'Kimlik', 'Acı'];
function achDefs(G) { return (G.data.achievements && (G.data.achievements.achievements || G.data.achievements)) || []; }
function basarimOzet(G) {
  const defs = achDefs(G);
  if (!defs.length) return '';
  const u = G.achUnlocked || {};
  const acik = defs.filter((d) => u[d.id]).length;
  const kats = {};
  for (const d of defs) (kats[d.category] = kats[d.category] || []).push(d);
  const bars = KAT_SIRA.filter((k) => kats[k]).map((k) => {
    const list = kats[k], m = KAT_META[k] || { ikon: '🏅', renk: '212,169,64' };
    const n = list.filter((d) => u[d.id]).length;
    return `<div class="achsum-row"><span class="achsum-ik">${m.ikon}</span><b>${esc(k)}</b>
      <span class="achsum-track"><b style="width:${Math.max(3, Math.round((n / list.length) * 100))}%;background:rgb(${m.renk})"></b></span><em class="tnum">${n}/${list.length}</em></div>`;
  }).join('');
  // "En yakın 3": kategori sırasına göre ilk kilitli başarımlar — oyuncuya somut hedef
  const hedefler = [];
  for (const k of KAT_SIRA) {
    for (const d of (kats[k] || [])) { if (!u[d.id]) { hedefler.push(d); break; } }
    if (hedefler.length >= 3) break;
  }
  return `<div class="card"><div class="overline">Başarımlar <span class="muted" style="float:right;font-size:11px">${acik}/${defs.length} açık</span></div>
    <div class="achsum-list">${bars}</div>
    ${hedefler.length ? `<div class="achsum-hedef"><span class="micro">En yakın hedefler</span>
      ${hedefler.map((d) => `<div class="achsum-h">▸ <b>${esc(d.name)}</b></div>`).join('')}</div>` : ''}
    <button class="cx-btn" data-act="achModal" style="margin-top:8px;width:100%">Tümünü Gör → (${defs.length} başarım)</button>
  </div>`;
}

// ── BAŞARIM MODALI — tam duvar (48 madalyon) buraya taşındı; etiketler OKUNUR puntoda ──
export function renderAchModal(G) {
  const defs = achDefs(G);
  const u = G.achUnlocked || {};
  const kats = {};
  for (const d of defs) (kats[d.category] = kats[d.category] || []).push(d);
  const cats = Object.keys(kats).sort((a, b) => KAT_SIRA.indexOf(a) - KAT_SIRA.indexOf(b));
  const madalyon = (d, m) => {
    const on = !!u[d.id];
    const hc = on && u[d.id].hardcore;
    return `<div class="ach-med ${on ? 'on' : 'off'}" style="--m:${m.renk}" title="${esc(d.name)}${on ? '' : ' · kilitli'}">
      <span class="ach-disk">${on ? (hc ? '☠' : m.ikon) : '🔒'}</span>
      <span class="ach-ad">${esc(d.name)}</span>
    </div>`;
  };
  return `<div class="pcard-ovl" data-act="achModal">
    <div class="pcard ach-modal" data-act="noop">
      <button class="pc-close" data-act="achModal" aria-label="Kapat">✕</button>
      <div class="overline">Başarım Duvarı <span class="muted" style="font-size:11px">· ${defs.filter((d) => u[d.id]).length}/${defs.length} açık</span></div>
      <div class="ach-cats" style="margin-top:8px">${cats.map((k) => {
    const list = kats[k]; const m = KAT_META[k] || { ikon: '🏅', renk: '212,169,64' };
    const n = list.filter((d) => u[d.id]).length;
    return `<div class="ach-cat" style="--m:${m.renk}">
      <div class="ach-cat-head"><span class="ach-cat-ikon">${m.ikon}</span><b>${esc(k)}</b><i>${n}/${list.length}</i></div>
      <div class="ach-med-grid">${list.map((d) => madalyon(d, m)).join('')}</div>
    </div>`;
  }).join('')}</div>
    </div>
  </div>`;
}
