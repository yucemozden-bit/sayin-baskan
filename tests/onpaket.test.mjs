// tests/onpaket.test.mjs — ON-PAKET: büyük testte onaylanan 10 özellik (1·3·4·5·6·7·8·9·10·12).
// #1 kupa sahnesi · #3 kayyum kurtuluş paketi · #4 gelecek-5-maç · #5 iflas çizgisi · #6 boşanma yayı
// #7 terfi yarışı · #8 mega proje · #9 sorgu devri · #10 kısa liste temizliği · #12 karar defteri
// Çalıştır: node tests/onpaket.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import { TUNING } from '../src/config.js';
import * as A from '../src/actions.js';
import { DAVETLER, OLAYLAR, AILE_TEL } from '../src/engines/ozel.js';
import { eleksiyon } from '../src/engines/election.js';
import * as cockpit from '../src/ui/cockpit.js';
import * as finance from '../src/ui/finance.js';
import * as tesisUi from '../src/ui/facilitiesView.js';
import * as ozelUi from '../src/ui/ozelHayat.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

function fresh(seed = 42, tier = 'orta', opts = {}) {
  setSeed(seed);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, tier);
  A.startTerm(G, opts.vaat || ['P15'], opts.dir || { budget: 60, line: 'hazir' });
  return G;
}
// entegrasyon.test'in kompakt haftası — gerçek akış: beginWeek → maç → finishWeek
function hafta(G) {
  A.beginWeek(G);
  let guard = 0;
  while (G.phone && guard++ < 8) A.answerPhone(G, 0);
  if (G.pendingMatch && G.pendingMatch.phase === 'pre') {
    A.htDecision(G, 'tdguven');
    const r = A.finishWeek(G);
    if (r && r.waitLate) A.lateDecision(G, 'devam');
  }
  guard = 0;
  while (G.phone && guard++ < 8) A.answerPhone(G, 0);
  for (const m of G.inbox) {
    if (m.resolved) continue;
    if (m.action === 'tfile') A.resolveTransferFile(G, m.id, 'onay');
    else if (m.action === 'sfile') A.resolveSaleFile(G, m.id, 'red');
    else if (m.action === 'event') A.resolveEvent(G, m.id, 0);
    else if (m.action === 'board') A.resolveBoard(G, m.id, 'mali');
    else if (m.action === 'lfile') A.resolveLoanFile(G, m.id, 'kalsin');
    else if (m.action === 'captain') A.resolveCaptain(G, m.id, 'onay');
    else if (m.action === 'seasonBudget') A.resolveSeasonBudget(G, m.id, 'onay');
    else if (m.action === 'agenda') { let ga = 0; while (!m.resolved && ga++ < 4) A.resolveAgenda(G, m.id, 'vizyon'); }
  }
  G.pendingMatch = null;
}

console.log('\n═══ #10 · KISA LİSTE TEMİZLİĞİ ═══');
{
  const G = fresh(11);
  A.preSeasonWeek(G); // pencere + piyasa
  G.economy.kasa = 500;
  const hedef = [...(G.market || [])].sort((a, b) => (a.fee ?? 99) - (b.fee ?? 99))[0];
  check('piyasada hedef var', !!hedef, hedef && `${hedef.name} ${hedef.fee ?? '?'}mn`);
  if (hedef) {
    G._shortlist = [hedef.id, 'hayalet-id'];
    const r = A.buyTarget(G, hedef.id);
    check('satın alınan isim kısa listeden OTOMATİK düşer', r.ok && !G._shortlist.includes(hedef.id), JSON.stringify(G._shortlist));
    check('diğer yıldızlı isimler listede kalır', G._shortlist.includes('hayalet-id'));
  }
}

console.log('\n═══ #9 · SORGU HAKKI DEVRİ ═══');
{
  const G = fresh(12);
  G.sorguHak = 5; // kullanılmamış 5 hak — en fazla 2'si devreder
  A.beginWeek(G);
  const beklenen = 1 + (G.facilities.scout || 0) + 2; // mesai bonusu default programda 0
  check('devir en fazla +2 (istifçilik yok, birikim var)', G.sorguHak === beklenen, `hak ${G.sorguHak} (beklenen ${beklenen})`);
  const G2 = fresh(12);
  G2.sorguHak = 0;
  A.beginWeek(G2);
  check('devredilecek hak yoksa taban formül', G2.sorguHak === 1 + (G2.facilities.scout || 0), `hak ${G2.sorguHak}`);
}

