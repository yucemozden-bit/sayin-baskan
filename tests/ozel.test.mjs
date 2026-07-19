// tests/ozel.test.mjs — ÖZEL HAYAT modu bataryası.
// Kritik garantiler: (1) DETERMİNİZM — core rng'ye tek çekiliş eklenmez, init/tick hash-tabanlı;
// (2) AUTOPLAY-NÖTR — varsayılan programla kulüp gauge'ları KIMILDAMAZ (kalibrasyon bantları güvende);
// (3) bağlar çalışır — bağış→kasa, davet→gauge, ikilem→fx, mesai→sorgu hakkı, rozet→unlock.
// Çalıştır: node tests/ozel.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed, rand } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import * as ozelUi from '../src/ui/ozelHayat.js';
import { seviyeOf, OLAYLAR, VARLIK, DAVETLER } from '../src/engines/ozel.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };
const mainSrc = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const actSrc = readFileSync(new URL('../src/actions.js', import.meta.url), 'utf8');
const cockpitSrc = readFileSync(new URL('../src/ui/cockpit.js', import.meta.url), 'utf8');

function fresh(seed = 42) {
  setSeed(seed);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  return G;
}

console.log('\n── Kuruluş + determinizm ──');
{
  const G = fresh();
  check('startTerm sonrası G.ozel kurulu (aile + göstergeler + program)', !!G.ozel && !!G.ozel.aile.es && !!G.ozel.g && Object.values(G.ozel.prog).reduce((a, b) => a + b, 0) === 4, `eş: ${G.ozel.aile.es}`);
  const G2 = fresh();
  check('aynı seed → birebir aynı özel hayat (determinizm)', JSON.stringify(G.ozel) === JSON.stringify(G2.ozel));
  // KUTSAL KURAL: ozelTick core rng'den TEK çekiliş bile almaz
  setSeed(777); const beklenen = rand(0, 1);
  setSeed(777); A.ozelTick(G, 'W'); const sonra = rand(0, 1);
  check('ozelTick core rng TÜKETMEZ (seed dizisi kaymaz)', beklenen === sonra);
}

console.log('\n── Autoplay-nötr: varsayılan program kulüp gauge kımıldatmaz ──');
{
  const G = fresh();
  const g0 = JSON.stringify(G.gauges);
  const loy0 = (G.board || []).map((m) => m.loyalty).join(',');
  for (let i = 0; i < 12; i++) { A.ozelTick(G, i % 3 === 0 ? 'L' : 'D'); G.meta.week++; }
  check('12 hafta varsayılan program → kulüp gauge AYNEN', JSON.stringify(G.gauges) === g0);
  check('kurul sadakati AYNEN (sosyal eşiği aşılmadı)', (G.board || []).map((m) => m.loyalty).join(',') === loy0);
  const g = G.ozel.g;
  check('iç göstergeler 0-100 bandında', [g.ev, g.enerji, g.stres, g.sosyal].every((v) => v >= 0 && v <= 100), `ev ${g.ev} enerji ${g.enerji} stres ${g.stres} sosyal ${g.sosyal}`);
  check('kişisel nakit haftalık gelirle arttı', G.ozel.nakit > 12, `₺${G.ozel.nakit}mn`);
  check('XP birikti', G.ozel.xp >= 12, `xp ${G.ozel.xp}`);
}

console.log('\n── Program havuzu (4 akşam) ──');
{
  const G = fresh();
  A.ozelProg(G, 'aile|-'); A.ozelProg(G, 'mesai|+');
  check('akşam taşınır: aile 0, mesai 2, toplam 4', G.ozel.prog.aile === 0 && G.ozel.prog.mesai === 2 && Object.values(G.ozel.prog).reduce((a, b) => a + b, 0) === 4);
  A.ozelProg(G, 'aile|-');
  check('0 altına inmez', G.ozel.prog.aile === 0);
  A.ozelProg(G, 'sosyal|+');
  check('boş akşam yokken + çalışmaz (toplam 4 kilit)', Object.values(G.ozel.prog).reduce((a, b) => a + b, 0) === 4);
  check('mesai ≥2 → sorgu hakkı +1 kancası kaynakta', actSrc.includes("prog?.mesai") && actSrc.includes('sorguHak'));
}

