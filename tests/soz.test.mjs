// tests/soz.test.mjs — OYUN-İÇİ VAAT: sezon ortasında yeni söz ver (el güçlenir; tutulmazsa yaptırım).
// Çalıştır: node tests/soz.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

function fresh(seed = 5) {
  setSeed(seed);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  return G;
}

console.log('\n── Oyun-içi Vaat ──');
{
  const G = fresh();
  check('sezon aktif (SEASON_LOOP)', G.phase === 'SEASON_LOOP');
  check('başlangıç vaadi (P15) seçeneklerde YOK', !A.midPromiseOptions(G).some((p) => p.id === 'P15'));
  const tar0 = G.gauges.taraftar;
  const ok = A.makeMidPromise(G, 'P01'); // Şampiyonluk, zorluk 5
  const added = (G.promises || []).find((pr) => pr.id === 'P01');
  check('yeni söz eklenir (midTerm=true, kept=null)', ok === true && !!added && added.midTerm === true && added.kept === null);
  check('taraftar coşar (anlık umut bonusu → el güçlenir)', G.gauges.taraftar > tar0, `${tar0} → ${G.gauges.taraftar}`);
  check('kürsü notu inbox\'a düşer', G.inbox.some((m) => m.t.startsWith('Kürsüde yeni söz')));
}
{
  const G = fresh();
  A.makeMidPromise(G, 'P01');
  check('aynı sözü ikinci kez veremezsin', A.makeMidPromise(G, 'P01') === false);
}
{
  const G = fresh();
  A.makeMidPromise(G, 'P01');
  A.makeMidPromise(G, 'P03');
  const third = A.makeMidPromise(G, 'P04');
  check('dönem başına en fazla 2 yeni söz (3.\'sü reddedilir)', third === false && A.midPromiseCount(G) === 2, `sayı ${A.midPromiseCount(G)}`);
}
{
  const G = fresh();
  G.phase = 'TERM_SETUP'; // sezon dışı
  check('sezon dışında yeni söz verilemez', A.makeMidPromise(G, 'P01') === false);
}
{
  // Tutulmayan mid-term söz dönem sonu yaptırım görür (kept=false → sicil/oy cezası mevcut sistemle)
  const G = fresh();
  A.makeMidPromise(G, 'P01'); // şampiyonluk — tutulması zor
  const p = G.promises.find((pr) => pr.id === 'P01');
  check('mid-term söz normal vaat gibi değerlendirmeye girer (kept=null, baseline var)', p.kept === null && !!p.baselineSnapshot);
}

console.log('\n' + '─'.repeat(48));
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