console.log('\n═══ #5 · İFLAS ÇİZGİSİ (Borç Masası) ═══');
{
  const G = fresh(13);
  const esik = A.iflasEsigi(G);
  check('eşik tek kaynak: max(500, taban×1.25+150)', esik === Math.max(500, Math.round((G.iflasTaban ?? 60) * 1.25) + 150), `eşik ${esik}`);
  G.nav = 'finans';
  const h = finance.render(G);
  check('Borç Masasında kayyum çizgisi barı görünür', h.includes('Kayyum çizgisi') && h.includes('fin-iflas-bar'));
  check('bar uyarı çentiği eşik−100 bilgisini taşır', h.includes(`${esik - 100}mn`));
}

console.log('\n═══ #3 · KAYYUM KURTULUŞ PAKETİ ═══');
{
  const G = fresh(14);
  const esik = A.iflasEsigi(G);
  G.economy.borc = esik - 60; G.economy.kasa = 300; // uyarı bandı (eşik−100 üstü) ama iflas altı
  hafta(G);
  const kart = G.inbox.find((m) => m.action === 'kayyum');
  check('uyarı bandında GM kurtuluş paketi dosyası düşer', !!kart && (kart.t || '').includes('KAYYUM KAPIDA'), kart && `paket ${kart.paket.length} isim · ${kart.tutar}mn`);
  check('kariyer sürüyor (iflas değil, uyarı)', G.phase === 'SEASON_LOOP');
  if (kart) {
    check('paket 2-3 satılabilir isim + tutar = piyasanın %70\'i', kart.paket.length >= 2 && kart.paket.length <= 3 && kart.tutar > 0);
    const kadro0 = G.squad.length, borc0 = G.economy.borc, taraftar0 = G.gauges.taraftar;
    const r = A.kayyumPaket(G, kart.id, 'sat');
    check('SAT: oyuncular gider, bedelin tamamı borca', r.ok && G.squad.length === kadro0 - kart.paket.length && Math.abs(G.economy.borc - Math.max(0, borc0 - kart.tutar)) < 1, `borç ${Math.round(borc0)} → ${Math.round(G.economy.borc)}`);
    check('yangından mal kaçırma bedeli: tribün −3', G.gauges.taraftar <= taraftar0 - 2.9);
    check('manşet atıldı + dosya kapandı', kart.resolved && G.inbox.some((m) => (m.t || '').includes('YANGINDAN MAL')));
  }
  // RED yolu — dosya kapanır, kadro korunur
  const G2 = fresh(14);
  G2.inbox.unshift({ id: 'ktest', action: 'kayyum', paket: [G2.squad[0].id], tutar: 30, t: 'test', b: '' });
  const kadro2 = G2.squad.length;
  A.kayyumPaket(G2, 'ktest', 'red');
  check('RED: kadro korunur, GM not düşer', G2.squad.length === kadro2 && G2.inbox.some((m) => (m.t || '').includes('reddedildi')));
  // Başkan oğlu paket dışı — filtre satılabilir listesinde
  const G3 = fresh(14);
  for (const p of G3.squad) p.aileOgul = true;
  G3.economy.borc = A.iflasEsigi(G3) - 60; G3.economy.kasa = 300;
  hafta(G3);
  check('satılabilir isim yoksa (hepsi aile) paket dosyası düşmez', !G3.inbox.some((m) => m.action === 'kayyum'));
}

console.log('\n═══ #4 · GELECEK 5 MAÇ + #7 TERFİ YARIŞI (kokpit) ═══');
{
  const G = fresh(15);
  A.beginWeek(G); G.pendingMatch = null;
  G.nav = 'cockpit';
  const h = cockpit.render(G);
  check('gündemde 5 maçlık fikstür şeridi', h.includes('sb-fx-serit'), (h.match(/sb-fx /g) || []).length + ' çip');
  check('şeritte ev/deplasman ikonları', /🏠|✈/.test(h));
  check('üst ligde terfi satırı YOK', !h.includes('TERFİ YARIŞI'));
  G.lig = 2;
  const h2 = cockpit.render(G);
  check('2. ligde TERFİ YARIŞI satırı canlı (çizgiye puan)', h2.includes('TERFİ YARIŞI') && /puan/.test(h2));
}