console.log('\n── İkilemler ──');
{
  const G = fresh();
  const abs = G.meta.season * 100 + G.meta.week;
  G.ozel.olay = { id: 'nisan', hafta: abs };
  const ev0 = G.ozel.g.ev, xp0 = G.ozel.xp;
  A.ozelKarar(G, 0); // nişana git
  check('nişan kararı: ev ▲ + bayrak + xp + gündem temiz', G.ozel.g.ev > ev0 && G.ozel.flags.elifNisan === true && G.ozel.xp >= xp0 + 2 && G.ozel.olay === null);
  // arsa: vadeli yatırım — sonuç determinist, vadesinde nakde döner
  G.ozel.olay = { id: 'arsa', hafta: abs };
  const nakit0 = G.ozel.nakit;
  A.ozelKarar(G, 0);
  check('arsa: −5mn şimdi, vadeli yatırım kuruldu', G.ozel.nakit === Math.round((nakit0 - 5) * 10) / 10 && !!G.ozel.yatirim && [3, 9].includes(G.ozel.yatirim.tutar));
  const tutar = G.ozel.yatirim.tutar, n1 = G.ozel.nakit;
  for (let i = 0; i < 5; i++) { G.meta.week++; A.ozelTick(G, 'D'); }
  check('vade doldu → yatırım nakde döndü', G.ozel.yatirim === null && G.ozel.nakit >= n1 + tutar, `+₺${tutar}mn`);
  check('düğün olayı yalnız nişan bayrağıyla havuza girer', OLAYLAR.find((o) => o.id === 'dugun').kosul({ flags: { elifNisan: true } }) === true && OLAYLAR.find((o) => o.id === 'dugun').kosul({ flags: {} }) === false);
}

console.log('\n── Varlık + davet + bağış (kulüp bağları) ──');
{
  const G = fresh();
  G.ozel.nakit = 50;
  check('oto al: seviye 1 + nakit düşer', A.ozelVarlik(G, 'oto').ok && G.ozel.varlik.oto === 1 && G.ozel.nakit === 44);
  G.ozel.nakit = 2;
  check('yetersiz nakit → ret', A.ozelVarlik(G, 'tekne').ok === false);
  check('tekne yokken tekne turu → ret (şart)', A.ozelDavet(G, 'tekne').ok === false);
  G.ozel.nakit = 30; A.ozelVarlik(G, 'tekne');
  const mali0 = G.gauges.mali;
  check('tekne turu: mali algı +1 + nakit/enerji düşer', A.ozelDavet(G, 'tekne').ok && G.gauges.mali === Math.min(100, mali0 + 1));
  check('cooldown: aynı davet hemen tekrar VERİLEMEZ', A.ozelDavet(G, 'tekne').ok === false);
  const itibar0 = G.gauges.itibar, kasa0 = G.economy.kasa;
  A.ozelDavet(G, 'hayir');
  check('hayır gecesi: itibar +2', G.gauges.itibar === Math.min(100, itibar0 + 2));
  G.ozel.nakit = 20;
  const t0 = G.gauges.taraftar;
  check('bağış: kasa +5, taraftar minik ▲', A.ozelBagis(G, 5).ok && G.economy.kasa === kasa0 + 5 && G.gauges.taraftar > t0);
  A.ozelBagis(G, 2); A.ozelBagis(G, 2);
  check('sezonda 3 bağış tavanı', A.ozelBagis(G, 2).ok === false);
}

