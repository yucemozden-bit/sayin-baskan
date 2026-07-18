// src/ui/transferView.js — TRANSFER MASASI (sb- görsel katman, yeni konsept):
// SOL: TRANSFER HEDEFLERİ — arketip arama (genç/yıldız/kelepir ilanı) + mevki filtresi + hedef
// satırları (güç±, avatar, isim, mevki, değer/maaş, SORGULA/TEKLİF VER). Satıra tık → oyuncu kartı.
// SAĞ: BÜTÇE (kalan kese + maaş tavanı + kurula bütçe) + AKTİF PAZARLIK (açık GM dosyaları/gelen
// satış teklifleri → inbox'ta karar). Teklif mekaniği: reqOffer GM onay dosyası açar (tfile);
// ilan piyasayı genişletir. Hiçbir mekanik kaybı yok — kaydırma yok.
import { TUNING } from '../config.js';
import { esc, fmt } from './frame.js';
import { shownRating } from '../engines/market.js';
import { sbShell } from './cockpit.js';
import { playerAvatar } from './playerCard.js';

const POS_TR = { GK: 'Kaleci', DEF: 'Stoper', MID: 'Orta saha', FWD: 'Forvet' };
const POS_COL = { GK: 'var(--club)', DEF: 'var(--info)', MID: 'var(--pos)', FWD: 'var(--warn)' };
const lineTr = { genc: 'Gençlere yatır', hazir: 'Hazır oyuncu', yildiz: 'Yıldız istiyorum' };
const ovCls = (o) => (o >= 72 ? 'sb-ov-high' : o >= 60 ? 'sb-ov-mid' : 'sb-ov-low');

