// src/ui/clubView.js — KULÜP KİMLİĞİ v3 (kulup-ekrani-inceleme.md):
// Boş kutular tek satıra indi, başarım duvarı MODAL'a taşındı (yerine 6 çubuklu özet +
// "en yakın 3 hedef"), oyunun omurgası geldi: MÜHÜRLÜ SÖZLER canlı ilerleme + KONGRE & GÜVEN
// paneli. Yönetim kadrosu sayısal fayda listesi. "Emekli Ol" Ayarlar'a taşındı.
import { esc, fmt } from './frame.js';
import { describeStaff, ROLE_TR } from '../models/staff.js';
import { promiseStatus } from '../actions.js';
import { bkIsim } from '../engines/iliski.js';
import { TIER_SIRA, TIER_TR, tierGorev } from '../engines/legacy.js';
import { bilet as ecoBilet } from '../engines/economy.js';
import { sbShell } from './cockpit.js';

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
  const tierTr = TIER_TR[G.club.tier] || G.club.tier;
  const tag = TAG_TR[G.currentTag] || TAG_TR.NORMAL;
  const mono = esc((G.club.name || 'S')[0]);

  // ── SOL: Künye — ikonlu satırlar; işaret edilen yere GİDEN satırlar tıklanabilir (ölü satır yok) ──
  const kL = (ik, ad, val, nav, tip) => `<div class="l ${nav ? 'klub-link' : ''}"${nav ? ` data-act="nav" data-arg="${nav}"` : ''}${tip ? ` data-tip="${esc(tip)}"` : ''}>
      <span>${ik} ${ad}</span><b>${val}${nav ? ' <i class="klub-ok">▸</i>' : ''}</b></div>`;
  const kunyeCard = `<div class="card klub-kunye"><span class="klub-arma-fil">${mono}</span>
    <div class="overline">Künye</div>
    <div class="fin-lines klub-kunye-lines">
      ${kL('🏛', 'Kuruluş', `<span class="tnum">${G.club.founded || '—'}</span>`)}
      ${G.club.sehir ? kL('📍', 'Şehir', esc(G.club.sehir)) : ''}
      ${kL('🏟', 'Stadyum', esc(G.club.stadName || '—'), 'tesis', 'Tesisler ekranına git — kapasite ve ihaleler orada')}
      ${kL('⚔', 'Ezeli rakip', esc(G.club.rivalName || '—'))}
      ${kL('🎖', 'Statü', `${tierTr} kulüp`)}
      ${kL('📣', 'Taraftar', `<span class="tnum">${(G.club.fanCount / 1000).toFixed(0)}b</span>`, 'kongre', 'Kongre ekranı — tribünün ve delegelerin nabzı')}
      ${kL('💼', 'Kadro değeri', `<span class="tnum">${fmt(G.club.kadroDeger)}mn</span>`, 'kadro', 'Kadro ekranına git — değerin kaynağı sahada')}
      ${kL('🗓', 'Dönem / Sezon', `<span class="tnum">${G.meta.term} / ${c.seasons || 0}</span>`)}
    </div></div>`;

  // sbShell (ortak tam-ekran kabuk): topbar zaten kulüp armasını+adını gösterir,
  // bu yüzden h1 → title'a taşındı. Kimlik kartının zengin içeriği (künye, anlatı
  // etiketi, müze, sözler, kongre, defter, başarım) body içinde AYNEN korunur.
  // .klub-root: fitSb ölçek kökü (SB_FIT_ROOTS) — arada overflow:hidden katman YOK ki
  // scrollHeight gerçek ihtiyacı ölçebilsin; taşma kırpılmaz, orantılı küçültülür.
  const body = `<div class="klub-root">
    <div class="klub-head">
      <span class="badge klub-tag" data-tip="Kulübün anlatı iklimi: güven + kurul + taraftar + borç durumundan türeyen dönem etiketi">${tag}</span>
    </div>
    <div class="klub-grid">
      <div class="klub-col">${kunyeCard}${tierYolu(G)}${muzeBlok(G)}</div>
      <div class="klub-col">${sozlerCard(G)}${yonetimCard(G)}${rekabetBlok(G)}${kamuoyuBlok(G)}</div>
      <div class="klub-col">${basarimOzet(G)}${kongreGuven(G)}${defterBlok(G)}</div>
    </div>
  </div>`;
  const crumb = `KULÜP · ${tierTr.toUpperCase()} KULÜP · KURULUŞ ${G.club.founded || '—'} · ${G.meta.term}. DÖNEM`;
  return sbShell(G, { crumb, title: 'Kulüp Kimliği', body });
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
      <button class="cx-btn cx-btn-sm" data-act="nav" data-arg="kongre" style="margin-top:4px" data-tip="Kongre salonu — delege blokları, kampanya, güven oyu">🏛 Kongre Salonu ▸</button>
    </div>
  </div>`;
}

// ── EZELİ REKABET — rakip başkan ilişkisi + kariyer derbi bilançosu + sonraki derbi radar ──
// Veriler canlı sistemlerden: G.bkRel (atışma/centilmenlik ikilemleri işler), G.derbi (maç motoru
// sayar), fikstür taraması. Ölü satır yok: her öğe tooltip'iyle nereden beslendiğini söyler.
function rekabetBlok(G) {
  const opp = (G.opponents || [])[0];
  if (!opp) return '';
  const bkAd = bkIsim(opp, G.data?.names);
  const rel = Math.round((G.bkRel || {})[opp.id] ?? 50);
  const durum = rel >= 70 ? ['CENTİLMEN', 'var(--pos)', 'Dostluk kapı açar: kelepir masasında indirim + sezonda 1 ortak hasılat gecesi ihtimali']
    : rel < 30 ? ['HUSUMET', 'var(--neg)', 'Atışmanın bedeli: kelepir masasında fiyat sana pahalanır']
      : ['MESAFELİ', 'var(--ink-2)', 'Ne dost ne düşman — derbi haftaları ve demeçler belirleyecek'];
  let derbiHafta = null, derbiEv = false;
  for (let w = G.meta.week; w <= (G.SEASON_WEEKS || 34); w++) {
    const round = G.league?.fixtures?.[w - 1]; if (!round) break;
    const pair = round.find((p) => (p.home === 'ME' && p.away === opp.id) || (p.home === opp.id && p.away === 'ME'));
    if (pair) { derbiHafta = w; derbiEv = pair.home === 'ME'; break; }
  }
  const d = G.derbi || { W: 0, D: 0, L: 0 };
  return `<div class="card rekabet-card">
    <div class="overline">Ezeli Rekabet <span class="rk-durum" style="color:${durum[1]}" data-tip="${esc(durum[2])}">${durum[0]}</span></div>
    <div class="rk-ust">
      <span class="rk-arma">${esc((opp.name || 'R')[0])}</span>
      <div class="rk-id"><b>${esc(opp.name)}</b><i>başkan: ${esc(bkAd)}</i></div>
      ${derbiHafta
    ? `<span class="rk-derbi" data-tip="${derbiEv ? 'İç saha' : 'Deplasman'} derbisi — o hafta şehir uyumaz, sonucu eve de taşınır">⚔ Hafta ${derbiHafta} · ${derbiEv ? '🏠 EV' : '✈ DEP'}</span>`
    : '<span class="rk-derbi sonuk">derbi bitti</span>'}
    </div>
    <div class="kg-row" data-tip="Rakip başkanla ilişki — derbi atışması küstürür, centilmenlik kapı açar (Özel Hayat ikilemleri + demeçler işler)">
      <span>BAŞKANLAR</span><span class="kg-track"><b style="width:${Math.max(3, rel)}%;background:${durum[1]}"></b></span><em class="tnum">%${rel}</em></div>
    <div class="rk-alt" data-tip="Kariyer boyu derbi bilançon — her derbi buraya işlenir">
      <span>Derbi bilanço</span>
      <b style="color:var(--pos)">${d.W}G</b><b>${d.D}B</b><b style="color:var(--neg)">${d.L}M</b>
    </div>
  </div>`;
}

// ── KAMUOYU & KİMLİK — başkanın kamusal yüzü: kimlik etiketi, kalem dostlukları, tribün doluluğu ──
function kamuoyuBlok(G) {
  const kalemler = Object.entries(G.pressRel || {}).slice(0, 3);
  const t = G.mediaTone || 0;
  const ton = t >= 1 ? ['SICAK', 'var(--pos)', 'Manşetler sana yumuşak — dost kalemler işliyor']
    : t <= -1 ? ['KESKİN', 'var(--neg)', 'Kalemler bilenmiş — söndürülmeyen manşetler iz bırakır']
      : ['NÖTR', 'var(--ink-2)', 'Basın bekliyor — demeç tonların kalem kalem ilişki yazar'];
  const dol = Math.round((ecoBilet(G).doluluk || 0) * 100);
  const kalemRows = kalemler.length ? kalemler.map(([ad, v]) => `<div class="kg-row" data-tip="Demeç tonların bu kalemle ilişkiyi yazar — ≥70 manşeti yumuşatır, <30 sivriltir">
      <span>${esc(ad).toLocaleUpperCase('tr')}</span><span class="kg-track"><b style="width:${Math.max(3, Math.round(v))}%;background:${v >= 70 ? 'var(--pos)' : v < 30 ? 'var(--neg)' : 'var(--club-2)'}"></b></span><em class="tnum">%${Math.round(v)}</em></div>`).join('')
    : '<div class="klub-bos" style="padding:4px 0">Kalemler seni henüz tanımıyor — demeç verdikçe ilişki yazılır.</div>';
  return `<div class="card">
    <div class="overline">Kamuoyu & Kimlik <span class="rk-durum" style="color:${ton[1]}" data-tip="${esc(ton[2])}">MEDYA ${ton[0]}</span></div>
    <div class="kamu-kimlik" data-tip="Tutarlı kararlar kamuoyunda kalıcı bir başkan kimliği yazar (itibar +2 ile duyurulur)">
      <span>KİMLİK</span><b>${G.identityTag ? '“' + esc(G.identityTag) + '”' : 'henüz oturmadı — tutarlı kararlar kimlik yazar'}</b></div>
    ${kalemRows}
    <div class="kamu-alt">
      <span data-tip="Bilet fiyatı + taraftar + form doluluğu yazar (Finans'tan yönetilir)">🏟 Tribün doluluğu ~<b class="tnum">%${dol}</b></span>
      <button class="cx-btn cx-btn-sm" data-act="nav" data-arg="medya" data-tip="Medya masası — demeç, röportaj, manşetler">🎙 Medya ▸</button>
    </div>
  </div>`;
}

// M2 · 5 KADEME: KULÜP SEVİYESİ — Küçük → Orta → Büyük → Dev → Efsane.
// Ne olduğu EKRANDA anlaşılır: alt başlık ne işe yaradığını, şart listesi sıradaki kapının
// nasıl açılacağını CANLI değerlerle söyler (tek kaynak: engines/legacy tierGorev).
function tierYolu(G) {
  const cur = TIER_SIRA.indexOf(G.club.tier);
  const NODE_TIP = {
    kucuk: 'Küçük kulüp — mütevazı gelir, hedef ligde kalmak',
    orta: 'Orta kulüp — şehir takımı: orta gelir, hedef üst yarı',
    buyuk: 'Büyük kulüp — devasa yayın/sponsor geliri, beklenti ŞAMPİYONLUK',
    dev: 'Dev kulüp — kıtanın sayılı camialarından; gelir katlanır, baskı da',
    efsane: 'Efsane kulüp — zirvenin zirvesi: adın kulüple birlikte tarihe geçer',
  };
  const nodes = TIER_SIRA.map((t, i) => `<div class="tier-node ${i === cur ? 'aktif' : i < cur ? 'gecti' : ''}" data-tip="${NODE_TIP[t]}"><span class="tier-dot"></span><span class="tier-ad">${TIER_TR[t]}</span></div>`).join('<span class="tier-cizgi"></span>');
  const gv = tierGorev(G);
  const sartlar = gv ? `<div class="tier-gorev">
      <div class="micro tier-gorev-h">SIRADAKİ KAPI: <b>${gv.hedefTr.toLocaleUpperCase('tr')} KULÜP</b>${gv.hazir ? ' — şartlar TAMAM, dönem sonunda tören var' : ''}</div>
      ${gv.reqs.map((r) => `<div class="tier-sart ${r.ok ? 'ok' : ''}" data-tip="${r.ters ? 'Bu değerin eşiğin ALTINDA kalması gerekir' : 'Bu değerin eşiğe ulaşması gerekir'}">
        <i>${r.ok ? '✓' : '✗'}</i><span>${r.ad}</span><b class="tnum">${r.val}${r.yuzde ? '%' : ''} ${r.ters ? '<' : '/'} ${r.esik}${r.yuzde ? '%' : ''}</b>
      </div>`).join('')}
    </div>`
    : '<div class="micro" style="margin-top:6px;color:var(--club-2)">🏛 ZİRVE: Efsane kulüp — bundan ötesi yok, adın tarihe geçti.</div>';
  const gecmis = (G.tierHistory || []).slice(-2).map((h) => `<div class="muted" style="font-size:11px">${h.dir === 'up' ? '▲' : '▼'} ${h.term}. dönem: ${TIER_TR[h.from] || h.from} → ${TIER_TR[h.to] || h.to}</div>`).join('');
  return `<div class="card"><div class="overline">Kulüp Seviyesi <span class="muted" style="float:right;font-size:10.5px">${cur + 1}/5</span></div>
    <div class="micro" style="margin:2px 0 6px;color:var(--ink-3)">Kulübün kurumsal boyu: yayın + sponsor geliri, taban ve kurulun beklenti çıtası buradan belirlenir.</div>
    <div class="tier-track">${nodes}</div>
    ${sartlar}${gecmis}
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
    ${items.length ? '' : '<div class="micro" style="margin-top:6px;color:var(--ink-3)">İlk kupa geldiğinde ışıklar yanar — şampiyonluk, kupa ve jübileler buraya işlenir.</div>'}
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
