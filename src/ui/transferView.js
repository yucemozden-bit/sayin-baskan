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
// playerAvatar yerine mini FORMA ikonu kullanılıyor (skaut dosyası dili)

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

  // ── BÜTÇE paneli (sağ üst) — her satır ETKİSİNİ kendisi söyler; gizli mekanikler görünür ──
  const haftalikMaas = Math.round(maasYuk / (TUNING.ECONOMY?.WEEKS_PER_YEAR || 52) * 10) / 10;
  const LINE_BANT = { genc: '17-21 yaş · güç 50-62', hazir: '24-28 yaş · güç 65-72', yildiz: 'tek isim · güç 78-85' };
  const ffp = G.ffp;
  const ffpPct = ffp ? Math.min(100, Math.round((ffp.spent / Math.max(1, ffp.limit)) * 100)) : 0;
  const ffpRenk = ffpPct > 90 ? 'var(--neg)' : ffpPct > 70 ? 'var(--warn)' : 'var(--pos)';
  const kurulKullanildi = G._kurulButceDonem === (G.meta?.term || 1);
  const butcePanel = `<div class="sb-panel tr-butce-panel">
    <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">BÜTÇE &amp; DİREKTİF</span><span class="sb-panel-r" data-tip="Makam Odası'nda verdiğin direktifin canlı takibi — kese sanaldır, para alım anında KASADAN çıkar">Makam kararın</span></div>
    <div class="trb-kalan"><span>KALAN KESE</span><b class="${kalan <= effBudget * 0.15 ? 'neg' : ''}">${fmt(kalan)}<em>mn</em></b></div>
    <div class="sb-bar"><span class="sb-bar-fill" style="width:${100 - pct}%;background:${barCol}"></span></div>
    <div class="trb-denklem" data-tip="Sattığın oyuncunun bedeli keseyi BÜYÜTÜR — satarak alım gücü yaratırsın">
      <span>Kese <b>${fmt(dir.budget || 0)}</b></span><i>+</i><span class="pos">Satış <b>${fmt(sale)}</b></span><i>−</i><span class="${spent ? 'neg' : ''}">Harcanan <b>${fmt(spent)}</b></span>
    </div>
    <div class="trb-etki">◆ Bedeli keseyi aşan isim <b>“Bütçe dışı”</b> düşer — ancak GM görüşüyle zorlanır</div>
    <div class="trb-row" data-tip="Pazarlıkta GM, oyuncu maaşını bu tavana ÇEKEREK anlaşır — yıldızların el freni"><span>Maaş tavanı <i>(tek transfer)</i></span><b>${fmt(dir.wageCap || 0)}mn/yıl</b></div>
    <div class="trb-row" data-tip="Kadronun yıllık maaş toplamı — her hafta kasandan sessizce kesilir"><span>Kadro maaş yükü</span><b>${fmt(maasYuk)}mn <em class="neg">(haftada −${fmt(haftalikMaas)})</em></b></div>
    ${ffp ? `<div class="trb-row" data-tip="Federasyon harcama limiti: transfer bedeli + maaş buna sayılır. Aşarsan taahhütname imzalarsın — gelecek gelirden kesilir${ffp.taahhut ? ' · TAAHHÜT AKTİF' : ''}"><span>FFP limiti</span><b style="color:${ffpRenk}">${fmt(ffp.spent)} / ${fmt(ffp.limit)}mn</b></div>
    <div class="sb-bar sb-bar-thin"><span class="sb-bar-fill" style="width:${ffpPct}%;background:${ffpRenk}"></span></div>` : ''}
    <div class="trb-row" data-tip="Makam'daki 'Gözüm kimde olsun?' kararın — GM dosyaları BU banttan getirir"><span>GM çizgisi</span><b>${lineTr[dir.line] || '—'} <em>· ${LINE_BANT[dir.line] || ''}</em></b></div>
    <button class="tr-kurul-btn" data-act="kurulButce" ${kurulKullanildi || G.mode === 'aile' ? 'disabled' : ''} data-tip="${G.mode === 'aile' ? 'Aile modunda kurul yok' : kurulKullanildi ? 'Bu dönem hakkını kullandın' : 'Dönemde 1 KEZ: kurulun mali güveni ≥55 ise kese +%15 büyür ama Mali −6 · mali güven zayıfsa RET + Mali −3 (hak yine yanar)'}">🏛 ${kurulKullanildi ? 'Kurul hakkı kullanıldı' : 'Kuruldan +%15 iste (Mali −6)'}</button>
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
  // ARKETİP KARTLARI (görsel+dinamik): her kart CANLI hedef okur — yaşlanan/en zayıf hat, bütçeye
  // göre tavan, rakip başkan indirimi. İlan yayındayken şerit büyük nabızlı duruma döner.
  const kelepirDost = ((G.bkRel || {})[G.opponents?.[0]?.id] ?? 50) >= 70;
  // TAHTA CEZASI GÖRÜNÜR (kullanıcı raporu: "basıyorum hareket etmiyor" — ilanVer sessizce
  // reddediyordu): FFP cezası varken kartlar yerine kilit şeridi; pencere kapalıysa da aynı.
  const tahtaBan = (G.flags?.transferBan || 0) > 0;
  const arama = tahtaBan
    ? `<div class="tr-ilan-live" style="border-color:var(--neg)" data-tip="FFP ikinci ihlal cezası — bu pencere GM dosya açamaz, ilan verilemez, onay dosyaları imzalanamaz">
        <span class="tr-live-dot" style="background:var(--neg)"></span>
        <div class="tr-ilan-id"><b style="color:var(--neg)">🚫 TRANSFER TAHTASI KAPALI</b><i>FFP cezası işliyor — ilan/onay bu pencere kilitli (kalan ${G.flags.transferBan} hafta). Satış serbest.</i></div>
      </div>`
    : !G.transferWindow
      ? `<div class="tr-ilan-live" data-tip="Pencere kapalıyken menajerlere ilan gitmez">
        <span class="tr-live-dot" style="background:var(--ink-3)"></span>
        <div class="tr-ilan-id"><b>PENCERE KAPALI</b><i>İlanlar transfer penceresi açılınca verilebilir — hedeflerini kısa listeye ekle, hazırlan.</i></div>
      </div>`
      : G.ilan
    ? `<div class="tr-ilan-live" data-tip="Menajerler ellerindekini getirir; kulüpler 1-3 haftada dosya yollar">
        <span class="tr-live-dot"></span>
        <div class="tr-ilan-id"><b>İLAN YAYINDA</b><i>${POS_TR[G.ilan.pos]} aranıyor · "İLAN" rozetli isimler listede · cevap dosyaları Inbox'a düşer</i></div>
        <span class="tr-ilan-hak">${G.ilan.kalan} cevap hakkı</span>
      </div>`
    : `<div class="tr-arama2">
        <button class="tr-ark genc" data-act="ilan" data-arg="${yasli}|20|${Math.max(10, Math.round(tavan * 0.5))}" data-tip="İlan ver — menajerler 1-3 haftada dosya getirir">
          <span class="tr-ark-ust">🌱 <b>Genç Yetenek</b></span>
          <i>${POS_TR[yasli]} · ≤20 yaş · tavan ${Math.max(10, Math.round(tavan * 0.5))}mn</i>
          <em>yaşlanan hatta gelecek yatırımı</em>
        </button>
        <button class="tr-ark yildiz" data-act="ilan" data-arg="${zayif}|31|${yildizTavan}" data-tip="İlan ver — büyük isimler pahalı gelir, tribün coşar">
          <span class="tr-ark-ust">⭐ <b>Yıldız Avı</b></span>
          <i>${POS_TR[zayif]} · tavan ${yildizTavan}mn</i>
          <em>en zayıf hatta yıldız — kese zorlanır</em>
        </button>
        <button class="tr-ark kelepir" data-act="ilan" data-arg="${zayif}|31|15" data-tip="İlan ver — ucuz dosyalar, sürpriz cevher çıkabilir">
          <span class="tr-ark-ust">💰 <b>Kelepir</b></span>
          <i>${POS_TR[zayif]} · tavan 15mn</i>
          <em>${kelepirDost ? '🤝 rakip başkan indirimi AKTİF' : 'bütçe yormaz, sürpriz çıkabilir'}</em>
        </button>
      </div>`;

  // ── Hedef listesi (piyasa) — mevki filtresi + sisli güç aralığı ──
  // fogNarrow: "Gençleri izle" masa kararının kalıcı mikro scout etkisi (piyasa sisini daraltır)
  const fog = Math.max(1, TUNING.FOG_BASE - G.facilities.scout * TUNING.FOG_PER_SCOUT - (G.fogNarrow || 0));
  const h = Math.ceil(fog / 2);
  const hak = G.sorguHak ?? 0;
  const kisaListe = new Set(G._shortlist || []);
  const filtre = G._trFiltre === 'kisa' || (G._trFiltre && POS_LIST.includes(G._trFiltre)) ? G._trFiltre : 'hepsi';
  const askOf = (p) => Math.round((p.fee || p.marketValue || 0) * (1 + (p._ilgi || 0) * 0.12));
  const gorun = (p) => (p._sorgu ? p._sorgu.guc : shownRating(p, G.facilities.scout, G.meta.week).deger);
  // SIRALAMA — başkanın masası kendi düzenini kurar (güç / bedel / yaş)
  const sirala = ['guc', 'bedel', 'yas'].includes(G._trSirala) ? G._trSirala : 'guc';
  const sortFn = sirala === 'bedel' ? (a, b) => askOf(a) - askOf(b) : sirala === 'yas' ? (a, b) => a.age - b.age : (a, b) => gorun(b) - gorun(a);
  let list = (G.market || []).slice().sort(sortFn);
  const sayac = { hepsi: list.length, kisa: list.filter((p) => kisaListe.has(p.id)).length };
  for (const k of POS_LIST) sayac[k] = list.filter((p) => p.pos === k).length;
  if (filtre === 'kisa') list = list.filter((p) => kisaListe.has(p.id));
  else if (filtre !== 'hepsi') list = list.filter((p) => p.pos === filtre);
  // HAT FARKI — bu isim o hattın mevcut ortalamasını ne kadar oynatır? (ilk-N hat ortalaması)
  const NEED = { GK: 1, DEF: 4, MID: 4, FWD: 2 };
  const hatOrt = {};
  for (const k of POS_LIST) {
    const iyi = G.squad.filter((x) => x.pos === k).sort((a, b) => b.overall - a.overall).slice(0, NEED[k]);
    hatOrt[k] = iyi.length ? iyi.reduce((s, x) => s + x.overall, 0) / iyi.length : 0;
  }
  const perPage = 8;
  const toplamSayfa = Math.max(1, Math.ceil(list.length / perPage));
  const sayfa = Math.min(G._trSayfa || 0, toplamSayfa - 1);
  const pageList = list.slice(sayfa * perPage, sayfa * perPage + perPage);

  const SIRA_TR = { guc: 'Güç', bedel: 'Bedel', yas: 'Yaş' };
  const filtreBar = `<div class="tr-filtre">
    <button class="tr-fbtn ${filtre === 'hepsi' ? 'on' : ''}" data-act="trFiltre" data-arg="hepsi">Tümü ${sayac.hepsi}</button>
    ${POS_LIST.map((k) => `<button class="tr-fbtn ${filtre === k ? 'on' : ''}" data-act="trFiltre" data-arg="${k}">${POS_TR[k]} ${sayac[k]}</button>`).join('')}
    <button class="tr-fbtn tr-fbtn-kisa ${filtre === 'kisa' ? 'on' : ''}" data-act="trFiltre" data-arg="kisa" data-tip="Kısa listen — satırdaki ★ ile isim ekle/çıkar">★ ${sayac.kisa}</button>
    <span class="tr-sirala"><i>SIRALA</i>${['guc', 'bedel', 'yas'].map((k) => `<button class="tr-fbtn mini ${sirala === k ? 'on' : ''}" data-act="trSirala" data-arg="${k}">${SIRA_TR[k]}</button>`).join('')}</span>
  </div>`;

  // SVG ikonlar — emoji yerine hat çizgisi (skaut dosyası dili)
  const IK = {
    buyutec: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8.5" cy="8.5" r="5"/><path d="M12.5 12.5L17 17"/></svg>',
    rapor: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h7l3 3v11H5z"/><path d="M12 3v3h3"/><path d="M7.5 10h5M7.5 13h5"/></svg>',
    kilit: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="5" y="9" width="10" height="7.5" rx="1.5"/><path d="M7 9V6.5a3 3 0 016 0V9"/></svg>',
    yildiz: '<svg viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M10 2.8l2.1 4.4 4.8.6-3.5 3.3.9 4.7L10 13.5l-4.3 2.3.9-4.7L3.1 7.8l4.8-.6z"/></svg>',
  };
  // Mini FORMA — pozisyon renkli SVG jersey: skaut dosyasında oyuncu, fotoğraf değil formadır
  const forma = (p) => `<svg class="tr-forma" viewBox="0 0 34 34">
      <path d="M10 5 L14 3 Q17 5 20 3 L24 5 L29 10 L25.5 13.5 L24.5 11.5 L24.5 29 Q17 31.5 9.5 29 L9.5 11.5 L8.5 13.5 L5 10 Z" fill="${POS_COL[p.pos]}" opacity=".22" stroke="${POS_COL[p.pos]}" stroke-width="1.4"/>
      <text x="17" y="21.5" text-anchor="middle" font-size="11" font-weight="800" fill="${POS_COL[p.pos]}">${{ GK: 'K', DEF: 'S', MID: 'O', FWD: 'F' }[p.pos] || '?'}</text>
    </svg>`;
  const row = (p) => {
    const sr = gorun(p);
    const srH = p._sorgu ? (p._sorgu.h ?? 1) : h;
    const ask = askOf(p);
    const durum = ask <= kalan * 0.85 ? 'in' : ask <= kalan ? 'sinir' : 'dis';
    const s = p._sorgu;
    const alt = s
      ? `${p.age} yaş · maaş ${fmt(s.maas)}mn · menajer: ${esc(s.tavir)}`
      : `${p.age} yaş · söz. ${p.contractYears ?? '—'}y${(p._ilgi || 0) > 0 ? ` · 🔥${p._ilgi} talip` : ''}`;
    // HAT FARKI — karar çipi: bu isim hattı oynatır mı?
    const fark = Math.round(sr - (hatOrt[p.pos] || 0));
    const farkChip = hatOrt[p.pos]
      ? `<span class="tr-fark ${fark >= 2 ? 'arti' : fark <= -2 ? 'eksi' : ''}" data-tip="${POS_TR[p.pos]} hattının ilk ${NEED[p.pos]} ortalaması ${Math.round(hatOrt[p.pos])} — bu isim hattı ${fark >= 0 ? 'yükseltir' : 'yükseltmez'}">${fark > 0 ? '▲ Dinamik +' + fark : fark < 0 ? '▼ Dinamik ' + fark : '— Dengede'}</span>` : '<span class="tr-fark"></span>';
    const yildizOn = kisaListe.has(p.id);
    const teklifBtn = durum === 'dis'
      ? `<button class="tr-tbtn dis" data-act="gmItiraz" data-arg="${p.id}" data-tip="Bütçe dışı — GM'in görüşünü al">${IK.kilit}<span>Bütçe dışı</span></button>`
      : `<button class="tr-tbtn" data-act="reqOffer" data-arg="${p.id}" data-tip="GM ${p.name} için onay dosyası hazırlar — karar AKTİF PAZARLIK'ta">Teklif Ver</button>`;
    const sorguBtn = s
      ? (p._derin ? `<span class="tr-ikbtn tam" data-tip="Derin rapor alındı — kesin güç + isimli rakip ilgisi">${IK.rapor}</span>`
        : `<button class="tr-ikbtn" data-act="derinRapor" data-arg="${p.id}" ${G.economy.kasa < 0.8 ? 'disabled' : ''} data-tip="Dış büro raporu: KESİN güç + gelişim + isimli rakip ilgisi (0,8mn)">${IK.rapor}</button>`)
      : hak > 0
        ? `<button class="tr-ikbtn" data-act="sorgula" data-arg="${p.id}" data-tip="Sorgula: güç ±1, maaş, karakter, menajer tavrı (${hak} hak)">${IK.buyutec}</button>`
        : `<button class="tr-ikbtn" data-act="sorgula" data-arg="${p.id}|ucret" ${G.economy.kasa < 0.2 ? 'disabled' : ''} data-tip="Haftalık hak doldu — ücretli sorgu (0,2mn)">${IK.buyutec}</button>`;
    return `<div class="tr-tt ${durum === 'dis' ? 'tr-tt-dis' : ''}" data-act="pcard" data-arg="${p.id}" data-tip="Kart: güç aralığı · form · değer · sözleşme">
      <span class="tr-tt-ov ${ovCls(sr)}">${sr}<i>±${srH}</i></span>
      <span class="tr-tt-av">${forma(p)}</span>
      <div class="tr-tt-id"><b>${esc(p.name)}${p._vitrinYildiz ? ' <span class="tr-vitrin" data-tip="Haftanın vitrini — scout ağının öne çıkardığı yüksek çıtalı isim">★ VİTRİN</span>' : ''}${p._yeniW != null && (G.meta?.week || 0) - p._yeniW <= 1 ? ' <span class="tr-yeni" data-tip="Bu hafta piyasaya düştü — scout ağı yeni buldu">YENİ</span>' : ''}${p.age <= 21 ? ' <span class="tr-genc">GENÇ</span>' : ''}${p._ilan ? ' <span class="tr-ilan-tag" data-tip="Bu isim SENİN İLANINLA piyasaya geldi — menajerler getirdi">İLAN</span>' : ''}</b><i>${alt}</i></div>
      ${farkChip}
      <span class="tr-tt-pos" style="color:${POS_COL[p.pos]};border-color:${POS_COL[p.pos]}">${(POS_TR[p.pos] || p.pos).toLocaleUpperCase('tr')}</span>
      <span class="tr-tt-val"><b>${fmt(ask)}<em>mn</em></b><i data-tip="Piyasa değeri — bedel talip sayısıyla şişer">değer ${fmt(p.marketValue)}mn</i></span>
      <span class="tr-tt-act">
        <button class="tr-ikbtn tr-star ${yildizOn ? 'on' : ''}" data-act="shortlist" data-arg="${p.id}" data-tip="${yildizOn ? 'Kısa listeden çıkar' : 'Kısa listeye ekle — ★ filtresiyle takip et'}">${IK.yildiz}</button>
        ${sorguBtn}${teklifBtn}
      </span>
    </div>`;
  };
  const pager = toplamSayfa > 1 ? `<div class="tr-pager">
    <button class="tr-fbtn" data-act="trSayfa" data-arg="-1" ${sayfa === 0 ? 'disabled' : ''}>‹</button>
    <span>Sayfa ${sayfa + 1}/${toplamSayfa}</span>
    <button class="tr-fbtn" data-act="trSayfa" data-arg="1" ${sayfa >= toplamSayfa - 1 ? 'disabled' : ''}>›</button>
  </div>` : '';

  const hedefPanel = `<div class="sb-panel tr-hedef-panel">
    <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">TRANSFER HEDEFLERİ</span><span class="sb-panel-r" data-tip="Gözlemci ağın güçlendikçe sis daralır, sorgu hakkın artar">${(() => { const v = (G.market || []).find((p) => p._vitrinYildiz && p._yeniW != null && (G.meta?.week || 0) - p._yeniW <= 1); return v ? `<span class="tr-vitrin" data-tip="Haftanın vitrini — scout ağının öne çıkardığı isim">★ ${esc(v.name)}</span> · ` : ''; })()}sis ±${h} · sorgu ${hak} hak</span></div>
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