export function render(G) {
  const dir = G.directive || {};
  const spent = G.termSpent || 0;
  const sale = G.termSale || 0;
  const effBudget = (dir.budget || 0) + sale;
  const kalan = Math.max(0, effBudget - spent);
  const pct = effBudget ? Math.min(100, Math.round((spent / effBudget) * 100)) : 0;
  const barCol = pct > 85 ? 'var(--neg)' : pct > 60 ? 'var(--warn)' : 'var(--club)';
  const maasYuk = Math.round((G.squad || []).reduce((a, p) => a + (p.wage || 0), 0) * 10) / 10;
  const maasPct = dir.wageCap ? Math.min(100, Math.round((maasYuk / (dir.wageCap * 12)) * 100)) : 0;

  // ── BÜTÇE paneli (sağ üst) ──
  const butcePanel = `<div class="sb-panel tr-butce-panel">
    <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">BÜTÇE</span></div>
    <div class="trb-kalan"><span>Kalan bütçe</span><b class="${kalan <= effBudget * 0.15 ? 'neg' : ''}">${fmt(kalan)}<em>mn</em></b></div>
    <div class="sb-bar"><span class="sb-bar-fill" style="width:${100 - pct}%;background:${barCol}"></span></div>
    <div class="trb-note">${effBudget}mn keseden <b>${fmt(spent)}mn</b> harcandı${sale ? ` · satış +${fmt(sale)}mn` : ''}</div>
    <div class="trb-row"><span>Maaş tavanı (tek transfer)</span><b>${fmt(dir.wageCap || 0)}mn</b></div>
    <div class="trb-row"><span>Kadro maaş yükü</span><b>${fmt(maasYuk)}mn/sezon</b></div>
    <div class="sb-bar sb-bar-thin"><span class="sb-bar-fill" style="width:${maasPct}%;background:${maasPct > 85 ? 'var(--neg)' : 'var(--club-2)'}"></span></div>
    <div class="trb-row"><span>GM çizgisi</span><b>${lineTr[dir.line] || '—'}</b></div>
    <button class="tr-kurul-btn" data-act="kurulButce" ${G._kurulButceDonem === (G.meta?.term || 1) || G.mode === 'aile' ? 'disabled' : ''} data-tip="Dönemde 1 kez: kurulun mali güveni ≥55 ise tavan +%15 (Mali −6); zayıfsa RET + Mali −3">🏛 Kurula bütçe artışı iste</button>
  </div>`;

  // ── Pencere kapalı ──
  if (!G.transferWindow) {
    const body = `<div class="sb-two"><div class="sb-board">
      <div class="sb-panel" style="max-width:520px"><div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">PENCERE KAPALI</span></div>
      <p class="tr-kapali-p">Transfer penceresi kapalı. Pencere açılınca <b>${esc(G.gm?.name || 'GM')}</b> hedef havuzunu açar; sen arketip ilanı verir, teklifleri onaylarsın.</p></div>
    </div><aside class="sb-side">${butcePanel}</aside></div>`;
    return sbShell(G, { crumb: `TRANSFER · PENCERE KAPALI · KESE ≈${fmt(kalan)}MN`, title: 'Transfer Masası', body });
  }

  // Kadro derinliği — arketip hedeflemesi (zayıf hat / yaşlanan hat)
  const POS_LIST = ['GK', 'DEF', 'MID', 'FWD'];
  const derin = {};
  for (const pos of POS_LIST) {
    const l = G.squad.filter((x) => x.pos === pos);
    derin[pos] = { n: l.length, ort: l.length ? Math.round(l.reduce((a, b) => a + b.overall, 0) / l.length) : 0, yas: l.length ? Math.round(l.reduce((a, b) => a + b.age, 0) / l.length) : 0 };
  }
  const zayif = POS_LIST.reduce((a, b) => (derin[a].ort <= derin[b].ort ? a : b));
  const yasli = POS_LIST.reduce((a, b) => (derin[a].yas >= derin[b].yas ? a : b));

  // ── Arketip arama şeridi (ilan) ──
  const yasMax = { genc: 23, hazir: 28, yildiz: 30 }[dir.line] || 28;
  const tavan = Math.max(10, Math.min(60, Math.round(kalan * 0.8) || 40));
  const yildizTavan = Math.max(35, Math.min(75, Math.round(kalan) || 60));
  const arama = G.ilan
    ? `<div class="tr-ilan-live" data-tip="Menajerler ellerindekini getirir; kulüpler 1-3 haftada dosya yollar"><span class="tr-live-dot"></span>İLAN YAYINDA · <b>${POS_TR[G.ilan.pos]}</b> aranıyor · ${G.ilan.kalan} cevap hakkı</div>`
    : `<div class="tr-arama">
        <span class="tr-arama-lbl">ARA:</span>
        <button class="tr-arketip" data-act="ilan" data-arg="${yasli}|20|${Math.max(10, Math.round(tavan * 0.5))}" data-tip="${POS_TR[yasli]} (yaşlanan hat) · gelecek yatırımı · ≤20 yaş">🌱 Genç Yetenek</button>
        <button class="tr-arketip yildiz" data-act="ilan" data-arg="${zayif}|31|${yildizTavan}" data-tip="${POS_TR[zayif]} (en zayıf hat) · tribün coşar, kese zorlanır">⭐ Yıldız Avı</button>
        <button class="tr-arketip" data-act="ilan" data-arg="${zayif}|31|15" data-tip="${POS_TR[zayif]} · bütçe yormaz, sürpriz çıkabilir · tavan 15mn">💰 Kelepir</button>
      </div>`;

  // ── Hedef listesi (piyasa) — mevki filtresi + sisli güç aralığı ──
  // fogNarrow: "Gençleri izle" masa kararının kalıcı mikro scout etkisi (piyasa sisini daraltır)
  const fog = Math.max(1, TUNING.FOG_BASE - G.facilities.scout * TUNING.FOG_PER_SCOUT - (G.fogNarrow || 0));
  const h = Math.ceil(fog / 2);
  const hak = G.sorguHak ?? 0;
  const filtre = G._trFiltre && POS_LIST.includes(G._trFiltre) ? G._trFiltre : 'hepsi';
  const askOf = (p) => Math.round((p.fee || p.marketValue || 0) * (1 + (p._ilgi || 0) * 0.12));
  const gorun = (p) => (p._sorgu ? p._sorgu.guc : shownRating(p, G.facilities.scout, G.meta.week).deger);
  let list = (G.market || []).slice().sort((a, b) => gorun(b) - gorun(a));
  const sayac = { hepsi: list.length };
  for (const k of POS_LIST) sayac[k] = list.filter((p) => p.pos === k).length;
  if (filtre !== 'hepsi') list = list.filter((p) => p.pos === filtre);
  const perPage = 8;
  const toplamSayfa = Math.max(1, Math.ceil(list.length / perPage));
  const sayfa = Math.min(G._trSayfa || 0, toplamSayfa - 1);
  const pageList = list.slice(sayfa * perPage, sayfa * perPage + perPage);

  const filtreBar = `<div class="tr-filtre">
    <button class="tr-fbtn ${filtre === 'hepsi' ? 'on' : ''}" data-act="trFiltre" data-arg="hepsi">Tümü ${sayac.hepsi}</button>
    ${POS_LIST.map((k) => `<button class="tr-fbtn ${filtre === k ? 'on' : ''}" data-act="trFiltre" data-arg="${k}">${POS_TR[k]} ${sayac[k]}</button>`).join('')}
  </div>`;

  const row = (p) => {
    const sr = gorun(p);
    const srH = p._sorgu ? (p._sorgu.h ?? 1) : h;
    const ask = askOf(p);
    const durum = ask <= kalan * 0.85 ? 'in' : ask <= kalan ? 'sinir' : 'dis';
    const s = p._sorgu;
    const alt = s
      ? `${POS_TR[p.pos]} · ${p.age}y · maaş ${fmt(s.maas)}mn · menajer: ${esc(s.tavir)}`
      : `${POS_TR[p.pos]} · ${p.age}y · söz. ${p.contractYears ?? '—'}y${(p._ilgi || 0) > 0 ? ` · 🔥${p._ilgi} talip` : ''}`;
    const teklifBtn = durum === 'dis'
      ? `<button class="tr-tbtn dis" data-act="gmItiraz" data-arg="${p.id}" data-tip="Bütçe dışı — GM'in görüşünü al">Bütçe dışı</button>`
      : `<button class="tr-tbtn" data-act="reqOffer" data-arg="${p.id}" data-tip="GM ${p.name} için onay dosyası hazırlar — karar AKTİF PAZARLIK'ta">Teklif Ver</button>`;
    const sorguBtn = s
      ? (p._derin ? '<span class="tr-drapor" data-tip="Derin rapor alındı — kesin güç + isimli rakip ilgisi">🔬</span>'
        : `<button class="tr-sbtn" data-act="derinRapor" data-arg="${p.id}" ${G.economy.kasa < 0.8 ? 'disabled' : ''} data-tip="Dış büro: KESİN güç + gelişim + isimli rakip ilgisi (0,8mn)">🔬</button>`)
      : hak > 0
        ? `<button class="tr-sbtn" data-act="sorgula" data-arg="${p.id}" data-tip="Sorgula: güç ±1, maaş, karakter, menajer tavrı (${hak} hak)">🔍</button>`
        : `<button class="tr-sbtn" data-act="sorgula" data-arg="${p.id}|ucret" ${G.economy.kasa < 0.2 ? 'disabled' : ''} data-tip="Haftalık hak doldu — ücretli sorgu (0,2mn)">🔍</button>`;
    return `<div class="tr-tt" data-act="pcard" data-arg="${p.id}" data-tip="Kart: güç aralığı · form · değer · sözleşme">
      <span class="tr-tt-ov ${ovCls(sr)}">${sr}<i>±${srH}</i></span>
      <span class="tr-tt-av">${playerAvatar(p, 34)}</span>
      <div class="tr-tt-id"><b>${esc(p.name)}${p.age <= 21 ? ' <span class="tr-genc">GENÇ</span>' : ''}</b><i>${alt}</i></div>
      <span class="tr-tt-pos" style="color:${POS_COL[p.pos]}">${(POS_TR[p.pos] || p.pos).toLocaleUpperCase('tr')}</span>
      <span class="tr-tt-val"><b>${fmt(p.marketValue)}mn</b><em>~bedel ${fmt(ask)}mn</em></span>
      <span class="tr-tt-act">${sorguBtn}${teklifBtn}</span>
    </div>`;
  };
  const pager = toplamSayfa > 1 ? `<div class="tr-pager">
    <button class="tr-fbtn" data-act="trSayfa" data-arg="-1" ${sayfa === 0 ? 'disabled' : ''}>‹</button>
    <span>Sayfa ${sayfa + 1}/${toplamSayfa}</span>
    <button class="tr-fbtn" data-act="trSayfa" data-arg="1" ${sayfa >= toplamSayfa - 1 ? 'disabled' : ''}>›</button>
  </div>` : '';

  const hedefPanel = `<div class="sb-panel tr-hedef-panel">
    <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">TRANSFER HEDEFLERİ</span><span class="sb-panel-r" data-tip="Gözlemci ağın güçlendikçe sis daralır, sorgu hakkın artar">sis ±${h} · sorgu ${hak} hak</span></div>
    ${arama}
    ${filtreBar}
    <div class="tr-tt-list">${pageList.map(row).join('') || '<div class="tr-bos">Bu mevkide isim yok — arketip ilanı ver, menajerler yeni isim getirsin.</div>'}</div>
    ${pager}
  </div>`;

  // ── AKTİF PAZARLIK (açık GM dosyaları + gelen satış teklifleri) ──
  const acik = (G.inbox || []).filter((m) => !m.resolved && (m.action === 'tfile' || m.action === 'sfile'));
  const apRows = acik.map((m) => {
    const alis = m.action === 'tfile';
    const pl = m.file && (m.file.player || G.squad.find((x) => x.id === (m.file && m.file.playerId)));
    const ad = pl ? pl.name : '—';
    const tutar = alis ? (m.file ? m.file.fee : 0) : (m.file ? m.file.offer : 0);
    let tag, cls, durum;
    if (!alis) { tag = 'GELEN'; cls = 'sat'; durum = `Satış teklifi · ${fmt(tutar)}mn`; }
    else if (m.file && m.file.round) { tag = 'KARŞI TEKLİF'; cls = 'karsi'; durum = `Pazarlık turu ${m.file.round} · ${fmt(tutar)}mn`; }
    else { tag = 'İLETİLDİ'; cls = 'ilet'; durum = `Teklif iletildi · ${fmt(tutar)}mn · değerlendiriliyor`; }
    return `<div class="tr-ap" data-act="nav" data-arg="inbox" data-tip="Karar inbox'ta: onayla / pazarlık / reddet">
      <div class="tr-ap-id"><b>${esc(ad)}</b><i>${durum}</i></div>
      <span class="tr-ap-tag ${cls}">${tag}</span>
    </div>`;
  }).join('');
  const pazarlikPanel = `<div class="sb-panel tr-pazarlik-panel sb-panel-grow">
    <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">AKTİF PAZARLIK</span><span class="sb-panel-r">${acik.length} dosya</span></div>
    <div class="tr-ap-list">${apRows || '<div class="tr-bos">Masada açık dosya yok. Bir hedefe "Teklif Ver" — GM dosyayı hazırlar, karar buraya düşer.</div>'}</div>
    <div class="tr-ap-foot">Satmak için: Kadro → oyuncu kartı → <b>Satış listesi</b>. Vitrindekilere teklifler buraya gelir.</div>
  </div>`;

  const crumb = `TRANSFER · PENCERE AÇIK · KALAN ${fmt(kalan)}MN · TAVAN ${fmt(dir.wageCap || 0)}MN · GÖZLEM ±${h}`;
  const body = `<div class="sb-two tr-two">
    <div class="sb-board">${hedefPanel}</div>
    <aside class="sb-side tr-side">${butcePanel}${pazarlikPanel}</aside>
  </div>`;
  return sbShell(G, { crumb, title: 'Transfer Masası', body });
}
