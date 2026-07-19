// tests/ihale.test.mjs — ŞANTİYE SİSTEMİ: ihale artık haftalara bağlı.
// Kurgu: her teklifte SÜRE seçmeden önce yazar (A ucuz/5h/sarkma riski · B pahalı/2h/bonus ·
// C tanıdık/3h/sızıntı). Seçim = kazma; kademe KURDELE kesilince gelir. Zarlar seçim ANINDA
// atılır (tip başına 1 rand — eski yapıyla birebir: determinizm dizisi kaymaz), haftalık tick RNG'siz.
// Çalıştır: node tests/ihale.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed, rand } from '../src/core/rng.js';
import { TUNING } from '../src/config.js';
import * as A from '../src/actions.js';
import * as tesisUi from '../src/ui/facilitiesView.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

function fresh(seed = 42) {
  setSeed(seed);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  G.economy.kasa = 200;
  return G;
}

console.log('\n── Tekliflerde süre SEÇMEDEN ÖNCE görünür ──');
{
  const G = fresh();
  A.upgradeFacility(G, 'akademi');
  const T = TUNING.TENDER;
  check('3 teklifin üçünde de hafta alanı dolu (A 5 · B 2 · C 3)',
    G.tender.offers.every((o) => o.hafta >= 1) && G.tender.offers[0].hafta === T.A.hafta && G.tender.offers[1].hafta === T.B.hafta && G.tender.offers[2].hafta === T.C.hafta,
    G.tender.offers.map((o) => `${o.type}:${o.hafta}h`).join(' '));
  check('üçgen kurgu: ucuz=yavaş, pahalı=hızlı', G.tender.offers[0].cost < G.tender.offers[1].cost && G.tender.offers[0].hafta > G.tender.offers[1].hafta);
  const ui = tesisUi.render(G);
  check('ihale ekranında ⏱ süre rozeti her kartta', (ui.match(/⏱ \d+ HAFTA/g) || []).length === 3);
}

console.log('\n── Seçim = kazma; kademe kurdelede gelir ──');
{
  const G = fresh();
  A.upgradeFacility(G, 'akademi');
  const lvl0 = G.facilities.akademi, kasa0 = G.economy.kasa, bedel = G.tender.offers[1].cost;
  const r = A.chooseTender(G, 1); // B: 2 hafta
  check('seçimde para düşer ama kademe HENÜZ artmaz (şantiye kuruldu)', r.ok && G.facilities.akademi === lvl0 && Math.abs(G.economy.kasa - (kasa0 - bedel)) < 1e-9 && G.santiye?.tesis === 'akademi' && G.santiye.kalan === 2);
  check('kazma manşeti süreyi söyler', G.inbox.some((m) => (m.t || '').includes('Kazma vuruldu') && (m.b || '').includes('2 hafta')));
  check('şantiye sürerken YENİ ihale açılamaz (tek inşaat kuralı)', A.upgradeFacility(G, 'tibbi').ok === false);
  const ui = tesisUi.render(G);
  check('tesis panosunda 🏗 ilerleme görünür + diğer butonlar kilitli', ui.includes('ŞANTİYE · 0/2 hafta') && ui.includes('tek inşaat'));
  A.santiyeTick(G);
  check('1 hafta sonra ilerleme 1/2', G.santiye.kalan === 1 && tesisUi.render(G).includes('ŞANTİYE · 1/2 hafta'));
  A.santiyeTick(G);
  check('süre doldu: KURDELE — kademe ŞİMDİ devrede + şantiye kapandı', G.santiye === null && G.facilities.akademi >= lvl0 + 1 && G.inbox.some((m) => (m.t || '').includes('Kurdele kesildi')));
}

console.log('\n── Sürprizler vaktinde sahnelenir (senaryo avcısı) ──');
{
  // A-sarkma senaryosu: plan.sarkmaHafta dolu bir seed bul → yarı yolda +3 hafta manşetiyle uzar
  let G = null;
  for (let s = 100; s < 400 && !G; s++) { const g = fresh(s); A.upgradeFacility(g, 'akademi'); A.chooseTender(g, 0); if (g.santiye?.sarkmaHafta) G = g; }
  check('sarkan-seed bulundu (zar seçim anında plana yazılır)', !!G);
  if (G) {
    const toplam0 = G.santiye.toplam;
    let guard = 0; while (G.santiye && !G.inbox.some((m) => (m.t || '').includes('aksama')) && guard++ < 10) A.santiyeTick(G);
    check('yarı yolda AKSAMA manşeti + süre uzadı (+3)', G.santiye && G.santiye.toplam === toplam0 + TUNING.TENDER.A.sarkma);
    guard = 0; while (G.santiye && guard++ < 15) A.santiyeTick(G);
    check('sarkan iş yine de kurdeleye ulaşır', !G.santiye && G.inbox.some((m) => (m.t || '').includes('Kurdele')));
  }
  // C-sızıntı senaryosu: şantiye ortasında itibar vurulur, iş yine biter
  let C = null;
  for (let s = 400; s < 800 && !C; s++) { const g = fresh(s); A.upgradeFacility(g, 'scout'); A.chooseTender(g, 2); if (g.santiye?.sizintiHafta) C = g; }
  check('sızıntılı-seed bulundu', !!C);
  if (C) {
    const i0 = C.gauges.itibar;
    let guard = 0; while (C.santiye && guard++ < 10) A.santiyeTick(C);
    check('sızıntı inşaat SIRASINDA patladı (itibar −4) ama kurdele kesildi', C.gauges.itibar === Math.max(0, i0 + TUNING.TENDER.C.leakItibar) && !C.santiye);
  }
}

console.log('\n── Determinizm + akış güvenliği ──');
{
  const G = fresh();
  A.upgradeFacility(G, 'tibbi'); A.chooseTender(G, 1);
  setSeed(777); const beklenen = rand(0, 1);
  setSeed(777); A.santiyeTick(G); const sonra = rand(0, 1);
  check('santiyeTick core rng TÜKETMEZ (haftalık döngü kuralı)', beklenen === sonra);
  // hazırlık haftasında da ilerler
  const H = fresh(); H.hazirlik = 2;
  A.upgradeFacility(H, 'akademi'); A.chooseTender(H, 1);
  const k0 = H.santiye.kalan;
  A.preSeasonWeek(H);
  check('kampta da işçiler çalışır (preSeasonWeek ilerletir)', H.santiye === null ? true : H.santiye.kalan === k0 - 1);
  // eski kayıt göçü: pendingFacilities hâlâ tamamlanır (kayıt uyumluluğu)
  const E = fresh(); E.pendingFacilities = ['ticari']; const t0 = E.facilities.ticari;
  A.endSeason(E);
  check('eski kayıttaki sarkan iş sezon sonunda yine tamamlanır (göç korunur)', E.facilities.ticari === t0 + 1);
  // şantiye kayıtla birlikte yaşar
  const S = fresh(); A.upgradeFacility(S, 'scout'); A.chooseTender(S, 2);
  const raw = JSON.stringify({ ...S, data: undefined });
  const L = A.migrateLoaded(Object.assign(JSON.parse(raw), { data }));
  check('kayıt/yükleme: şantiye planı birebir korunur', L.santiye && L.santiye.tesis === 'scout' && L.santiye.kalan === S.santiye.kalan);
}

console.log('\n────────────────────────────────────────────────');
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
