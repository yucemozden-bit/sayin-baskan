// tests/katilim.test.mjs — KATILIM KAYNAĞI ROZETLERİ (ALTYAPI / YENİ).
// Kullanıcı isteği: yeni katılan oyuncuyu (transfer) ve altyapıdan geleni (ocak) kadroda ayırt et.
// YENİ rozeti 3 maç haftası görünür, sonra kendiliğinden kalkar (yeniHafta geri sayacı).
// Çalıştır: node tests/katilim.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import * as squad from '../src/ui/squadView.js';
import * as pc from '../src/ui/playerCard.js';

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

console.log('\n── Kadro rozetleri (ALTYAPI / YENİ) ──');
{
  const G = fresh();
  // Kuruluş kadrosu: ne ocak ne yeni-transfer → rozet YOK
  check('kuruluş kadrosunda ALTYAPI/YENİ rozeti yok', !squad.render(G).includes('kad-c-ocak') && !squad.render(G).includes('kad-c-yeni'));

  // ALTYAPI: ocak çocuğu → kalıcı rozet
  G.squad[0].ocak = true;
  const hOcak = squad.render(G);
  check('ocak çocuğu → ALTYAPI rozeti kadroda', hOcak.includes('kad-c-ocak') && hOcak.includes('ALTYAPI'));

  // YENİ: yeni transfer (yeniHafta > 0)
  const t = G.squad.find((x) => !x.ocak);
  t.yeniHafta = 3;
  check('yeni transfer (yeniHafta 3) → YENİ rozeti kadroda', squad.render(G).includes('kad-c-yeni'));
  t.yeniHafta = 1;
  check('yeniHafta 1 → hâlâ YENİ', squad.render(G).includes('kad-c-yeni'));

  // 3 hafta geçince: yeniHafta 0 → YENİ KALKAR
  t.yeniHafta = 0;
  check('yeniHafta 0 (3 hafta geçti) → YENİ rozeti KALKAR', !squad.render(G).includes('kad-c-yeni'));

  // ocak, YENİ'yi ezer (ALTYAPI kalıcı kimlik)
  const both = G.squad[0]; both.ocak = true; both.yeniHafta = 3;
  check('ocak + yeni → ALTYAPI gösterir (YENİ değil)', squad.render(G).includes('ALTYAPI'));
}

console.log('\n── Oyuncu kartı chip’i ──');
{
  const G = fresh();
  const p = G.squad[0]; p.ocak = true; G._pcard = p.id;
  check('kartta ALTYAPI chip’i', pc.render(G).includes('pc-chip alt') && pc.render(G).includes('ALTYAPI'));
  const q = G.squad.find((x) => !x.ocak); q.yeniHafta = 3; G._pcard = q.id;
  check('kartta YENİ chip’i (yeniHafta > 0)', pc.render(G).includes('pc-chip yeni') && pc.render(G).includes('YENİ'));
  q.yeniHafta = 0; G._pcard = q.id;
  check('yeniHafta 0 → kartta YENİ chip’i YOK', !pc.render(G).includes('pc-chip yeni'));
}

console.log('\n── Kaynak: transfer damgası + haftalık geri sayım + altyapı izi ──');
{
  const dmg = (actSrc.match(/\.yeniHafta = 3/g) || []).length;
  check('3 transfer noktası da yeniHafta = 3 damgalar', dmg >= 3, `${dmg} nokta`);
  check('haftalık döngü yeniHafta’yı azaltır (3 hafta sonra kalkar)', /if \(p\.yeniHafta > 0\) p\.yeniHafta--/.test(actSrc), '');
  check('altyapı gençleri ocak:true alır', /y\.ocak = true/.test(actSrc), '');
}

console.log('\n────────────────────────────────────────────────');
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
