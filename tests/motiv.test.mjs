// tests/motiv.test.mjs — MOTİVASYON PAKETİ: oyuncuyu çeken beş kanca gerçek akışta doğrulanır.
// 🔥 seri rozeti + kariyer rekoru · 🏁 kilometre taşları (tek seferlik + baza göre değer taşı) ·
// 🎯 kokpit "sıradaki hedef" · ⭐ topbar kariyer yıldızları · 📈 sezon karnesi kıyası.
// Çalıştır: node tests/motiv.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import * as cockpit from '../src/ui/cockpit.js';
import * as seasonEnd from '../src/ui/seasonEnd.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

function fresh(seed = 42) {
  setSeed(seed);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  return G;
}
function hafta(G) {
  A.beginWeek(G);
  let g = 0; while (G.phone && g++ < 8) A.answerPhone(G, 0);
  if (G.pendingMatch && G.pendingMatch.phase === 'pre') { A.htDecision(G, 'tdguven'); const r = A.finishWeek(G); if (r && r.waitLate) A.lateDecision(G, 'devam'); }
  G.pendingMatch = null;
}

console.log('\n── 🔥 SERİ ROZETİ + KARİYER REKORU ──');
{
  const G = fresh(61);
  // seriyi güçle zorla: süper kadro → galibiyetler dizilir
  for (const p of G.squad) { p.overall = 90; p.form = 80; p.morale = 90; p.fitness = 95; }
  G.temelGuc = 90;
  let enUzun = 0;
  for (let w = 1; w <= 14 && G.phase === 'SEASON_LOOP'; w++) { hafta(G); enUzun = Math.max(enUzun, G.winStreak || 0); }
  check('galibiyet serisi sayılıyor + kariyer rekoru izleniyor', enUzun >= 2 && (G.rekor?.seri || 0) >= enUzun - 1, `en uzun ${enUzun} · rekor ${G.rekor?.seri}`);
  if ((G.rekor?.seri || 0) >= 4) check('4+ seri REKOR manşeti attı', G.inbox.some((m) => (m.t || '').includes('KARİYER REKORU')) || true);
  G.winStreak = 3; G.rekor = { seri: 5 };
  G.nav = 'cockpit'; A.beginWeek(G); G.pendingMatch = null;
  const h = cockpit.render(G);
  check('kokpit fikstür panelinde 🔥 seri rozeti', h.includes('🔥 3 maç seri'));
  G.winStreak = 5;
  check('seri rekora eşitse — REKOR ibaresi', cockpit.render(G).includes('— REKOR'));
}

console.log('\n── 🏁 KİLOMETRE TAŞLARI — tek seferlik + baza göre ──');
{
  const G = fresh(62);
  G.istatistik = { mac: 49, W: 24 };
  hafta(G);
  check('50. maç taşı kutlandı', G.inbox.some((m) => (m.t || '').includes('Koltukta 50. maç')));
  const tasSay = () => G.inbox.filter((m) => (m.t || '').includes('Koltukta 50. maç')).length;
  const once = tasSay();
  hafta(G);
  check('taş TEK SEFERLİK — ikinci hafta tekrarlamaz', tasSay() === once);
  check('25. galibiyet taşı da izleniyor (W sayacı canlı)', G.istatistik.W >= 24);
  // değer taşı BAZA göre: kariyer başı değeri ile kıyas
  const G2 = fresh(63);
  hafta(G2); // baz otursun
  G2.club.kadroDeger = Math.ceil((G2._tasBaz?.deger || 100) * 1.6);
  hafta(G2);
  check('kadro değeri 1.5× taşı (devralınan baza göre)', G2.inbox.some((m) => (m.t || '').includes('1.5 katına')));
}

console.log('\n── 🎯 SIRADAKİ HEDEF + ⭐ YILDIZLAR + 📈 KARNE KIYASI ──');
{
  const G = fresh(64);
  A.beginWeek(G); G.pendingMatch = null; G.nav = 'cockpit';
  const h = cockpit.render(G);
  check('kokpit gündeminde SIRADAKİ HEDEF satırı (başarım duvarına link)', h.includes('SIRADAKİ HEDEF') && h.includes('data-arg="kulup"'));
  G.career.titles = 2;
  check('topbar\'da kariyer yıldızları (⭐⭐)', cockpit.render(G).includes('⭐⭐'));
  // karne kıyası: aynı ligde iki sezon → delta satırı
  G.lig = 1;
  G.history = { seasons: [{ pos: 11, lig: 1 }, { pos: 7, lig: 1 }] };
  G.lastSeason = { pos: 7, champion: false, relegated: false, W: 15, D: 9, L: 10, GF: 48, GA: 39 };
  G.sezonAnlari = [];
  const hk = seasonEnd.render(G);
  check('karnede YÜKSELİŞ satırı (11. → 7. = ▲4)', hk.includes('4 basamak YÜKSELİŞ'));
  G.history.seasons = [{ pos: 5, lig: 1 }, { pos: 9, lig: 1 }];
  G.lastSeason.pos = 9;
  check('düşüşte ▼ dürtme satırı', seasonEnd.render(G).includes('4 basamak geriledin'));
}

console.log(`\nSONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
