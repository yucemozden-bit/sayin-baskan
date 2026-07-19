// tests/iliski.test.mjs — İLİŞKİ SEKANSLARI (SEKANS-PLAN Faz 1) bataryası.
// Plan §5 zorunlu testleri: (1) determinizm — core rng tüketilmez; (2) autoplay-nötr —
// dokunulmazsa 12 hafta sonra her şey bit bit aynı; (3) negatif-pasif YOK — ihmal gauge
// düşürmez, OLAY üretir. Artı: jest/söz/yenileme/kaptan/telkin bağları + çocuk isim onarımı.
// Çalıştır: node tests/iliski.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed, rand } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import * as pc from '../src/ui/playerCard.js';
import * as ozelUi from '../src/ui/ozelHayat.js';
import { KISILIKLER, kisilikOf, relDelta, esikDurum, klikOf } from '../src/engines/iliski.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };
const actSrc = readFileSync(new URL('../src/actions.js', import.meta.url), 'utf8');

function fresh(seed = 42) {
  setSeed(seed);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  return G;
}

console.log('\n── Motor (engines/iliski.js) ──');
{
  check('kişilik deterministik: aynı kimlik hep aynı karakter', kisilikOf('sq5#Ali') === kisilikOf('sq5#Ali') && Object.keys(KISILIKLER).includes(kisilikOf('sq5#Ali')));
  check('çarpanlar: sadık pozitifi büyütür, gururlu negatifi büyütür', relDelta('sadik', 6) === 8 && relDelta('gururlu', -6) === -9);
  check('eşikler: <30 kriz · >70 fırsat · arası nötr', esikDurum(20) === 'kriz' && esikDurum(80) === 'firsat' && esikDurum(50) === 'notr');
  check('klik türetilmiş: ≤23 gençler, üstü çekirdek', klikOf({ age: 21 }) === 'gencler' && klikOf({ age: 29 }) === 'cekirdek');
}

console.log('\n── Plan §5 zorunlu: determinizm + autoplay-nötr + negatif-pasif yok ──');
{
  const G = fresh();
  setSeed(555); const beklenen = rand(0, 1);
  setSeed(555); A.iliskiTick(G); const sonra = rand(0, 1);
  check('(1) iliskiTick core rng TÜKETMEZ', beklenen === sonra);

  const G2 = fresh();
  const foto = JSON.stringify({ g: G2.gauges, bg: G2.squad.map((p) => p.baskanaGuven ?? 50), td: G2.tdRelation, mo: G2.squad.map((p) => p.morale) });
  for (let i = 0; i < 12; i++) { A.iliskiTick(G2); G2.meta.week++; }
  const foto2 = JSON.stringify({ g: G2.gauges, bg: G2.squad.map((p) => p.baskanaGuven ?? 50), td: G2.tdRelation, mo: G2.squad.map((p) => p.morale) });
  check('(2) 12 hafta dokunulmadan → gauge + güven + TD + moral BİT BİT AYNI', foto === foto2);

  const G3 = fresh();
  const kurban = G3.squad[0];
  kurban.baskanaGuven = 20; // ihmal edilmiş ilişki
  const gaugeFoto = JSON.stringify(G3.gauges);
  let olay = false;
  for (let i = 0; i < 10 && !olay; i++) { A.iliskiTick(G3); G3.meta.week++; olay = G3.inbox.some((m) => (m.t || '').includes('huzursuz')); }
  check('(3a) kriz gauge DÜŞÜRMEZ (sessiz ceza yok)', JSON.stringify(G3.gauges) === gaugeFoto);
  check('(3b) kriz OLAY üretir: "huzursuz" manşeti inbox\'ta', olay);
  G3.tdRelation = 20; let tdOlay = false;
  for (let i = 0; i < 12 && !tdOlay; i++) { A.iliskiTick(G3); G3.meta.week++; tdOlay = G3.inbox.some((m) => (m.t || '').includes('istifa sinyali')); }
  check('(3c) TD krizi de olay üretir (istifa sinyali)', tdOlay);
}