console.log('\n── Rozet + seviye ──');
{
  const G = fresh();
  G.ozel.bagisToplam = 10;
  A.ozelTick(G, 'D');
  check('10mn bağış → Cömert Patron rozeti', G.ozel.rozet.comert === true);
  G.ozel.iliski.muhabir = 75;
  A.ozelTick(G, 'D');
  check('muhabir ≥70 → Medya Dostu rozeti', G.ozel.rozet.medya === true);
  check('seviye eşikleri (kariyer eğrisi): 0→sv1, 30→sv2, 640→sv8', seviyeOf(0) === 1 && seviyeOf(30) === 2 && seviyeOf(640) === 8);
}

console.log('\n── UI + kablolama ──');
{
  const G = fresh();
  const h1 = ozelUi.render(G);
  check('Genel Durum: tüm ana bloklar', ['YAŞAM GÖSTERGELERİ', 'HAFTALIK PROGRAM', 'İLİŞKİ AĞI', 'ÖZEL GÜNDEM', 'BAŞKANLIK TECRÜBESİ'].every((k) => h1.includes(k)));
  G._ozelTab = 'servet';
  const h2 = ozelUi.render(G);
  check('Servet & Yaşam: mağaza + davet + kulübe destek', ['VARLIK MAĞAZASI', 'DAVET ORGANİZE ET', 'KULÜBE DESTEK', 'HARCANABİLİR NAKİT'].every((k) => h2.includes(k)));
  check('render temiz (undefined/NaN sızıntısı yok)', !/undefined|NaN/.test(h1 + h2));
  check('dispatch kabloları: 6 özel aksiyon', ['ozelTab', 'ozelProg', 'ozelKarar', 'ozelVarlik', 'ozelDavet', 'ozelBagis'].every((a) => mainSrc.includes(`case '${a}'`)));
  check('nav: Özel Hayat sekmesi + SB_NAV kaydı', cockpitSrc.includes("'ozel', 'Özel Hayat'") && mainSrc.includes("'ozel', 'inbox'"));
  check('haftalık tick finishWeekTail zincirinde (derbi bağlamıyla)', actSrc.includes('ozelTick(G, myRes, { derbi: isDerby })'));
  check('havuz zengin: ≥13 ikilem, 5 varlık, 5 davet (moral gecesi dahil)', OLAYLAR.length >= 13 && Object.keys(VARLIK).length === 5 && Object.keys(DAVETLER).length === 5, `${OLAYLAR.length} ikilem`);
  // YERLEŞİM KURALI: paneller viewport'a sabit — kolon flex + panel overflow:hidden (sayfa kaymaz)
  const css = readFileSync(new URL('../css/game.css', import.meta.url), 'utf8');
  check('paneller sabit: oz-grid esner + panel içi kırpılır (kayma yok)',
    css.includes('.oz-grid { flex: 1; min-height: 0;') && /\.oz-kol > \.sb-panel \{[^}]*overflow: hidden/.test(css) && css.includes('.oz-kol > .sb-panel:last-child { flex: 1 1 0; }'));
  check('ilişki satırı tek satır (isim + bar yan yana — 5 kişi sığar)', /\.oz-il \{ display: flex/.test(css));
  check('servet şeridi SATIR kalır (.sb-panel column mirası ezilir — sütunlaşıp ekran yutmaz)',
    /\.oz-servet-serit \{ display: flex; flex-direction: row/.test(css));
  // SAHİP OLDUKLARIM sabit 5 slot: boşken de aynı satır sayısı → alttaki panel kaymaz
  // SHOWROOM sonrası: sahiplik artık SABİT 5 kategorili mağaza listesinde (oz-vk satırları) —
  // boş/dolu fark etmez 5 satır hep durur, kademe çipleri sahipliği gösterir → panel kaymaz.
  check('mağaza listesi SABİT 5 kategori satırı (akordeon, kademeler adlarıyla)', (h2.match(/oz-vk2-bas/g) || []).length === 5 && h2.includes('oz-vt-liste'));
}

console.log('\n────────────────────────────────────────────────');
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
