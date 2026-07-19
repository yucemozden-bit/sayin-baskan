// tests/faz2.test.mjs — FAZ 2+ PAKETİ: Medya ilişkileri (2.5) · Rakip Başkanlar (2.3) ·
// Menajer bağı (2.4) · Karanlık sponsor bedeli (2.7) · Unvan pasifleri (2.9).
// Hepsi ortak motor + hash — autoplay-nötr (baz değerlerde hiçbir kanal açılmaz).
// Çalıştır: node tests/faz2.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import * as mediaUi from '../src/ui/media.js';
import * as ozelUi from '../src/ui/ozelHayat.js';
import { h32, OLAYLAR, UNVAN_PASIF } from '../src/engines/ozel.js';
import { bkIsim } from '../src/engines/iliski.js';
import { MUHABIRLER } from '../src/data/pressPool.js';

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

console.log('\n── 2.5 MEDYA: kalem ilişkisi ──');
{
  const G = fresh();
  G.meta.week = 3; // rotasyon: 3%3=0 → Nazlı Ekinci (sert kalem)
  A.makeDemec(G, 'iddiali');
  check('sert kalem cesur cevabı sever: iddiali → ilişki +2', G.pressRel['Nazlı Ekinci'] === 52, `${G.pressRel['Nazlı Ekinci']}`);
  const G2 = fresh(); G2.meta.week = 3;
  A.makeDemec(G2, 'savunmaci');
  check('sert kalem kaçak dövüşü sevmez: savunmacı → ilişki −2', G2.pressRel['Nazlı Ekinci'] === 48);
  // eşik: dost kalem manşeti yumuşatır (+0.2 mediaTone) — iki klonla izole ölçüm
  const A1 = fresh(), A2 = fresh();
  A1.meta.week = 3; A2.meta.week = 3;
  A2.pressRel = { 'Nazlı Ekinci': 69 }; // iddiali +2 → 71 ≥70 → eşik açılır
  A.makeDemec(A1, 'iddiali'); A.makeDemec(A2, 'iddiali');
  const fark = (A2.mediaTone || 0) - (A1.mediaTone || 0);
  check('dost kalem (≥70): manşet tonu +0.2 yumuşar + kupürde not', Math.abs(fark - 0.2) < 1e-9 && A2.inbox.some((m) => (m.b || '').includes('kalemi sana sıcak')), `Δton ${fark.toFixed(2)}`);
  // özel röportaj
  const R = fresh(); R.meta.week = 3; R.ozel.g.enerji = 60;
  const e0 = R.ozel.g.enerji;
  check('özel röportaj: ilişki +10 + enerji −2', A.ozelRoportaj(R).ok && R.pressRel['Nazlı Ekinci'] === 60 && R.ozel.g.enerji === e0 - 2);
  check('aynı sezon aynı kaleme ikinci röportaj RET', A.ozelRoportaj(R).ok === false);
  check('douse dost-kalem bonusu kaynakta', actSrc.includes('dostKalem ? 0.3 : 0'));
}

console.log('\n── 2.3 RAKİP BAŞKANLAR ──');
{
  const G = fresh();
  const o0 = G.opponents[0];
  check('başkan kimliği deterministik (hash)', bkIsim(o0, data.names) === bkIsim(o0, data.names) && bkIsim(o0, data.names).includes(' '));
  // atışma ikilemi → husumet/centilmenlik kanalı
  const abs = G.meta.season * 100 + G.meta.week;
  G.ozel.olay = { id: 'atisma', hafta: abs };
  A.ozelKarar(G, 0); // cevabı yapıştır
  check('atışma: rakip başkan küser (rel −8)', G.bkRel[o0.id] === 42);
  G.ozel.olay = { id: 'atisma', hafta: abs };
  A.ozelKarar(G, 1); // centilmen
  check('centilmenlik: ilişki onarılır (+5)', G.bkRel[o0.id] === 47);
  check('ikilem havuzunda atışma kartı var', OLAYLAR.some((o) => o.id === 'atisma'));
  // UI %BK% doldurma
  G.ozel.olay = { id: 'atisma', hafta: G.meta.season * 100 + G.meta.week };
  const ui = ozelUi.render(G);
  check('gündem kartında rakip başkanın ADI (undefined yok)', ui.includes(bkIsim(o0, data.names).toLocaleUpperCase('tr').split(' ')[0]) && !ui.includes('undefined'));
  // hasılat gecesi: rel ≥70 + hash haftası → +1.5mn (fırsat kanalı)
  const H = fresh();
  const h0 = H.opponents[0];
  H.bkRel = { [h0.id]: 80 };
  let hafta = 0;
  for (let w = 1; w <= 40; w++) if (h32(`${H.club.name}#rel#1#${w}#hasilat`) % 100 < 12) { hafta = w; break; }
  check('hasılat hash haftası bulunur (deterministik)', hafta > 0, `hafta ${hafta}`);
  H.meta.week = hafta;
  const kasa0 = H.economy.kasa;
  A.iliskiTick(H);
  check('centilmen başkanlar: ortak hasılat gecesi +1,5mn (sezonda 1)', H.economy.kasa === kasa0 + 1.5 && H.hasilatSezon === 1);
  const kasa1 = H.economy.kasa;
  A.iliskiTick(H);
  check('aynı sezon ikinci hasılat OLMAZ', H.economy.kasa === kasa1);
  check('kelepir fiyatı başkan ilişkisine bağlı (kaynak: bkMult)', actSrc.includes('bkr >= 70') && actSrc.includes('bkr < 30 ? 1.15'));
}

