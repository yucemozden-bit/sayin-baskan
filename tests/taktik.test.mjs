// tests/taktik.test.mjs — TAKTİK UYUM: ceza GEÇİCİ olmalı, kalıcı hasara dönüşmemeli.
// REGRESYON (2026-07-23, kullanıcı raporu "Taktik uyum neden sürekli 0"): uyumHafta sayacı kodda
// yalnızca AZALIYORDU — TD kovma/değiştirme → 0 (Bible-10 cezası), telkin spam'ı → −1 — ve hiçbir
// yerde artmıyordu. Bir kez sıfırlanınca kalıcı 0'da kalıp TaktikUyum'u (TemelGüç'ün %10'u) tamamen
// öldürüyordu. Hiçbir test bunu tutmuyordu; bu dosya o boşluğu kapatır.
// Çalıştır: node tests/taktik.test.mjs

import { readFileSync } from 'node:fs';
import { TUNING } from '../src/config.js';
import { setSeed } from '../src/core/rng.js';
import { taktikUyum } from '../src/engines/power.js';
import * as A from '../src/actions.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };

const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

const MAX = TUNING.TAKTIK_UYUM_MAX ?? 12;
const kur = () => { const G = A.newGame(data, 'normal'); A.selectClub(G, 'orta'); A.startTerm(G, [data.promises[0].id], null); return G; };
// Bir haftayı oynat (maç akışı; bot kararları nötr)
function hafta(G) {
  if (G.phase !== 'SEASON_LOOP') return;
  A.beginWeek(G);
  if (G.phase !== 'SEASON_LOOP') return;
  let g = 0; while (G.phone && g++ < 8) A.answerPhone(G, 0);
  if (G.pendingMatch && G.pendingMatch.phase === 'pre') {
    A.htDecision(G, 'tdguven');
    const r = A.finishWeek(G);
    if (r && r.waitLate) A.lateDecision(G, 'devam');
  }
  G.pendingMatch = null;
}

console.log('\n── TAKTİK UYUM · ceza geçici mi? ──');
setSeed(31);

// ═══ 1) BİRİM: formül ═══
check('birim: uyumHafta 0 → TaktikUyum 0', taktikUyum({ uyumHafta: 0, rolUygunlugu: 1 }) === 0);
check('birim: uyumHafta MAX → TaktikUyum > 0', taktikUyum({ uyumHafta: MAX, rolUygunlugu: 1 }) > 0,
  String(Math.round(taktikUyum({ uyumHafta: MAX, rolUygunlugu: 1 }))));
check('birim: uyumHafta arttıkça TaktikUyum artar (monoton)',
  taktikUyum({ uyumHafta: 4, rolUygunlugu: 1 }) < taktikUyum({ uyumHafta: 8, rolUygunlugu: 1 }));

// ═══ 2) KURULUŞ: normal oyunda tavanda sabit (denge kaymaz) ═══
{
  const G = kur();
  const bas = G.taktik.uyumHafta;
  check('kuruluş: uyumHafta = TAKTIK_UYUM_MAX', bas === MAX, `${bas} / ${MAX}`);
  for (let i = 0; i < 5; i++) hafta(G);
  check('normal oyun: tavanı AŞMAZ (güç şişmesi yok)', G.taktik.uyumHafta === MAX, String(G.taktik.uyumHafta));
}

// ═══ 3) REGRESYON ÇEKİRDEĞİ: 0'a düşünce TOPARLANIR ═══
{
  const G = kur();
  G.taktik.uyumHafta = 0; // TD kovma/değişimi senaryosu (Bible-10 cezası)
  check('ceza anı: TaktikUyum 0', Math.round(taktikUyum(G.taktik)) === 0);
  hafta(G);
  check('BUG KORUMASI: 1 hafta sonra uyumHafta ARTMIŞ olmalı (eskiden 0 kalıyordu)',
    G.taktik.uyumHafta > 0, String(G.taktik.uyumHafta));
  const iz = [G.taktik.uyumHafta];
  for (let i = 0; i < MAX + 2; i++) { hafta(G); iz.push(G.taktik.uyumHafta); }
  check('toparlanma MONOTON (hiç geri gitmez)', iz.every((v, i) => i === 0 || v >= iz[i - 1]), iz.join(','));
  check('toparlanma tavanda DURUR (MAX aşılmaz)', Math.max(...iz) === MAX, String(Math.max(...iz)));
  check('ceza GEÇİCİ: MAX+2 hafta içinde tam toparlanır', G.taktik.uyumHafta === MAX, `${G.taktik.uyumHafta} / ${MAX}`);
  check('TaktikUyum da geri gelir (> 0)', Math.round(taktikUyum(G.taktik)) > 0, String(Math.round(taktikUyum(G.taktik))));
}

// ═══ 4) TELKİN SPAM cezası da kalıcı olmamalı ═══
{
  const G = kur();
  G.taktik.uyumHafta = Math.max(0, MAX - 3); // spam törpüsü sonrası
  for (let i = 0; i < 5; i++) hafta(G);
  check('telkin spam törpüsü de toparlanır', G.taktik.uyumHafta === MAX, `${G.taktik.uyumHafta} / ${MAX}`);
}

// ═══ 5) DETERMİNİZM: toparlanma rand TÜKETMEZ (aynı seed → aynı kariyer) ═══
{
  const parmak = (uyumSifirla) => {
    setSeed(9090);
    const G = kur();
    if (uyumSifirla) G.taktik.uyumHafta = MAX; // aynı değer → aynı akış
    for (let i = 0; i < 6; i++) hafta(G);
    return `${G.meta.week}|${Math.round(G.temelGuc)}|${Math.round(G.gauges.taraftar)}`;
  };
  check('determinizm: aynı seed + aynı uyum → aynı parmak izi', parmak(false) === parmak(true));
}

console.log(`\n${'─'.repeat(48)}\nSONUÇ: ${pass} geçti, ${fail} kaldı\n`);
process.exit(fail ? 1 : 0);
