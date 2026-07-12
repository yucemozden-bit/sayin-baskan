// tests/balance.test.mjs — DENGE TESTLERİ (T1-T4): her tier nötr botla tam sezon oynar.
// Ölçülen: çökme yok · iflas bandı · sıra bantları · ekonomi sağlığı (NaN/uçuk borç yok) ·
// 2. lig terfi bandı. Bantlar BİLİNÇLİ geniş — tasarım hedefi, kalibrasyon cetveli değil.
// Çalıştır: node tests/balance.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

const N = 24; // tier başına koşum (4 tier × 24 = 96 tam sezon)

// Nötr bot: advanceWeek kompoziti nötr kararlarla oynar; telefonlar güvenli seçenekle kapanır
function sezonOyna(tier, seed) {
  setSeed(seed);
  const G = A.newGame(data, 'normal');
  if (tier === 'lig2') A.selectClub(G, 'kucuk', null, { lig2: true });
  else A.selectClub(G, tier);
  A.startTerm(G, ['P15'], { budget: Math.round(G.economy.kasa * 0.5), line: 'hazir' });
  let guard = 0;
  while (G.meta.week <= G.SEASON_WEEKS && G.phase === 'SEASON_LOOP' && guard++ < 60) {
    A.advanceWeek(G);
    G.pendingMatch = null;
  }
  return G;
}

function bant(ad, tier, seedBase, olc) {
  const sonuc = { crash: 0, iflas: 0, posT: 0, borcMax: 0, nan: 0, terfi: 0, n: 0 };
  for (let i = 0; i < N; i++) {
    try {
      const G = sezonOyna(tier, seedBase + i);
      sonuc.n++;
      if (G.phase !== 'SEASON_LOOP') sonuc.iflas++;
      const pos = G.myPos || 18;
      sonuc.posT += pos;
      sonuc.borcMax = Math.max(sonuc.borcMax, G.economy.borc);
      if (!Number.isFinite(G.economy.kasa) || !Number.isFinite(G.economy.borc)) sonuc.nan++;
      if (tier === 'lig2' && pos <= 3) sonuc.terfi++;
    } catch { sonuc.crash++; }
  }
  const ortPos = sonuc.posT / Math.max(1, sonuc.n - 0); // iflas edenler de saymıştır (pos son bilinen)
  console.log(`\n── ${ad} (${N} sezon) ──`);
  check(`${ad}: ÇÖKME YOK`, sonuc.crash === 0, `${sonuc.crash} crash`);
  check(`${ad}: ekonomi sağlıklı (NaN yok, borç < 600mn)`, sonuc.nan === 0 && sonuc.borcMax < 600, `maks borç ${Math.round(sonuc.borcMax)}mn`);
  olc(sonuc, ortPos);
  return sonuc;
}

// T1 KÜÇÜK: alt-orta sıra beklenir; nötr oyunla iflas nadir olmalı
bant('T1 Küçük', 'kucuk', 11000, (s, ort) => {
  check('T1: ortalama sıra 7-17 bandında (küme savaşı gerçek)', ort >= 7 && ort <= 17, `ort ${ort.toFixed(1)}.`);
  check('T1: sezon-içi çöküş ≤ %25 (nötr oyun bedava batırmaz)', s.iflas / s.n <= 0.25, `%${Math.round(100 * s.iflas / s.n)}`);
});
// T2 ORTA: orta sıra
bant('T2 Orta', 'orta', 12000, (s, ort) => {
  check('T2: ortalama sıra 4-14 bandında', ort >= 4 && ort <= 14, `ort ${ort.toFixed(1)}.`);
  check('T2: sezon-içi çöküş ≤ %20', s.iflas / s.n <= 0.20, `%${Math.round(100 * s.iflas / s.n)}`);
});
// T3 BÜYÜK: üst sıra baskısı — ama şampiyonluk garantisi YOK
bant('T3 Büyük', 'buyuk', 13000, (s, ort) => {
  check('T3: ortalama sıra 1-9 bandında (favori ama garanti değil)', ort >= 1 && ort <= 9, `ort ${ort.toFixed(1)}.`);
  check('T3: sezon-içi çöküş ≤ %25 (ağır borç riski hissedilir)', s.iflas / s.n <= 0.25, `%${Math.round(100 * s.iflas / s.n)}`);
});
// T4 2.LİG: terfi ne bedava ne imkânsız
bant('T4 2.Lig', 'lig2', 14000, (s) => {
  check('T4: terfi oranı %10-90 bandında (ne bedava ne imkânsız)', s.terfi / s.n >= 0.10 && s.terfi / s.n <= 0.90, `%${Math.round(100 * s.terfi / s.n)} terfi`);
});

console.log('\n' + '─'.repeat(48));
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
