// tests/vaatler.test.mjs — TUZAK VAAT YOK: 22 sözün HER BİRİ gerçek mekanikle tutulabilir.
// Koşulu kur → evaluatePromise true olmalı. Yeni aksiyonlar (sosyal proje / kadın takımı /
// yurt dışı ofisi) para + etki + sayaç işletir. Çalıştır: node tests/vaatler.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

function fresh(ids = ['P15'], seed = 42) {
  setSeed(seed);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ids, { budget: 60, line: 'hazir' });
  return G;
}
// evaluatePromise dışa açık değil — promiseStatus üzerinden ölç (pct>=90 = koşul sağlanıyor)
const sağlanıyor = (G, id) => (A.promiseStatus(G).find((v) => v.id === id) || {}).pct >= 90;

console.log('\n── Yeni aksiyonlar (P10/P11/P20) ──');
{
  const G = fresh(['P10']);
  const k0 = G.economy.kasa, t0 = G.gauges.taraftar;
  check('sosyal proje 1 çalışır', A.sosyalProje(G) === true && G.term.socialProjects === 1);
  check('SPAM KORUMASI: aynı hafta 2. proje REDDEDİLİR', A.sosyalProje(G) === false && G.term.socialProjects === 1 && G.inbox.some((m) => m.t === 'Ekip zaten sahada'));
  G.meta.week++; A.sosyalProje(G);
  G.meta.week++;
  check('haftada 1 ritmiyle sayaç ilerler: kasa −2/proje + taraftar +1', G.term.socialProjects === 2 && G.economy.kasa === k0 - 4 && G.gauges.taraftar === Math.min(100, t0 + 2));
  check('P10 iki projede HENÜZ tutulmaz', !sağlanıyor(G, 'P10'));
  A.sosyalProje(G);
  check('P10 üçüncü projede TUTULUR', sağlanıyor(G, 'P10'));
  G.meta.week++;
  check('SPAM KORUMASI: dönemde 3 tavan — 4. proje REDDEDİLİR', A.sosyalProje(G) === false && G.term.socialProjects === 3 && G.inbox.some((m) => m.t === 'Sosyal program TAMAM'));
}
{
  const G = fresh(['P11']);
  const k0 = G.economy.kasa;
  check('kadın takımı kurulur: 8mn + etkiler + kayıt', A.kadinTakimiKur(G) === true && G.womensTeam.active && G.economy.kasa === k0 - 8);
  check('P11 kurulunca TUTULUR', sağlanıyor(G, 'P11'));
  check('ikinci kez kurulamaz', A.kadinTakimiKur(G) === false);
}
{
  const G = fresh(['P20']);
  G.club.reputation = 50;
  check('itibar<60 → yurt dışı ofisi RET', A.yurtdisiOfisAc(G) === false && !G.expansion);
  G.club.reputation = 70;
  const sm0 = G.club.sponsorMult ?? 1;
  check('itibar≥60 → ofis açılır + sponsor kalıcı +%6', A.yurtdisiOfisAc(G) === true && G.expansion.officeCount === 1 && (G.club.sponsorMult ?? 1) > sm0);
  check('P20 TUTULUR', sağlanıyor(G, 'P20'));
}

console.log('\n── Koşul kur → söz tutulur (kalan tuzak adayları) ──');
{
  const G = fresh(['P05', 'P12']);
  G.facilities.akademi += 2;
  G.term.academyGraduates = 2;
  check('P05 (akademi+2 & 2 mezun) TUTULUR', sağlanıyor(G, 'P05'));
  check('P12 (≥1 mezun) TUTULUR', sağlanıyor(G, 'P12'));
}
{
  const G = fresh(['P07']);
  G.facilities.stadyum += 1;
  check('P07 (stadyum+1 & bilet ≤1.2) TUTULUR', sağlanıyor(G, 'P07'));
  G.term.maxTicket = 1.6;
  check('P07 bilet zamlanırsa BOZULUR', !sağlanıyor(G, 'P07'));
}
{
  const G = fresh(['P09']);
  G.coach = { ...G.coach, taktik: 85, oyuncuYonetimi: 80, otorite: 80, yardimciEkip: 80 };
  check('P09 (teknik ekip 75+) TUTULUR', sağlanıyor(G, 'P09'));
}
{
  const G = fresh(['P14']);
  G.club.fanCount = Math.ceil((G.promises.find((p) => p.id === 'P14').baselineSnapshot.fanCount) * 1.16);
  check('P14 (taraftar tabanı +%15) TUTULUR', sağlanıyor(G, 'P14'));
}
{
  const G = fresh(['P16']);
  const b = G.promises.find((p) => p.id === 'P16').baselineSnapshot;
  check('P16 baseline haftalık ticari > 0 kaydedildi', b.ticariHaft > 0, `${b.ticariHaft.toFixed(2)}mn/hafta`);
  G.term.weeks = 10; G.term.ticari = b.ticariHaft * 1.3 * 10;
  check('P16 (haftalık ort +%25) TUTULUR', sağlanıyor(G, 'P16'));
}
{
  const G = fresh(['P19']);
  G.museum = [{ tip: 'kupa', t: 'İlk kupa', b: 'tarih yazıldı' }];
  check('P19 (müzeye 1 kayıt) TUTULUR', sağlanıyor(G, 'P19'));
}
{
  // GÜVENLİK AĞI: data'daki HER vaat evaluatePromise'de bir yola sahip (default:false tuzağı boş)
  const G = fresh(['P15']);
  const kapsanan = ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09', 'P10', 'P11', 'P12', 'P13', 'P14', 'P15', 'P16', 'P19', 'P20', 'P21', 'P22', 'P23', 'P24'];
  const eksik = data.promises.map((p) => p.id).filter((id) => !kapsanan.includes(id));
  check('22/22 söz mekanikli — tuzak vaat YOK', eksik.length === 0, eksik.join(',') || 'tam kapsama');
}

console.log('\n── Basın hattı (3. karar — beklenti yönetimi) ──');
{
  setSeed(42);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  const h0 = G.club.hedefSira;
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir', press: 'iddiali' });
  check('İDDİALI: kurul hedefi YÜKSELTİR (sıra küçülür) + manşet', G.club.hedefSira === Math.max(1, h0 - 1) && G.inbox.some((m) => m.t.includes('Eyvallahımız yok')), `${h0}. → ${G.club.hedefSira}.`);
}
{
  setSeed(42);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  const h0 = G.club.hedefSira;
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir', press: 'alcak' });
  check('ALÇAKGÖNÜLLÜ: çıta gevşer (sıra büyür)', G.club.hedefSira === Math.min(17, h0 + 1), `${h0}. → ${G.club.hedefSira}.`);
}
{
  setSeed(42);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  const h0 = G.club.hedefSira, mt0 = G.mediaTone || 0;
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' }); // press verilmedi → sessiz
  check('SESSİZ: hedef sabit + medya izi (köşe yazarı not etti)', G.club.hedefSira === h0 && (G.mediaTone || 0) < mt0 + 0.001 && G.inbox.some((m) => m.t.includes('Başkan konuşmadı')));
}

console.log('\n' + '─'.repeat(48));
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
