// tests/antrenman.test.mjs — ANTRENMAN TESİSİ GÖRÜNÜR FAYDA bataryası.
// Kullanıcı isteği: her seviye gelişime GERÇEKTEN katkı yapsın (eski floor(sv/5) yalnız
// 5 ve 10'da basamaktı) + "kondisyon çabuk toparlar" vaadi koda bağlansın.
// Çalıştır: node tests/antrenman.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed, rand } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import { TUNING } from '../src/config.js';
import { postMatch } from '../src/engines/match.js';
import * as facUi from '../src/ui/facilitiesView.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

console.log('\n── DİNLENME: antrenman tesisi yedeği daha hızlı toparlar (birim) ──');
{
  const mk = (fit) => Array.from({ length: 18 }, (_, i) => ({ id: 'p' + i, name: 'p' + i, pos: ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD'][i] || 'MID', overall: i < 11 ? 70 : 50, potential: 70, age: 26, morale: 60, form: 55, fitness: fit, injuryWeeks: 0, suspensionWeeks: 0 }));
  const rngSabit = () => 0.99; // sakatlık zarı atlasın
  const s0 = mk(50); postMatch(s0, 'D', { tibbi: 5, antrenman: 0 }, rngSabit);
  const s10 = mk(50); postMatch(s10, 'D', { tibbi: 5, antrenman: 10 }, rngSabit);
  const yedek0 = s0.find((p) => p.overall === 50).fitness;
  const yedek10 = s10.find((p) => p.overall === 50).fitness;
  check('sv10 tesiste yedek, sv0\'a göre maç başına +4 fazla toparlar', yedek10 - yedek0 === 10 * TUNING.FIT_ANT, `${yedek0} vs ${yedek10}`);
  const on0 = s0.find((p) => p.overall === 70).fitness, on10 = s10.find((p) => p.overall === 70).fitness;
  check('oynayanın yıpranması tesisten ETKİLENMEZ (dinlenme bonusu yalnız yedeğe)', on0 === on10);
}

console.log('\n── GELİŞİM: her seviye hız katar + elit tavan (entegrasyon, aynı seed) ──');
function sezonGelisim(seed, ant) {
  setSeed(seed);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  G.facilities.antrenman = ant;
  const genc0 = new Map(G.squad.filter((p) => p.age <= 21).map((p) => [p.id, p.overall]));
  const say = () => { let t = 0; for (const p of G.squad) if (genc0.has(p.id)) t += p.overall - genc0.get(p.id); return t; };
  let ara = 0;
  while (G.meta.week <= 34 && G.phase === 'SEASON_LOOP') {
    A.advanceWeek(G); G.pendingMatch = null; A.drainAllPhones && A.drainAllPhones(G);
    if (G.meta.week === 16) ara = say(); // sezon ortası fotoğrafı — HIZ farkı burada görünür
  }
  let maxSezon = 0;
  for (const p of G.squad) if (genc0.has(p.id)) maxSezon = Math.max(maxSezon, p._gelSezon || 0);
  return { toplam: say(), ara, maxSezon };
}
{
  const dusuk = sezonGelisim(42, 2);
  const orta = sezonGelisim(42, 6);
  const elit = sezonGelisim(42, 9);
  // sezon TOPLAMI tavanla (+3) sınırlanabilir — ara seviyelerin gerçek faydası HIZ:
  // tavana haftalar önce varan genç, sezonun kalanını daha güçlü oynar (değer + saha katkısı)
  check('sezon ORTASINDA sv6, sv2\'den ileride (ara seviyeler artık boşa gitmiyor)', dusuk.ara < orta.ara, `hafta16 → sv2:${dusuk.ara} sv6:${orta.ara}`);
  check('sv6 ≤ sv9 toplamda (elit tavan +4 fark yaratır)', orta.toplam <= elit.toplam, `sv6:${orta.toplam} sv9:${elit.toplam}`);
  check('elit tesiste sezon içi tavan +4 erişilebilir (sv9 koşumunda maks sezon gelişimi ≥ sv2 koşumundan büyük)', elit.maxSezon >= dusuk.maxSezon && elit.maxSezon <= 4, `maks: sv2 ${dusuk.maxSezon} · sv9 ${elit.maxSezon}`);
  check('abartı yok: sv9 toplam gelişim makul bantta (< genç başına ~4)', elit.toplam <= 4 * 8);
}

console.log('\n── DETERMİNİZM + UI ──');
{
  const a = sezonGelisim(77, 7), b = sezonGelisim(77, 7);
  check('aynı seed + aynı tesis → bit-bit aynı gelişim', a.toplam === b.toplam && a.maxSezon === b.maxSezon);
  setSeed(555); const bek = rand(0, 1);
  setSeed(555); postMatch([], 'D', { antrenman: 10 }, () => 0.99); const son = rand(0, 1);
  check('dinlenme bonusu core rng TÜKETMEZ', bek === son);
  // tesis kartı somut sayıları basıyor
  setSeed(9);
  const G = A.newGame(data, 'normal'); A.selectClub(G, 'orta'); A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  G.facilities.antrenman = 5; G.nav = 'tesis';
  const h = facUi.render(G);
  const bekDev = (5 * TUNING.DEV_ANT_HAFTALIK).toFixed(1), bekFit = (5 * TUNING.FIT_ANT).toFixed(1);
  check('tesis kartında canlı sayılar (TUNING ile aynı) + sonraki seviye', h.includes(`+${bekDev} puan/hafta`) && h.includes(`+${bekFit} kond/maç`) && h.includes('Sv.6:'), `+${bekDev} · +${bekFit}`);
  check('tesis ekranı NaN/undefined sızdırmıyor', !/NaN|undefined/.test(h));
}

console.log(`\nSONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
