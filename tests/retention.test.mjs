// tests/retention.test.mjs — RETENTION denetimi: objectives motoru çökmez, kariyer
// boyunca başarımlar GERÇEKTEN açılır, nudge her durumda anlamlı satır döner.
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import { nextObjectives, topNudge } from '../src/engines/objectives.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));

setSeed(4242);
const data = {
  teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'),
  media: load('media.json'), firms: load('firms.json'), events: load('events.json'),
  social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'),
  achievements: load('achievements.json'),
};

let threw = null, nudgeKinds = new Set(), objCount = 0, ticks = 0, achAtEnd = 0;
try {
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ['P01', 'P02', 'P15'], { budget: 60, line: 'hazir' });

  // objectives boş state'te bile çökmemeli
  check('nextObjectives boot-safe', Array.isArray(nextObjectives(G)));
  check('topNudge boot-safe', topNudge(G) === null || typeof topNudge(G).text === 'string');

  for (let season = 1; season <= 3; season++) {
    for (let w = 0; w < 34; w++) {
      A.advanceWeek(G);
      const objs = nextObjectives(G); objCount += objs.length;
      const nudge = topNudge(G); if (nudge) nudgeKinds.add(nudge.kind);
      // her tick nudge/objectives çökmesin + her objenin geçerli pct'si olsun
      for (const o of objs) if (o.pct != null && (o.pct < 0 || o.pct > 1 || Number.isNaN(o.pct))) throw new Error('geçersiz pct: ' + JSON.stringify(o));
      ticks++;
      G.pendingMatch = null;
    }
    A.endSeason(G);
    A.afterSeasonEnd(G);
  }
  achAtEnd = Object.keys(G.achUnlocked || {}).length;
} catch (err) { threw = err; }

check('kariyer boyunca objectives/nudge hatasız', threw === null, threw ? (threw.stack || threw.message) : '');
check('her tick en az 1 hedef üretildi (ortalama)', objCount / Math.max(1, ticks) >= 1, `ort ${(objCount / Math.max(1, ticks)).toFixed(1)} hedef/hafta`);
check('nudge çeşitliliği ≥ 2 tür (tekdüze değil)', nudgeKinds.size >= 2, [...nudgeKinds].join(', '));
check('3 sezonda ≥1 başarım açıldı (ödül döngüsü canlı)', achAtEnd >= 1, `${achAtEnd} başarım`);

console.log(`\n${'─'.repeat(48)}\nSONUÇ: ${pass} geçti, ${fail} kaldı\n`);
process.exit(fail ? 1 : 0);