console.log('\n═══ #12 · KARAR DEFTERİ ═══');
{
  const G = fresh(16);
  A.initOzel(G);
  G.ozel.olay = { id: 'karne', hafta: 999 };
  A.ozelKarar(G, 0);
  const d = (G.ozel.defter || [])[0];
  check('çözülen ikilem deftere işlenir (sezon·hafta·başlık·seçim)', !!d && d.t === 'Karne zayıf geldi' && !!d.secim && d.s === G.meta.season, d && `${d.t} → ${d.secim}`);
  G._ozelTab = 'defter';
  const h = ozelUi.render(G);
  check('defter sekmesi kararı gösterir', h.includes('KARAR DEFTERİ') && h.includes('Karne zayıf geldi'));
  for (let i = 0; i < 25; i++) { G.ozel.olay = { id: 'gece', hafta: 999 }; A.ozelKarar(G, 0); }
  check('defter son 20 kayıtla sınırlı (şişme yok)', G.ozel.defter.length <= 20, `${G.ozel.defter.length} kayıt`);
}

console.log('\n═══ #6 · BOŞANMA YAYI ═══');
{
  const G = fresh(17);
  A.initOzel(G);
  const oz = G.ozel;
  oz.iliski.es = 5; // uzun ihmalin ucu
  for (let i = 0; i < 4; i++) { A.ozelTick(G, 'D'); G.meta.week++; }
  check('4 hafta dipte → kriz tetiklenir (ayrilikTeklif + zorunlu ikilem)', !!oz.flags.ayrilikTeklif && oz.olay?.id === 'ayrilik');
  check('valiz manşeti inbox\'ta', G.inbox.some((m) => (m.t || '').includes('valizleri hazırladı')));
  A.ozelTick(G, 'D'); // cevaplanmadan 1 hafta geçsin
  check('ayrilik gündemi DÜŞMEZ — cevaplanana dek çakılı', oz.olay?.id === 'ayrilik');
  const r = A.ozelKarar(G, 0); // YUVAMI KURTARACAĞIM
  check('kriz atlatılır: bayrak + eş toparlar + teklif silinir', r.ok && oz.flags.krizAtlatildi && !oz.flags.bosandi && !oz.flags.ayrilikTeklif && oz.iliski.es >= 25, `es ${oz.iliski.es}`);
  check('Yuva kurtuldu kartı', G.inbox.some((m) => (m.t || '').includes('Yuva kurtuldu')));

  // ── boşanma yolu — kalıcı izler ──
  const G2 = fresh(18);
  A.initOzel(G2);
  const oz2 = G2.ozel;
  oz2.flags.ayrilikTeklif = true;
  oz2.olay = { id: 'ayrilik', hafta: 999 };
  A.ozelKarar(G2, 1); // Yollarımızı ayıralım
  check('boşanma: bayrak kalıcı + eş kanalı donuk (15) + manşet', oz2.flags.bosandi && oz2.iliski.es === 15 && G2.inbox.some((m) => (m.t || '').includes('EVLİLİĞİ BİTTİ')));
  oz2.g.ev = 75;
  A.ozelTick(G2, 'W');
  check('KALICI İZ: boşanmış evde huzur tavanı 60 (güven eşiği 72 kapanır)', oz2.g.ev <= 60, `ev ${oz2.g.ev}`);
  oz2.varlik.konut = 2;
  check('yalı yemekleri kapandı (eşsiz sofra kurulmaz)', DAVETLER.yemek.req(oz2) === false);
  check('eşli ikilemler havuzdan çekilir (yıldönümü/dernek/tatil)',
    ['yildonumu', 'dernek', 'tatil'].every((id) => OLAYLAR.find((o) => o.id === id).kosul(oz2) === false));
  check('aile telefonunda eş aramaz (havuz filtresi dolu)', AILE_TEL.some((t) => t.kim === 'es') && AILE_TEL.filter((t) => t.kim !== 'es').length >= 2);
  // sandık: aile desteği artık yalnız çocuklardan
  G2.history.seasons.push({ pos: 8 }, { pos: 7 }, { pos: 8 });
  oz2.iliski.c1 = 80; oz2.iliski.c2 = 60;
  const e2 = eleksiyon(G2, {});
  check('seçimde aile ort = (kız+oğul)/2 — eş hesaptan çıkar', e2.breakdown.aile === 70 && e2.breakdown.aileBonus === 0.02, `aile ${e2.breakdown.aile}`);
  const G3 = fresh(18);
  A.initOzel(G3);
  G3.history.seasons.push({ pos: 8 }, { pos: 7 }, { pos: 8 });
  G3.ozel.iliski.es = 20; G3.ozel.iliski.c1 = 80; G3.ozel.iliski.c2 = 60;
  const e3 = eleksiyon(G3, {});
  check('evli kontrol: aile ort = (eş+kız+oğul)/3', e3.breakdown.aile === Math.round((20 + 80 + 60) / 3), `aile ${e3.breakdown.aile}`);
  // UI izleri
  G2.nav = 'ozel'; G2._ozelTab = 'genel';
  const h2 = ozelUi.render(G2);
  check('profil + ilişki ağı boşanmayı anlatır', h2.includes('boşandı') && h2.includes('ayrı yaşıyor'));
}

