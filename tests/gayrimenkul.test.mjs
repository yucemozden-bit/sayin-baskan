// GAYRİMENKUL OFİSİ — portföy kalıcılığı + sezon ekonomisi entegrasyon testi.
// Gerçek motoru (actions.js) sürer: init alanları, kayıt/yükleme round-trip, endSeason değerlenme/kira/endeks.
// Çalıştır: node tests/gayrimenkul.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

let gecti = 0, kaldi = 0;
const ok = (m) => { console.log('✓ ' + m); gecti++; };
const no = (m) => { console.log('✗ ' + m); kaldi++; };
const es = (a, b, m) => (a === b ? ok(`${m}  → ${a}`) : no(`${m}  → BEKLENEN ${b}, GELEN ${a}`));
const yakin = (a, b, m, tol = 0.01) => (Math.abs(a - b) <= tol ? ok(`${m}  → ${Math.round(a * 1000) / 1000}`) : no(`${m}  → BEKLENEN ~${b}, GELEN ${a}`));
function nanAv(obj, yol = 'G', d = 0, seen = new Set()) {
  if (d > 8 || obj == null || typeof obj !== 'object' || seen.has(obj)) return null;
  seen.add(obj);
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'data') continue;
    if (typeof v === 'number' && !Number.isFinite(v)) return `${yol}.${k}`;
    if (typeof v === 'object') { const r = nanAv(v, `${yol}.${k}`, d + 1, seen); if (r) return r; }
  }
  return null;
}
const kur = () => { const G = A.newGame(data, 'normal'); A.selectClub(G, 'orta'); A.startTerm(G, [data.promises[0].id], null); return G; };

console.log('── GAYRİMENKUL OFİSİ ENTEGRASYON ──');
setSeed(2718);

// 1) INIT: yeni portföy alanları kurulmuş mu?
{
  const G = kur();
  const gm = G.gayrimenkul;
  es(Array.isArray(gm.mulkler), true, 'init: mulkler dizisi var');
  es(gm.mulkler.length, 0, 'init: mulkler boş başlar');
  es(gm.arsaIndex, 1, 'init: arsaIndex 1');
  es(gm.binaIndex, 1, 'init: binaIndex 1');
}

// 2) KAYIT/YÜKLEME: mülk listesi + endeksler round-trip'ten sağ çıkıyor mu? (mülk kaybolma bug'ının özü)
{
  const G = kur();
  G.gayrimenkul = { deger: 60, kira: 0.5, adet: 2, arsaIndex: 1.2, binaIndex: 1.1, month: 8,
    mulkler: [
      { id: 'B-1', type: 'building', area: 900, landBase: 30, constrBase: 11.7, wear: 0.1, rentRate: 0.009, paid: 40, rented: true, status: 'owned', building: false },
      { id: 'C-3', type: 'land', area: 800, landBase: 24, constrBase: 0, wear: 0, rentRate: 0.009, paid: 24, rented: false, status: 'owned', building: false },
    ] };
  const raw = JSON.stringify({ ...G, data: undefined });           // autoSave ile aynı serialize
  const G2 = A.migrateLoaded(Object.assign(JSON.parse(raw), { data })); // deserialize + göç
  const gm = G2.gayrimenkul;
  es(gm.mulkler.length, 2, 'yükleme: 2 mülk korundu');
  es(gm.mulkler[0].id, 'B-1', 'yükleme: parsel ID korundu');
  es(gm.mulkler[0].rented, true, 'yükleme: kirada durumu korundu');
  es(gm.arsaIndex, 1.2, 'yükleme: piyasa endeksi korundu');
  es(gm.adet, 2, 'yükleme: adet korundu');
}

// 3) SEZON EKONOMİSİ (endSeason): kira kasaya, değerlenme + endeks aynı oranda taşınır, NaN yok.
{
  const G = kur();
  G.gayrimenkul = { deger: 100, kira: 2, adet: 2, arsaIndex: 1.2, binaIndex: 1.1, month: 8, mulkler: [] };
  const kasa0 = G.economy.kasa;
  A.endSeason(G);
  const gm = G.gayrimenkul;
  es(gm.deger, 102, 'endSeason: portföy %2 değerlendi (100→102)');
  yakin(gm.arsaIndex, 1.224, 'endSeason: arsaIndex aynı oranda taşındı (portal değeri kaybolmaz)');
  yakin(gm.binaIndex, 1.122, 'endSeason: binaIndex aynı oranda taşındı');
  es(G.economy.kasa > kasa0, true, 'endSeason: kira kasaya aktı (kasa arttı)');
  const msg = (G.inbox || []).find((m) => m.t && m.t.startsWith('Gayrimenkul:'));
  es(!!msg, true, 'endSeason: kira/vergi bildirimi geldi');
  es(nanAv(G), null, 'endSeason: NaN yok');
}

