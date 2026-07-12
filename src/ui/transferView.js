// src/ui/transferView.js — TRANSFER MERKEZİ v2 (§1: SALT-OKUNUR pazar görünümü).
// TÜM transfer aksiyonu inbox'taki GM dosyalarında; burası bilgi + ilan ekranı.
// FIFA pazar hissi: kadroyla aynı dil — güç plakalı scout kartları, etiketli
// direktif hücreleri, LED kalan bütçe. Tam ekran, kaydırma yok.
import { TUNING } from '../config.js';
import { esc, fmt } from './frame.js';

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
  let list = (G.market || []).slice().sort((a, b) => b.overall - a.overall);
  const nButce = list.filter((p) => askOf(p) <= kalan).length;
  const nMevki = list.filter((p) => p.pos === zayif).length;
  if (filtre === 'butce') list = list.filter((p) => askOf(p) <= kalan);
  else if (filtre === 'mevki') list = list.filter((p) => p.pos === zayif);
  list = list.slice(0, 10);
  const filtreBar = `<div class="tr-filtre">
    <button class="cx-btn ${filtre === 'butce' ? 'on' : ''}" data-act="trFiltre" data-arg="butce">Bütçeme uyanlar (${nButce})</button>
    <button class="cx-btn ${filtre === 'mevki' ? 'on' : ''}" data-act="trFiltre" data-arg="mevki">İhtiyacım: ${POS_TR[zayif]} (${nMevki})</button>
    <button class="cx-btn ${filtre === 'hepsi' ? 'on' : ''}" data-act="trFiltre" data-arg="hepsi">Hepsi</button>
  </div>`;
  const tiles = list.map((p) => {
    const tier = p.overall >= 75 ? 't1' : p.overall >= 60 ? 't2' : p.overall >= 45 ? 't3' : 't4';
    const s = p._sorgu;
    const ask = askOf(p);
    const durum = ask <= kalan * 0.85 ? 'in' : ask <= kalan ? 'sinir' : 'dis';
    const durumEt = { in: '✔ bütçe içi', sinir: '⚠ sınırda', dis: '✖ bütçe dışı' }[durum];
    const lo = Math.round(ask * (1 - 0.03 * h)), hi = Math.round(ask * (1 + 0.03 * h));
    return `<div class="tr-tile ${tier} ${s ? 'sorgulandi' : ''} bt-${durum} ${p.pos === zayif ? 'ihtiyac' : ''}" style="--pc:${POS_COL[p.pos]}">
      <div class="kad-rate" data-tip="Görünen güç ${p.overall - h}–${p.overall + h} (sis ±${h})"><b>${p.overall}</b><i>±${h}</i></div>
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
         <div class="tr-sorgu">Net güç <b>${s.guc}</b> · maaş <b>${fmt(s.maas)}mn</b> · bonservis <b>~${fmt(s.bonservis)}mn</b> <span class="tr-sorgu-tavir tavir-${s.tavir.toLowerCase()}">menajer: ${s.tavir}</span><br><span class="muted">Karakter: ${esc(s.karakter || '—')} · sakatlık geçmişi: ${esc(s.sakatlik || '—')} · ilgilenen kulüp: ${s.ilgi ?? 0} · ${esc(s.whisper)}</span></div>`
      : durum === 'dis'
        ? `<button class="cx-btn tr-gm-itiraz" data-act="gmItiraz" data-arg="${p.id}" data-tip="Bütçe dışı — GM'in görüşünü al">💬 GM görüşü</button>`
        : `<button class="cx-btn tr-sorgula" data-act="sorgula" data-arg="${p.id}" ${hak <= 0 ? 'disabled' : ''} data-tip="${hak <= 0 ? 'Haftalık sorgu hakkın doldu' : 'Derin rapor: maaş, bonservis, karakter, sakatlık, menajer'}">🔍 Sorgula (${hak} hak)</button>`}
    </div>`;
  }).join('');
  const scoutPanel = `<div class="tr-panel tr-scout">
    <div class="cx-panel-head"><span class="overline">Scout Raporu · Piyasadaki İsimler</span><span class="cx-hint" data-tip="Gözlemci ağın güçlendikçe sis daralır ve haftalık sorgu hakkın artar">sis ±${h} · sorgu ${hak} hak</span></div>
    ${filtreBar}
    <div class="tr-market">${tiles || '<div class="muted">Bu filtrede isim yok — filtreyi genişlet.</div>'}</div>
    <div class="tr-not">${esc(G.gm?.name || 'GM')} bu havuzdan direktifine uygun dosyaları masana getirecek — onay/red/pazarlık <b>inbox'ta</b>.</div>
  </div>`;

  // ── AÇIK DOSYALAR — boş alt yarı doldu: masadaki her sürecin durumu + Inbox köprüsü ──
  const acik = (G.inbox || []).filter((m) => !m.resolved && (m.action === 'tfile' || m.action === 'sfile'));
  const dosyaRows = acik.map((m) => {
    const pl = m.file && m.file.player;
    const ad = pl ? pl.name : (m.file && m.file.playerId ? (G.squad.find((x) => x.id === m.file.playerId) || {}).name : '—') || '—';
    const durum = m.action === 'tfile' ? 'TEKLİF MASADA' : 'SATIŞ TEKLİFİ';
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

  return `<div class="tr-wrap">
    <div class="tr-head">
      <div><div class="overline">Transfer Merkezi</div><h2 class="tr-serif">Pazar Görünümü</h2></div>
      <div style="display:flex;gap:8px;align-items:center">
        ${acik.length ? `<button class="cx-btn" data-act="nav" data-arg="inbox" data-tip="Onay/red/pazarlık inbox'ta">📬 Masada ${acik.length} dosya → Inbox</button>` : ''}
        <span class="tr-durum acik">● PENCERE AÇIK</span>
      </div>
    </div>
    <div class="tr-grid">
      <div class="tr-sol">${dirPanel}${ilanPanel}</div>
      ${scoutPanel}
    </div>
    ${dosyalarPanel}
  </div>`;
}
