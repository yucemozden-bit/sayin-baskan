// src/ui/transferView.js — TRANSFER MERKEZİ v2 (§1: SALT-OKUNUR pazar görünümü).
// TÜM transfer aksiyonu inbox'taki GM dosyalarında; burası bilgi + ilan ekranı.
// FIFA pazar hissi: kadroyla aynı dil — güç plakalı scout kartları, etiketli
// direktif hücreleri, LED kalan bütçe. Tam ekran, kaydırma yok.
import { TUNING } from '../config.js';
import { esc, fmt } from './frame.js';
import { shownRating } from '../engines/market.js';

const lineTr = { genc: 'Gençlere yatır', hazir: 'Hazır oyuncu', yildiz: 'Yıldız istiyorum' };
const POS_TR = { GK: 'Kaleci', DEF: 'Stoper', MID: 'Orta saha', FWD: 'Forvet' };
const POS_COL = { GK: 'var(--club)', DEF: 'var(--info)', MID: 'var(--pos)', FWD: 'var(--warn)' };

export function render(G) {
  const dir = G.directive || {};
  const spent = G.termSpent || 0;
  const kalan = Math.max(0, (dir.budget || 0) - spent);
  const pct = dir.budget ? Math.min(100, Math.round((spent / dir.budget) * 100)) : 0;
  const barCol = pct > 85 ? 'var(--neg)' : pct > 60 ? 'var(--warn)' : 'var(--club)';
  const maasYuk = Math.round((G.squad || []).reduce((a, p) => a + (p.wage || 0), 0) * 10) / 10; // kadro maaş yükü (mn/sezon)

  // ── Direktif paneli: TEK çubuk (tavan+harcanan+kalan tekrarı bitti) + maaş yükü ──
  const dirPanel = `<div class="tr-panel tr-direktif">
    <div class="cx-panel-head"><span class="overline">Dönem Direktifi</span><span class="cx-hint">GM'in çerçevesi</span></div>
    <div class="tr-kalan"><i>KULLANILABİLİR</i><b class="led">${fmt(kalan)}<span>/ ${fmt(dir.budget || 0)}mn</span></b></div>
    <div class="tr-butce-bar" data-tip="Harcanan ${fmt(spent)}mn / tavan ${fmt(dir.budget || 0)}mn">
      <div style="width:${pct}%;background:${barCol}"></div>
    </div>
    <div class="tr-cells">
      <span class="tr-cell" data-tip="Tek transferde teklif edilebilecek en yüksek yıllık maaş"><i>MAAŞ TAVANI</i><b>${fmt(dir.wageCap || 0)}mn<em>/sezon</em></b></span>
      <span class="tr-cell" data-tip="Mevcut kadronun toplam yıllık maaşı — bedel değil, maaş batırır kulübü"><i>KADRO MAAŞ YÜKÜ</i><b>${fmt(maasYuk)}mn<em>/sezon</em></b></span>
      <span class="tr-cell"><i>ÇİZGİ</i><b>${lineTr[dir.line] || '—'}</b></span>
    </div>
    <button class="cx-btn" data-act="kurulButce" ${G._kurulButceDonem === (G.meta?.term || 1) || G.mode === 'aile' ? 'disabled' : ''} data-tip="Dönemde 1 kez: kurulun mali güveni ≥55 ise tavan +%15 (Mali −6); zayıfsa RET + Mali −3" style="margin-top:8px;width:100%">🏛 Kurula bütçe artışı iste</button>
  </div>`;

  // ── Pencere kapalı: sade sahne ──
  if (!G.transferWindow) {
    return `<div class="tr-wrap tr-kapali">
      <div class="tr-head">
        <div><div class="overline">Transfer Merkezi</div><h2>Pazar</h2></div>
        <span class="tr-durum kapali">PENCERE KAPALI</span>
      </div>
      <div style="max-width:520px">${dirPanel}
      <p class="muted" style="margin-top:12px;font-size:13px">Pencere açılınca ${esc(G.gm?.name || 'GM')} onay dosyalarını inbox'a getirir. Sen transfer yapmazsın — <b style="color:var(--ink-1)">ONAYLARSIN</b>.</p></div>
    </div>`;
  }

  // Kadro derinliği — zayıf hat hem ilanda hem piyasa "ihtiyaç" vurgusunda kullanılır
  const POS_LIST = ['GK', 'DEF', 'MID', 'FWD'];
  const derin = {};
  for (const pos of POS_LIST) {
    const l = G.squad.filter((x) => x.pos === pos);
    const yasOrt = l.length ? Math.round(l.reduce((a, b) => a + b.age, 0) / l.length) : 0;
    derin[pos] = { n: l.length, ort: l.length ? Math.round(l.reduce((a, b) => a + b.overall, 0) / l.length) : 0, yas: yasOrt };
  }
  const zayif = POS_LIST.reduce((a, b) => (derin[a].ort <= derin[b].ort ? a : b));
  const yasli = POS_LIST.reduce((a, b) => (derin[a].yas >= derin[b].yas ? a : b)); // yaşlanan hat → genç arayışı

  // ── İlan paneli ──
  const ilanPanel = G.ilan
    ? `<div class="tr-panel tr-ilan-aktif">
        <div class="cx-panel-head"><span class="overline">İlan Yayında</span><span class="badge">${G.ilan.kalan} cevap hakkı</span></div>
        <div class="tr-ilan-ozet">
          <span class="tr-pos-chip" style="--pc:${POS_COL[G.ilan.pos]}">${POS_TR[G.ilan.pos]}</span>
          <span class="muted">yaş ≤${G.ilan.yasMax} · tavan ${G.ilan.tavan}mn</span>
        </div>
        <div class="tr-not">AI kulüpler dosya gönderiyor — cevaplar deadline'a doğru yoğunlaşır.</div>
      </div>`
    : (() => {
      // İlan KADRODAN BESLENİR — çeşitli: mevkiye göre (derinlik) + özel arayış (arketip).
      const yasMax = { genc: 23, hazir: 28, yildiz: 30 }[dir.line] || 28;
      const tavan = Math.max(10, Math.min(60, Math.round(kalan * 0.8) || 40));
      const seekNot = { genc: 'gelişim odaklı genç', hazir: 'kanıtlanmış hazır isim', yildiz: 'yıldız kalibresi' }[dir.line] || 'dengeli profil';
      // 1) Mevkiye göre — 4 hat kartı (derinlik + yaş + aranan)
      const btns = POS_LIST.map((k) => `<button class="tr-ilan-btn ${k === zayif ? 'zayif' : ''}" data-act="ilan" data-arg="${k}|${yasMax}|${tavan}" style="--pc:${POS_COL[k]}" data-tip="${seekNot} aranır · ${derin[k].n} oyuncu, ort ${derin[k].ort} güç, yaş ort ${derin[k].yas}">
          <b>${POS_TR[k]}${k === zayif ? ' <span class="tr-gm-oneri">ZAYIF</span>' : ''}</b>
          <i>${derin[k].n} kişi · ort ${derin[k].ort} · ≤${yasMax}y · ${tavan}mn</i>
        </button>`).join('');
      // 2) Özel arayış — arketip profilleri (çeşitlilik + belirgin sonuç)
      const yildizTavan = Math.max(35, Math.min(75, Math.round(kalan) || 60));
      const ozel = [
        { k: 'yildiz', ik: '⭐', ad: 'Yıldız Avı', hedef: zayif, yas: 31, tavan: yildizTavan, not: `${POS_TR[zayif]} · tribün coşar, kasa zorlanır`, cls: 'yildiz' },
        { k: 'genc', ik: '🌱', ad: 'Genç Yetenek', hedef: yasli, yas: 20, tavan: Math.max(10, Math.round(tavan * 0.5)), not: `${POS_TR[yasli]} (yaşlanan hat) · gelecek yatırımı`, cls: '' },
        { k: 'kelepir', ik: '💰', ad: 'Kelepir Fırsatı', hedef: zayif, yas: 31, tavan: 15, not: `${POS_TR[zayif]} · bütçe yormaz, sürpriz çıkabilir`, cls: '' },
      ].map((o) => `<button class="tr-ilan-btn tr-ilan-ozel ${o.cls}" data-act="ilan" data-arg="${o.hedef}|${o.yas}|${o.tavan}" style="--pc:${POS_COL[o.hedef]}" data-tip="${o.not}">
          <b>${o.ik} ${o.ad} <span class="tr-ozel-hedef">${POS_TR[o.hedef]}</span></b><i class="krit">≤${o.yas}y · tavan ${o.tavan}mn</i>
        </button>`).join('');
      return `<div class="tr-panel">
        <div class="cx-panel-head"><span class="overline">İhtiyaç İlanı Ver</span><span class="cx-hint">mevki + arketip</span></div>
        <div class="tr-ilan-sub">MEVKİYE GÖRE</div>
        <div class="tr-ilan-grid">
          ${btns}
        </div>
        <div class="tr-ilan-sub">ÖZEL ARAYIŞ</div>
        <div class="tr-ilan-grid tr-ilan-grid3">
          ${ozel}
        </div>
        <div class="tr-not">⚠ İlan sızar: sosyal akış yazar, o mevkideki oyuncuların morali kırılır ("yerime mi?").</div>
      </div>`;
    })();

  // ── Scout pazarı: BÜTÇE-PİYASA BAĞI (✔/⚠/✖) + ilgi/süre baskısı + bedel ARALIĞI (sis) ──
  const fog = Math.max(1, TUNING.FOG_BASE - G.facilities.scout * TUNING.FOG_PER_SCOUT);
  const h = Math.ceil(fog / 2);
  const hak = G.sorguHak ?? 0;
  const filtre = G._trFiltre || 'hepsi';
  const askOf = (p) => Math.round((p.fee || p.marketValue || 0) * (1 + (p._ilgi || 0) * 0.12)); // ilgi bedeli şişirir
  // GİZLİ REYTİNG: liste GÖRÜNEN güce göre sıralanır (gerçek güce göre sıralamak gerçeği sızdırırdı)
  const gorun = (p) => (p._sorgu ? p._sorgu.guc : shownRating(p, G.facilities.scout, G.meta.week).deger);
  let list = (G.market || []).slice().sort((a, b) => gorun(b) - gorun(a));
  const nButce = list.filter((p) => askOf(p) <= kalan).length;
  const nMevki = list.filter((p) => p.pos === zayif).length;
  const nToplam = list.length;
  if (filtre === 'butce') list = list.filter((p) => askOf(p) <= kalan);
  else if (filtre === 'mevki') list = list.filter((p) => p.pos === zayif);
  // SAYFALAMA (A8: 80+ havuz — 10'ar isim, ‹ › ile gez)
  const toplamSayfa = Math.max(1, Math.ceil(list.length / 10));
  const sayfa = Math.min(G._trSayfa || 0, toplamSayfa - 1);
  const pageList = list.slice(sayfa * 10, sayfa * 10 + 10);
  const pager = toplamSayfa > 1 ? `<div class="tr-pager">
      <button class="cx-btn" data-act="trSayfa" data-arg="-1" ${sayfa === 0 ? 'disabled' : ''}>‹</button>
      <span class="tnum">Sayfa ${sayfa + 1}/${toplamSayfa} · ${list.length} isim</span>
      <button class="cx-btn" data-act="trSayfa" data-arg="1" ${sayfa >= toplamSayfa - 1 ? 'disabled' : ''}>›</button>
    </div>` : '';
  const filtreBar = `<div class="tr-filtre">
    <button class="cx-btn ${filtre === 'butce' ? 'on' : ''}" data-act="trFiltre" data-arg="butce">Bütçeme uyanlar (${nButce})</button>
    <button class="cx-btn ${filtre === 'mevki' ? 'on' : ''}" data-act="trFiltre" data-arg="mevki">İhtiyacım: ${POS_TR[zayif]} (${nMevki})</button>
    <button class="cx-btn ${filtre === 'hepsi' ? 'on' : ''}" data-act="trFiltre" data-arg="hepsi">Hepsi (${nToplam})</button>
  </div>`;
  const tiles = pageList.map((p) => {
    const sr = gorun(p); // GÖRÜNEN güç — gerçek (p.overall) UI'a asla basılmaz
    const srH = p._sorgu ? (p._sorgu.h ?? 1) : h;
    const tier = sr >= 75 ? 't1' : sr >= 60 ? 't2' : sr >= 45 ? 't3' : 't4';
    const s = p._sorgu;
    const ask = askOf(p);
    const durum = ask <= kalan * 0.85 ? 'in' : ask <= kalan ? 'sinir' : 'dis';
    const durumEt = { in: '✔ bütçe içi', sinir: '⚠ sınırda', dis: '✖ bütçe dışı' }[durum];
    const lo = Math.round(ask * (1 - 0.03 * h)), hi = Math.round(ask * (1 + 0.03 * h));
    return `<div class="tr-tile ${tier} ${s ? 'sorgulandi' : ''} bt-${durum} ${p.pos === zayif ? 'ihtiyac' : ''}" style="--pc:${POS_COL[p.pos]}">
      <div class="kad-rate" data-tip="${s ? (srH === 0 ? 'DERİN RAPOR: kesin güç' : 'Sorgulandı: güç ±' + srH) : `Gözlem tahmini ±${h} — gerçek güç imzadan sonra sahada belli olur`}"><b>${sr}</b><i>${srH === 0 ? '✓' : '±' + srH}</i></div>
      <div class="tr-tile-mid">
        <b>${esc(p.name)}</b>
        <span><span class="tr-pos-chip" style="--pc:${POS_COL[p.pos]}">${p.pos}</span> ${p.age} yaş · söz. ${p.contractYears ?? '—'}y
          ${(p._ilgi || 0) > 0 ? `<span class="tr-ilgi" data-tip="Rakip ilgisi bedeli şişirir (+%12/kulüp)">🔥 ${p._ilgi}</span>` : ''}
          ${p._kalan != null ? `<span class="tr-sure ${p._kalan <= 1 ? 'krit' : ''}" data-tip="Dosya bu kadar hafta sonra kapanır — beklersen rakibe gider">⏳ ${p._kalan}h</span>` : ''}
        </span>
      </div>
      <span class="tr-bedel"><i>TAHMİNİ BEDEL</i><b>~${fmt(ask)}mn</b><em class="tr-aralik">(${lo}–${hi})</em><span class="tr-bt-et ${durum}">${durumEt}</span></span>
      ${s
      ? `<button class="cx-btn tr-teklif" data-act="reqOffer" data-arg="${p.id}" data-tip="GM bu oyuncu için onay dosyası hazırlar (inbox)">Teklif İste →</button>
         <div class="tr-sorgu">Güç <b>${s.guc}${s.h === 0 ? ' (kesin)' : ' ±' + (s.h ?? 1)}</b> · maaş <b>${fmt(s.maas)}mn</b> · bonservis <b>~${fmt(s.bonservis)}mn</b> <span class="tr-sorgu-tavir tavir-${s.tavir.toLowerCase()}">menajer: ${s.tavir}</span>
           ${p._derin ? `<span class="tr-derin">🔬 Gelişim: ${esc(p._derin.pot)} · İlgilenen: ${p._derin.kulupler.length ? esc(p._derin.kulupler.join(', ')) : 'yok'}</span>` : `<button class="cx-btn tr-derin-btn" data-act="derinRapor" data-arg="${p.id}" ${G.economy.kasa < 0.8 ? 'disabled' : ''} data-tip="Dış büro: KESİN güç + gelişim bandı + İSİMLİ rakip ilgisi">🔬 Derin Rapor (0,8mn)</button>`}
           <br><span class="muted">Karakter: ${esc(s.karakter || '—')} · sakatlık: ${esc(s.sakatlik || '—')} · ilgilenen kulüp: ${s.ilgi ?? 0} · ${esc(s.whisper)}</span></div>`
      : durum === 'dis'
        ? `<button class="cx-btn tr-gm-itiraz" data-act="gmItiraz" data-arg="${p.id}" data-tip="Bütçe dışı — GM'in görüşünü al">💬 GM görüşü</button>`
        : hak <= 0
          ? `<button class="cx-btn tr-sorgula" data-act="sorgula" data-arg="${p.id}|ucret" ${G.economy.kasa < 0.2 ? 'disabled' : ''} data-tip="Haftalık hak doldu — dış büroya ücretli sorgu">🔍 Sorgula (0,2mn)</button>`
          : `<button class="cx-btn tr-sorgula" data-act="sorgula" data-arg="${p.id}" data-tip="Rapor: güç ±1, maaş, bonservis, karakter, sakatlık, menajer">🔍 Sorgula (${hak} hak)</button>`}
    </div>`;
  }).join('');
  const scoutPanel = `<div class="tr-panel tr-scout">
    <div class="cx-panel-head"><span class="overline">Scout Raporu · Piyasadaki İsimler</span><span class="cx-hint" data-tip="Gözlemci ağın güçlendikçe sis daralır ve haftalık sorgu hakkın artar">sis ±${h} · sorgu ${hak} hak</span></div>
    ${filtreBar}
    <div class="tr-market">${tiles || '<div class="muted">Bu filtrede isim yok — filtreyi genişlet.</div>'}</div>
    ${pager}
    <div class="tr-not">${esc(G.gm?.name || 'GM')} bu havuzdan direktifine uygun dosyaları masana getirecek — onay/red/pazarlık <b>inbox'ta</b>.</div>
  </div>`;

  // ── AÇIK DOSYALAR — boş alt yarı doldu: masadaki her sürecin durumu + Inbox köprüsü ──
  const acik = (G.inbox || []).filter((m) => !m.resolved && (m.action === 'tfile' || m.action === 'sfile'));
  const dosyaRows = acik.map((m) => {
    const pl = m.file && m.file.player;
    const ad = pl ? pl.name : (m.file && m.file.playerId ? (G.squad.find((x) => x.id === m.file.playerId) || {}).name : '—') || '—';
    const durum = m.action === 'tfile'
      ? ((m.file && m.file.round) ? `KARŞI TEKLİF · TUR ${m.file.round}` : 'TEKLİF MASADA')
      : 'SATIŞ TEKLİFİ';
    const tutar = m.action === 'tfile' ? (m.file ? m.file.fee : 0) : (m.file ? m.file.offer : 0);
    return `<div class="tr-dosya-row">
      <b>${esc(ad)}</b><span class="tr-dosya-durum ${m.action}">${durum}</span><span class="tnum">${fmt(tutar || 0)}mn</span>
      ${m.deadline ? '<span class="tr-sure krit">⏳ bu hafta kapanır</span>' : ''}
      <button class="cx-btn" data-act="nav" data-arg="inbox">Karar ver →</button>
    </div>`;
  }).join('');
  const dosyalarPanel = `<div class="tr-panel tr-dosyalar">
    <div class="cx-panel-head"><span class="overline">Açık Dosyalar</span><span class="cx-hint">${acik.length} dosya${G.ilan ? ' · ilan yayında' : ''}</span></div>
    ${dosyaRows || '<div class="muted" style="font-size:12px;padding:6px 0">Masada açık dosya yok — sorgula, teklif iste; süreçler burada akar.</div>'}
  </div>`;

  // ── SEKMELER: PİYASA | SATIŞ LİSTEM | GELEN TEKLİFLER (A8) ──
  const tab = G._trTab || 'piyasa';
  const vitrinli = G.squad.filter((p) => p.vitrin);
  const listede = G.squad.filter((p) => p.kiralikListe && !p.loanIn);
  const gelenSatis = acik.filter((m) => m.action === 'sfile');
  const tabsBar = `<div class="tr-tabs">
    <button class="tr-tab ${tab === 'piyasa' ? 'on' : ''}" data-act="trTab" data-arg="piyasa">PİYASA</button>
    <button class="tr-tab ${tab === 'satis' ? 'on' : ''}" data-act="trTab" data-arg="satis">SATIŞ LİSTEM (${vitrinli.length})</button>
    <button class="tr-tab ${tab === 'teklif' ? 'on' : ''}" data-act="trTab" data-arg="teklif">GELEN TEKLİFLER (${gelenSatis.length})</button>
  </div>`;

  // SATIŞ LİSTEM: vitrindekiler + kiralık listedekiler + GM'in satış önerileri
  const satisRow = (p, tipEt) => `<div class="tr-dosya-row">
      <b>${esc(p.name)}</b><span class="tr-pos-chip" style="--pc:${POS_COL[p.pos]}">${p.pos}</span>
      <span class="tnum">${p.overall} güç · ${p.age}y</span><span class="tnum">değer ${fmt(p.marketValue)}mn</span>
      ${tipEt}
    </div>`;
  const oneriler = G.squad.filter((p) => !p.vitrin && !p.loanIn && p.id !== G.captainId)
    .sort((a, b) => b.marketValue - a.marketValue).slice(0, 5);
  const satisPanel = `<div class="tr-panel">
    <div class="cx-panel-head"><span class="overline">Satış Listem</span><span class="cx-hint">vitrindekilere teklifler 2-4 haftada telefonla gelir</span></div>
    ${vitrinli.length ? vitrinli.map((p) => satisRow(p, `<button class="cx-btn" data-act="vitrin" data-arg="${p.id}">↩ listeden çek</button>`)).join('') : '<div class="muted" style="font-size:12px;padding:6px 0">Satış listesi boş — aşağıdan vitrine koy, bütçe rahatlasın.</div>'}
    ${listede.length ? `<div class="tr-ilan-sub" style="margin-top:10px">KİRALIK LİSTESİNDE</div>${listede.map((p) => satisRow(p, `<button class="cx-btn" data-act="kiralikListe" data-arg="${p.id}">↩ çek</button>`)).join('')}` : ''}
    <div class="tr-ilan-sub" style="margin-top:10px">GM ÖNERİSİ — EN DEĞERLİLER</div>
    ${oneriler.map((p) => satisRow(p, `<button class="cx-btn" data-act="vitrin" data-arg="${p.id}" data-tip="Menajerlere sinyal gider — moral bedeli var">🏷 satışa çıkar</button>`)).join('')}
    <div class="tr-not">Bütçe dışı bir yıldız mı istiyorsun? Önce birini sat — kurul ancak öyle ikna olur.</div>
  </div>`;

  // GELEN TEKLİFLER: açık satış dosyaları (karar inbox'ta)
  const teklifPanel = `<div class="tr-panel">
    <div class="cx-panel-head"><span class="overline">Gelen Teklifler</span><span class="cx-hint">satış dosyaları · dev kulüp panik telefonları ayrıca çalar</span></div>
    ${gelenSatis.length ? gelenSatis.map((m) => {
    const pl = G.squad.find((x) => x.id === (m.file && m.file.playerId)) || {};
    return `<div class="tr-dosya-row"><b>${esc(pl.name || '—')}</b><span class="tr-dosya-durum sfile">SATIŞ TEKLİFİ</span><span class="tnum">${fmt((m.file && m.file.offer) || 0)}mn</span>${m.deadline ? '<span class="tr-sure krit">⏳ bu hafta</span>' : ''}<button class="cx-btn" data-act="nav" data-arg="inbox">Karar ver →</button></div>`;
  }).join('') : '<div class="muted" style="font-size:12px;padding:6px 0">Masada satış teklifi yok. Oyuncuyu vitrine koy — kulüpler kapıyı çalar.</div>'}
  </div>`;

  const icerik = tab === 'satis' ? `<div class="tr-tek">${satisPanel}</div>`
    : tab === 'teklif' ? `<div class="tr-tek">${teklifPanel}</div>`
      : `<div class="tr-grid"><div class="tr-sol">${dirPanel}${ilanPanel}</div>${scoutPanel}</div>${dosyalarPanel}`;

  return `<div class="tr-wrap">
    <div class="tr-head">
      <div><div class="overline">Transfer Merkezi</div><h2 class="tr-serif">Pazar Görünümü</h2></div>
      <div style="display:flex;gap:8px;align-items:center">
        ${acik.length ? `<button class="cx-btn" data-act="nav" data-arg="inbox" data-tip="Onay/red/pazarlık inbox'ta">📬 Masada ${acik.length} dosya → Inbox</button>` : ''}
        <span class="tr-durum acik">● PENCERE AÇIK</span>
      </div>
    </div>
    ${tabsBar}
    ${icerik}
  </div>`;
}
