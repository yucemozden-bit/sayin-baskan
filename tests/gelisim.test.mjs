// tests/gelisim.test.mjs — GELİŞİM SÜREKLİLİĞİ bataryası (kullanıcı raporu: "ilk sezon artıyordu,
// sonraki sezonlarda kimse yükselmiyor"). Kök nedenler: potansiyel tavanları 1-2 sezonda doluyordu
// (esneme yoktu) + 22-23 yaş sezon içi gelişime tümden kapalıydı. Bu batarya eğrinin ölü
// doğmamasını KALICI garanti eder. Çalıştır: node tests/gelisim.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import { TUNING } from '../src/config.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

// Bir dönem (3 sezon) oynat, sezon başına (içi + sonu) artan oyuncu sayısını ölç.
// DİKKAT: 3. sezon dönem sonudur → seçim fazına girmeden ölçüm biter (faz tuzağı — bkz. teşhis dersi).
function donemOlc(seed) {
  setSeed(seed);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  const sezonlar = [];
  for (let s = 1; s <= 3; s++) {
    while ((G.hazirlik || 0) > 0) A.preSeasonWeek(G);
    const bas = new Map(G.squad.map((p) => [p.id, p.overall]));
    while (G.meta.week <= 34 && G.phase === 'SEASON_LOOP') { A.advanceWeek(G); G.pendingMatch = null; A.drainAllPhones && A.drainAllPhones(G); }
    const ic = G.squad.filter((p) => bas.has(p.id) && p.overall > bas.get(p.id)).length;
    const orta = new Map(G.squad.map((p) => [p.id, p.overall]));
    let son = 0;
    if (s < 3 && G.phase === 'SEASON_LOOP') {
      A.endSeason(G); A.afterSeasonEnd(G);
      son = G.squad.filter((p) => orta.has(p.id) && p.overall > orta.get(p.id)).length;
    }
    sezonlar.push({ ic, son });
  }
  return { sezonlar, G };
}

console.log('\n── EĞRİ: gelişim sonraki sezonlarda ÖLMEZ ──');
{
  const { sezonlar, G } = donemOlc(42);
  console.log('  ölçüm:', sezonlar.map((s, i) => `S${i + 1} içi ${s.ic}${i < 2 ? '+sonu ' + s.son : ''}`).join(' · '));
  check('S1: gelişim canlı (içi ≥ 4)', sezonlar[0].ic >= 4, `${sezonlar[0].ic}`);
  check('S2: gelişim SÜRÜYOR (içi+sonu ≥ 4)', sezonlar[1].ic + sezonlar[1].son >= 4, `${sezonlar[1].ic}+${sezonlar[1].son}`);
  check('S3: gelişim SÜRÜYOR (içi ≥ 1 — eski kodda 0\'a düşüyordu)', sezonlar[2].ic >= 1, `içi ${sezonlar[2].ic}`);
  // abartı freni: kadro ortalaması şişmesin (güç enflasyonu ligi kırmasın)
  const ort = G.squad.reduce((a, p) => a + p.overall, 0) / G.squad.length;
  check('abartı yok: dönem sonunda kadro ort. 50-62 bandında', ort >= 50 && ort <= 62, ort.toFixed(1));
}

console.log('\n── MEKANİK: geç gelişimci + potansiyel esnemesi ──');
{
  setSeed(7);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  // 22 ve 26 yaş, boşluklu oyuncular → artık gelişebilmeli (sınır 27'ye çıktı — kullanıcı isteği)
  const gec = G.squad.find((p) => p.age >= 24);
  gec.age = 22; gec.overall = 55; gec.potential = 68; gec._gelSezon = 0; gec._gel = 0;
  const orta = G.squad.find((p) => p.age >= 24 && p !== gec);
  orta.age = 26; orta.overall = 56; orta.potential = 66; orta._gelSezon = 0; orta._gel = 0;
  while ((G.hazirlik || 0) > 0) A.preSeasonWeek(G);
  while (G.meta.week <= 34 && G.phase === 'SEASON_LOOP') { A.advanceWeek(G); G.pendingMatch = null; A.drainAllPhones && A.drainAllPhones(G); }
  check('22 yaş geç gelişimci sezon içinde büyüdü', gec.overall > 55, `55 → ${gec.overall}`);
  check('26 yaş da büyüyor (sınır 27 — kullanıcı isteği)', orta.overall > 56, `56 → ${orta.overall}`);
  check(`geç gelişimci sezon tavanı ${TUNING.DEV_GEC_CAP} aşılamaz`, (gec._gelSezon || 0) <= TUNING.DEV_GEC_CAP && (orta._gelSezon || 0) <= TUNING.DEV_GEC_CAP, `_gelSezon ${gec._gelSezon}/${orta._gelSezon}`);
  check('28+ hâlâ GELİŞMEZ (sınır 27\'de durur)', !G.squad.some((p) => p.age >= 28 && (p._gelSezon || 0) > 0));

  // POT ESNEMESİ: tavana vuran genç sezon sonunda +2 tavan kazanır (kariyer cap'li)
  const genc = G.squad.find((p) => p.age <= 21 && p !== gec) || G.squad[0];
  genc.age = 20; genc.overall = 60; genc.potential = 60; genc._potEsneme = 0;
  const doymus = G.squad.find((p) => p.age <= 21 && p !== genc && p !== gec);
  if (doymus) { doymus.age = 21; doymus.overall = 58; doymus.potential = 58; doymus._potEsneme = TUNING.POT_ESNEME.kariyerCap; }
  A.endSeason(G);
  check('tavana vuran genç: pot +2 esnedi', genc.potential === 60 + TUNING.POT_ESNEME.artis, `pot ${genc.potential}`);
  check('kariyer cap dolmuş genç: pot SABİT (sınırsız şişme yok)', !doymus || doymus.potential === 58, doymus ? `pot ${doymus.potential}` : 'aday yok');
}

console.log('\n── DETERMİNİZM ──');
{
  const a = donemOlc(99).sezonlar, b = donemOlc(99).sezonlar;
  check('aynı seed çift koşum → eğri bit-bit aynı', JSON.stringify(a) === JSON.stringify(b));
}

console.log(`\nSONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