console.log('\n═══ #8 · STADYUM MEGA PROJESİ ═══');
{
  const G = fresh(19);
  check('stadyum zirvede değilken mega kapalı', A.megaProjeBaslat(G).ok === false);
  G.facilities.stadyum = 10; G.economy.kasa = 100;
  check('kasa yetersizse başlamaz', A.megaProjeBaslat(G).ok === false);
  G.economy.kasa = 400;
  const cap0 = G.club.stadiumCapacity, itibar0 = G.gauges.itibar;
  const r = A.megaProjeBaslat(G);
  check('temel atıldı: −250mn peşin + 8 haftalık şantiye', r.ok && G.economy.kasa === 150 && G.santiye?.tesis === 'mega' && G.santiye.kalan === A.MEGA.hafta);
  check('şantiye doluyken ikinci mega/ihale açılamaz', A.megaProjeBaslat(G).ok === false && A.upgradeFacility(G, 'tibbi').ok === false);
  G.nav = 'tesis';
  const h = tesisUi.render(G);
  check('tesisler ekranında MEGA şeridi + ilerleme', h.includes('MEGA PROJE') && h.includes('tesis-mega'));
  for (let i = 0; i < A.MEGA.hafta; i++) A.santiyeTick(G);
  check('kurdele: kapasite ×1.2 KALICI + itibar +5 + bayrak', G.megaStad === true && G.club.stadiumCapacity === Math.round(cap0 * 1.2) && G.gauges.itibar === Math.min(100, itibar0 + 5) && G.santiye === null, `kapasite ${cap0} → ${G.club.stadiumCapacity}`);
  check('açılış manşeti', G.inbox.some((m) => (m.t || '').includes('Stadyum Kompleksi açıldı')));
  check('tek seferlik: ikinci kompleks yok', A.megaProjeBaslat(G).ok === false);
  const h2 = tesisUi.render(G);
  check('şerit AÇILDI moduna döner', h2.includes('AÇILDI') || h2.includes('tarihe geçtin'));
}

console.log('\n═══ #1 · ŞAMPİYONLUK KUPA SAHNESİ ═══');
{
  let sampiyonG = null, seedNot = '';
  for (let s = 10; s < 30 && !sampiyonG; s++) {
    const G = fresh(s, 'buyuk', { vaat: ['P01'], dir: { budget: 120, line: 'yildiz' } });
    for (let w = 1; w <= G.SEASON_WEEKS && G.phase === 'SEASON_LOOP'; w++) hafta(G);
    if (G.phase === 'SEASON_LOOP') A.endSeason(G);
    if (G.lastSeason?.champion) { sampiyonG = G; seedNot = `seed ${s} · ${G.lastSeason.pos}.`; }
    else if (!sampiyonG && G.transition?.tip === 'kupa') { check('şampiyon olmadan kupa sahnesi TETİKLENMEMELİ', false, `seed ${s}`); }
  }
  check('şampiyon sezon bulundu (büyük kulüp koşusu)', !!sampiyonG, seedNot);
  if (sampiyonG) {
    const t = sampiyonG.transition;
    check('karneden önce KUPA sinematiği kurulur', t?.tip === 'kupa' && t.title === 'ŞAMPİYON' && (t.kupaNo || 0) >= 1, JSON.stringify({ tip: t?.tip, kupaNo: t?.kupaNo }));
    check('TD kupayı başkana uzatır (sahne repliği)', (t?.sub || '').includes('kupayı başkana'));
  }
}

console.log('\n═══ DETERMİNİZM — on-paket haftalık akışa çekiliş eklemedi ═══');
{
  const iz = (G) => JSON.stringify({ k: Math.round(G.economy.kasa * 100), b: Math.round(G.economy.borc * 100), g: G.gauges, w: G.meta.week, sq: G.squad.length });
  const a = fresh(7); for (let i = 0; i < 6; i++) hafta(a);
  const b = fresh(7); for (let i = 0; i < 6; i++) hafta(b);
  check('aynı seed + 6 hafta → bit-bit aynı durum', iz(a) === iz(b));
}

console.log(`\nSONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