// 4) LEGACY: eski kayıt (sadece aggregate, mulkler yok) yükleme+ekonomiyi kırmıyor.
{
  const G = kur();
  G.gayrimenkul = { deger: 80, kira: 1, adet: 2 }; // feature'dan ÖNCEki şekil — mulkler/endeks yok
  const raw = JSON.stringify({ ...G, data: undefined });
  const G2 = A.migrateLoaded(Object.assign(JSON.parse(raw), { data }));
  es(G2.gayrimenkul.deger, 80, 'legacy: aggregate değer korundu');
  A.endSeason(G2);
  es(G2.gayrimenkul.deger, 82, 'legacy: endSeason değerledi (80→82), çökme yok');
  es(nanAv(G2), null, 'legacy: NaN yok');
}

// 5) İNŞAAT OYUN ZAMANIYLA: buildWeeksLeft her adımda azalır, 0'da bina olur, değer + bildirim gelir.
{
  const G = kur();
  G.inbox = [];
  G.gayrimenkul = { deger: 50, kira: 0, adet: 1, arsaIndex: 1, binaIndex: 1.1, month: 0,
    mulkler: [{ id: 'A-1', type: 'land', area: 900, landBase: 20, constrBase: 11.7, wear: 0, rentRate: 0.009, paid: 32, rented: false, status: 'owned', building: true, buildWeeksLeft: 3, buildWeeksTotal: 12 }] };
  A.gmIlerleInsaat(G); es(G.gayrimenkul.mulkler[0].buildWeeksLeft, 2, 'inşaat: 1. hafta → 2 kaldı');
  A.gmIlerleInsaat(G); es(G.gayrimenkul.mulkler[0].buildWeeksLeft, 1, 'inşaat: 2. hafta → 1 kaldı');
  es(G.gayrimenkul.mulkler[0].building, true, 'inşaat: henüz sürüyor');
  const deger0 = G.gayrimenkul.deger;
  A.gmIlerleInsaat(G); // 3. hafta → biter
  const p = G.gayrimenkul.mulkler[0];
  es(p.building, false, 'inşaat: 3. hafta → tamamlandı (building false)');
  es(p.type, 'building', 'inşaat: parsel artık BİNA');
  es(G.gayrimenkul.deger > deger0, true, 'inşaat: biten bina portföy değerini artırdı');
  es(!!(G.inbox || []).find((m) => m.t && m.t.includes('inşaatı tamamlandı')), true, 'inşaat: tamamlanma bildirimi geldi');
}

// 6) İNŞAAT restore round-trip: buildWeeksLeft kayıt/yüklemeden sağ çıkar (ofis tekrar açılınca kaldığı yerden).
{
  const G = kur();
  G.gayrimenkul = { deger: 40, kira: 0, adet: 1, arsaIndex: 1, binaIndex: 1, month: 0,
    mulkler: [{ id: 'A-1', type: 'land', area: 900, landBase: 20, constrBase: 11.7, wear: 0, rentRate: 0.009, paid: 32, rented: false, status: 'owned', building: true, buildWeeksLeft: 7, buildWeeksTotal: 12 }] };
  const raw = JSON.stringify({ ...G, data: undefined });
  const G2 = A.migrateLoaded(Object.assign(JSON.parse(raw), { data }));
  const p = G2.gayrimenkul.mulkler[0];
  es(p.building, true, 'inşaat yükleme: hâlâ inşaatta');
  es(p.buildWeeksLeft, 7, 'inşaat yükleme: kalan hafta korundu');
}

// 7) UÇTAN UCA: gerçek hafta akışı (beginWeek→finishWeek) inşaatı ilerletip tamamlıyor mu?
{
  setSeed(2718);
  const G = kur();
  G.gayrimenkul.mulkler = [{ id: 'A-1', type: 'land', area: 900, landBase: 20, constrBase: 11.7, wear: 0, rentRate: 0.009, paid: 32, rented: false, status: 'owned', building: true, buildWeeksLeft: 2, buildWeeksTotal: 12 }];
  G.gayrimenkul.deger = 40; G.gayrimenkul.adet = 1;
  const playWeek = (G) => {
    A.beginWeek(G);
    let g = 0; while (G.phone && g++ < 8) { try { A.answerPhone(G, 0); } catch { break; } }
    if (G.pendingMatch && G.pendingMatch.phase === 'pre') {
      A.htDecision(G, 'soyunma');
      const r = A.finishWeek(G);
      if (r && r.waitLate) A.lateDecision(G, 'devam');
    }
  };
  let oynanan = 0;
  for (let i = 0; i < 14 && G.gayrimenkul.mulkler[0].building; i++) { const w0 = G.meta.week; playWeek(G); if (G.meta.week !== w0) oynanan++; }
  const p = G.gayrimenkul.mulkler[0];
  es(oynanan >= 2, true, `finishWeek: gerçek akışta en az 2 hafta oynandı → ${oynanan}`);
  es(p.building, false, 'finishWeek: inşaat gerçek hafta akışında tamamlandı');
  es(p.type, 'building', 'finishWeek: parsel bina oldu');
}

console.log('\n────────────────────────────────────────────────');
console.log(`SONUÇ: ${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