console.log('\n── 2.1: Jest + Söz + bağlar ──');
{
  const G = fresh();
  const p = G.squad.find((x) => !x.loanIn);
  const bg0 = p.baskanaGuven ?? 50, mo0 = p.morale;
  check('jest: güven ▲ (kişilik çarpanlı) + moral ▲ + iyilik defteri', A.playerJest(G, p.id).ok && (p.baskanaGuven > bg0) && p.morale === Math.min(100, mo0 + 4) && p.relx.iyilik === 1);
  check('jest haftada 1: ikincisi reddedilir', A.playerJest(G, G.squad[3].id).ok === false);
  const ayniKlik = G.squad.find((x) => x !== p && klikOf(x) === klikOf(p));
  check('klik yayılımı: aynı klikten oyuncu +1 güven aldı', ayniKlik && (ayniKlik.baskanaGuven ?? 50) >= 51);

  check('söz verilir + kayda geçer', A.playerSoz(G, p.id).ok && p.relx.soz?.tip === 'satmam');
  check('aynı oyuncuya ikinci söz reddedilir', A.playerSoz(G, p.id).ok === false);
  // güven ≥70 → haftalık moral bağı (bilinçli yatırım eşiği)
  p.baskanaGuven = 75; const mo1 = p.morale;
  A.iliskiTick(G);
  check('güven ≥70 → haftalık moral +1 (sahaya dönüş)', p.morale === Math.min(100, mo1 + 1));
  // yenileme bağları
  const z = G.squad.find((x) => !x.loanIn && x !== p && (x.contractYears ?? 0) < 5);
  z.baskanaGuven = 20;
  check('güven <30 → sözleşme masasına oturmaz', A.renewContract(G, z.id).ok === false);
  z.baskanaGuven = 80; const w0 = z.wage;
  A.renewContract(G, z.id);
  check('güven ≥70 → indirimli zam (%4)', Math.abs(z.wage - (w0 + Math.round(w0 * 0.04 * 100) / 100)) < 0.011, `${w0}→${z.wage}`);
  // söz ihlali kancaları kaynakta (iki satış yolu) + sezon ödülü
  check('söz ihlali 2 satış yolunda + sezon sonu ödül kancası', (actSrc.match(/sozIhlal\(G, p\)/g) || []).length >= 2 && actSrc.includes("soz?.tip === 'satmam'"));
}

console.log('\n── 2.2: TD bağları + kaptan ──');
{
  const G = fresh();
  // telkin sonucu → ilişki (determinist olay)
  G.telkinWeeks = [G.meta.week]; G.telkinLog = [{ wk: G.meta.week, res: 'W' }];
  const td0 = G.tdRelation;
  A.iliskiTick(G);
  check('telkin tuttu (W) → TD ilişkisi +1', G.tdRelation === Math.min(100, td0 + 1));
  G.meta.week++; G.telkinWeeks = [G.meta.week]; G.telkinLog = [{ wk: G.meta.week, res: 'L' }];
  const td1 = G.tdRelation;
  A.iliskiTick(G);
  check('telkin tutmadı (L) → TD ilişkisi −1', G.tdRelation === Math.max(0, td1 - 1));
  check('telkin reddi ilişkiye bağlı (≥80 dinler, <40 dik kafalı) + rand sayısı korunur', actSrc.includes('_tdr >= 80 ? 0') && actSrc.includes('rand(0, 1) < rejP'));
  // kaptan onayı → aday güveni ▲
  const aday = G.squad[2];
  G.inbox.unshift({ id: 'mKap', action: 'captain' });
  G.captainCands = { c1: aday.id, c2: G.squad[3].id };
  const a0 = aday.baskanaGuven ?? 50;
  A.resolveCaptain(G, 'mKap', 'onay');
  check('kaptan onayı → adayın başkana güveni ▲', (aday.baskanaGuven ?? 50) > a0);
}

console.log('\n── 2.8: çocuk isim onarımı + UI ──');
{
  const G = fresh();
  delete G.ozel.aile.c1; delete G.ozel.aile.c2; // bozuk/eski kayıt simülasyonu
  A.ozelTick(G, 'D');
  check('eksik çocuk isimleri hash\'le onarılır', !!G.ozel.aile.c1 && !!G.ozel.aile.c2, `${G.ozel.aile.c1} · ${G.ozel.aile.c2}`);
  const h = ozelUi.render(G);
  check('Özel Hayat render "undefined" içermez', !h.includes('undefined'));
  // playerCard: ilişki satırı + butonlar
  const p = G.squad.find((x) => !x.loanIn);
  G._pcard = p.id;
  const kart = pc.render(G);
  check('kartta ilişki satırı (kişilik + klik)', kart.includes('pc-rel-note') && kart.includes('ilişki:'));
  check('kartta Jest + Söz butonları kablolu', kart.includes('data-act="pJest"') && kart.includes('data-act="pSoz"'));
  check('dispatch: pJest/pSoz main\'de', readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').includes("case 'pJest'"));
}

console.log('\n────────────────────────────────────────────────');
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