console.log('\n── 2.4 + 2.7: menajer bağı + karanlık sponsor bedeli ──');
{
  check('pazarlıkta sosyal bonusu (≥65 → +0.06 şans, rand sayısı sabit)', actSrc.includes("sosyal ?? 50) >= 65 ? 0.06 : 0"));
  // kripto batması: batmaChance imzada görünür risk — %100'le kesin, %0'la asla (hash dalları)
  const G = fresh();
  G.meta.week = 8;
  G.sponsorDeals = { gogus: { name: 'BitCoin FC', riskProfile: { batmaChance: 1 } }, kol: { name: 'Sağlam Sigorta', riskProfile: null } };
  A.iliskiTick(G);
  check('batmaChance %100 → 8. haftada sponsor batar + manşet + slot boşalır', G.sponsorDeals.gogus === null && G.inbox.some((m) => (m.t || '').includes('SPONSOR BATTI')));
  check('risksiz sponsor yerinde durur', !!G.sponsorDeals.kol);
  const G2 = fresh();
  G2.meta.week = 8;
  G2.sponsorDeals = { gogus: { name: 'Temiz Bank', riskProfile: { batmaChance: 0 } } };
  A.iliskiTick(G2);
  check('batmaChance 0 → asla batmaz', !!G2.sponsorDeals.gogus);
}

console.log('\n── 2.9 UNVAN PASİFLERİ (yetenek ağacı) ──');
{
  check('8 seviyenin 7\'sinde pasif tanımlı (sv.2-8)', Object.keys(UNVAN_PASIF).length === 7);
  const G = fresh();
  G.ozel.seviye = 5; G.ozel.g.enerji = 80;
  const [p1, p2, p3] = G.squad.filter((x) => !x.loanIn).slice(0, 3);
  check('Halkın Adamı (sv.5): haftada 2 jest', A.playerJest(G, p1.id).ok && A.playerJest(G, p2.id).ok && A.playerJest(G, p3.id).ok === false);
  const B = fresh();
  B.ozel.seviye = 3; B.ozel.nakit = 30;
  A.ozelBagis(B, 2); A.ozelBagis(B, 2); A.ozelBagis(B, 2);
  check('İş İnsanı (sv.3): 4. bağış hakkı açık, 5. kapalı', A.ozelBagis(B, 2).ok === true && A.ozelBagis(B, 2).ok === false);
  const D1 = fresh(), D2 = fresh();
  D2.ozel.seviye = 4;
  A.ozelDavet(D1, 'altyapi'); A.ozelDavet(D2, 'altyapi');
  check('Cemiyet İnsanı (sv.4): davet 1 az enerji yorar', D2.ozel.g.enerji - D1.ozel.g.enerji === 1);
  const U = fresh(); U.ozel.seviye = 3;
  const uh = ozelUi.render(U);
  check('profilde kazanılmış pasifler listelenir', uh.includes('oz-pasifler') && uh.includes('sezonda 4'));
}

console.log('\n── Medya UI ──');
{
  const G = fresh();
  const h = mediaUi.render(G);
  check('basın sahnesinde kalem çipi + Özel Röportaj butonu', h.includes('med-rel') && h.includes('Özel Röportaj') && h.includes('data-act="roportaj"'));
}

console.log('\n────────────────────────────────────────────────');
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
