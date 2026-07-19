// tests/delege.test.mjs — KONGRE 2.6 bataryası: DELEGE BLOKLARI + ULTRAS.
// Kritik değişmezler: (1) blok ağırlık matrisi pay-ağırlıklı toplamda ELECT_W'ye BİREBİR eşit
// → nötr ilişkide (50) sandık bit-bit eski formül; (2) ultras/delege tick core rng TÜKETMEZ;
// (3) ihmal yolu (talep yok sayma → protesto) gauge/blok/sandığa DOKUNMAZ — yalnız olay üretir.
// Çalıştır: node tests/delege.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed, rand } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import { TUNING } from '../src/config.js';
import { eleksiyon, oyOrani, delegeEtki, blokOylari } from '../src/engines/election.js';
import * as congress from '../src/ui/congress.js';
import * as eNight from '../src/ui/electionNight.js';
import { itemActions } from '../src/ui/inbox.js';

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
// Seçim hesabı için 3 sezonluk sahte karne
function karneli(G) {
  G.history.seasons = [
    { pos: 8, champion: false, cup: false }, { pos: 6, champion: false, cup: false }, { pos: 5, champion: false, cup: true },
  ];
  return G;
}

console.log('\n── MOTOR DEĞİŞMEZİ: blok matrisi = ELECT_W (nötrlük matematiksel garanti) ──');
{
  const D = TUNING.DELEGE, W = TUNING.ELECT_W;
  let paySum = 0; const toplam = { sportif: 0, taraftar: 0, mali: 0, itibar: 0, soz: 0 };
  let satirOk = true;
  for (const B of Object.values(D.BLOK)) {
    paySum += B.pay;
    let s = 0;
    for (const k of Object.keys(toplam)) { toplam[k] += B.pay * B.W[k]; s += B.W[k]; }
    if (Math.abs(s - 1) > 1e-12) satirOk = false;
  }
  check('delege payları toplamı 1', Math.abs(paySum - 1) < 1e-12);
  check('her blokun W satırı toplamı 1', satirOk);
  const esit = Object.keys(toplam).every((k) => Math.abs(toplam[k] - W[k]) < 1e-12);
  check('Σ pay×W[k] = ELECT_W[k] (BİREBİR — W değişirse bu test kırılmalı)', esit,
    Object.keys(toplam).map((k) => `${k}:${toplam[k].toFixed(3)}`).join(' '));
  check('delegeEtki nötr 50 → TAM 0 (bit-bit)', delegeEtki({ bloklar: { eski: 50, is: 50, tribun: 50, taban: 50 } }) === 0);
}

console.log('\n── SEÇİM ENTEGRASYONU: nötrde bit-bit eşit, ilişki oynayınca sapar ──');
{
  const G = karneli(fresh());
  const r1 = eleksiyon(G, { baslangicBorc: G.termStartBorc });
  const del = G.delege; delete G.delege;
  const r0 = eleksiyon(G, { baslangicBorc: G.termStartBorc });
  G.delege = del;
  check('nötr delege ile oy === delegesiz oy (BİT-BİT)', r1.oyOrani === r0.oyOrani, `${r1.oyOrani} vs ${r0.oyOrani}`);
  check('breakdown blokları taşıyor (4 blok + dEtki)', r1.breakdown.bloklar && Object.keys(r1.breakdown.bloklar).length === 4 && r1.breakdown.dEtki === 0);

  // toplama kimliği: Σ pay×blokOy = genel_raw + dEtki (klamplar devrede değilken)
  G.delege.bloklar = { eski: 60, is: 40, tribun: 70, taban: 50 };
  const r2 = eleksiyon(G, { baslangicBorc: G.termStartBorc });
  const b = r2.breakdown;
  const genel = oyOrani({ sportif: b.sportif, taraftar: b.taraftar, mali: b.mali, itibar: b.itibar, soz: b.soz, rival: b.rival }) * 100;
  const payToplam = Object.entries(TUNING.DELEGE.BLOK).reduce((s, [k, B]) => s + B.pay * b.bloklar[k].oy, 0);
  check('Σ pay×blokOy = genel + dEtki (±1e-9)', Math.abs(payToplam - (genel + b.dEtki)) < 1e-9, `${payToplam.toFixed(6)} vs ${(genel + b.dEtki).toFixed(6)}`);
  check('dEtki beklenen: (10−10+20+0)/4×0.2 = +1.0', Math.abs(b.dEtki - 1.0) < 1e-12);
  check('sıcak blok oyu soğuktan yüksek (tribun > is)', b.bloklar.tribun.oy > b.bloklar.is.oy);
  check('oy nötrden yüksek (dEtki sandığa bindi)', r2.oyOrani > r1.oyOrani);
}

console.log('\n── DETERMİNİZM: tick core rng tüketmez + çift koşum bit-bit ──');
{
  const G = fresh();
  setSeed(555); const beklenen = rand(0, 1);
  setSeed(555); A.ultrasTick(G); A.iliskiTick(G); const sonra = rand(0, 1);
  check('ultrasTick + iliskiTick core rng TÜKETMEZ', beklenen === sonra);

  const tur = (seed) => {
    const g = fresh(seed);
    for (let w = 1; w <= 30; w++) { g.meta.week = w; g.globalWeek = w; A.ultrasTick(g); }
    return JSON.stringify({ f: g.fanGroups, d: g.delege, i: g.inbox.map((m) => m.t) });
  };
  check('aynı seed çift koşum → fanGroups+delege+inbox BİT-BİT aynı', tur(42) === tur(42));
}

console.log('\n── ULTRAS AKIŞI: talep → karşıla/reddet/protesto ──');
// hash taraması: talep doğana kadar hafta ilerlet (rand YOK — determinist)
function talepBekle(G, maxSezon = 6) {
  for (let s = G.meta.season; s <= maxSezon; s++) {
    G.meta.season = s;
    for (let w = 1; w <= 34; w++) {
      G.meta.week = w; G.globalWeek++;
      A.ultrasTick(G);
      const g = (G.fanGroups || []).find((x) => x.talep);
      if (g) return g;
    }
  }
  return null;
}
{
  const G = fresh();
  G.globalWeek = 0;
  const g = talepBekle(G);
  check('hash takvimi talep üretiyor (6 sezon içinde)', !!g, g ? `${g.name}: ${g.talep.tip} (s${G.meta.season} h${G.meta.week})` : 'YOK');
  if (g) {
    const m = G.inbox.find((x) => x.action === 'ultras' && x.grup === g.name && !x.resolved);
    check('talep mektubu inbox\'ta (action:ultras + grup adı)', !!m);
    check('inbox butonları: KARŞILA + maliyet + REDDET', !!m && itemActions(G, m).includes('KARŞILA') && itemActions(G, m).includes('REDDET'));
    // KABUL yolu
    const maliyet = TUNING.ULTRAS.TALEPLER[g.talep.tip].maliyet;
    const kasa0 = G.economy.kasa, il0 = g.iliski, tar0 = G.gauges.taraftar, blok0 = G.delege.bloklar.tribun;
    const koreo = g.talep.tip === 'koreografi';
    check('kabul işledi', A.resolveUltras(G, m.id, 'kabul') === true && m.resolved === true);
    check('kabul: kasa −maliyet · iliski +8 · taraftar +1 · tribün bloku +2',
      Math.abs(G.economy.kasa - (kasa0 - maliyet)) < 1e-9 && g.iliski === Math.min(100, il0 + 8)
      && G.gauges.taraftar === Math.min(100, tar0 + 1) && G.delege.bloklar.tribun === Math.min(100, blok0 + 2));
    check('koreografi talebiyse duvar kuruldu (değilse bayrak temiz)', koreo ? G.koreoPending === true : true);
    check('talep kapandı + cooldown yazıldı', g.talep === null && g.talepCd > G.globalWeek);
  }
}
{
  // PROTESTO yolu (ihmal): süre dolar → manşet var; gauge + delege + core akış DOKUNULMAMIŞ
  const G = fresh(77);
  G.globalWeek = 0;
  const g = talepBekle(G);
  if (!g) { check('protesto senaryosu için talep bulunamadı', false); }
  else {
    const gaugeFoto = JSON.stringify(G.gauges), delegeFoto = JSON.stringify(G.delege), il0 = g.iliski;
    // cevap verme — süreyi doldur
    for (let i = 0; i <= TUNING.ULTRAS.SURE + 1 && g.talep; i++) {
      G.globalWeek++; G.meta.week = Math.min(34, G.meta.week + 1);
      A.ultrasTick(G);
    }
    check('(ihmal) süre dolunca talep düştü + protesto manşeti', g.talep === null && G.inbox.some((x) => (x.t || '').includes('pankart açtı')));
    check('(ihmal) iliski −10 (grup kırgın)', g.iliski === Math.max(0, il0 + TUNING.ULTRAS.PROTESTO.iliski));
    check('(ihmal) gauge FOTO AYNI — sessiz ceza yok', JSON.stringify(G.gauges) === gaugeFoto);
    check('(ihmal) delege blokları FOTO AYNI — ihmal sandığa işlemez', JSON.stringify(G.delege) === delegeFoto);
    check('(ihmal) duvar bayrağı temiz (koreoPending yok)', !G.koreoPending);
  }
}
{
  // RED yolu (bilinçli): iliski −6 + tribün bloku −2
  const G = fresh(1234);
  G.globalWeek = 0;
  const g = talepBekle(G);
  if (!g) { check('red senaryosu için talep bulunamadı', false); }
  else {
    const m = G.inbox.find((x) => x.action === 'ultras' && x.grup === g.name && !x.resolved);
    const il0 = g.iliski, blok0 = G.delege.bloklar.tribun;
    check('red işledi', A.resolveUltras(G, m.id, 'red') === true && m.resolved === true);
    check('red: iliski −6 · tribün bloku −2 (bilinçli seçim sandığa işler)',
      g.iliski === Math.max(0, il0 - 6) && G.delege.bloklar.tribun === Math.max(0, blok0 - 2));
  }
}
{
  // KASA YETMEZKEN kabul: buton KİLİTLİ + uyarı TEK sefer (spam bug'ı — kullanıcı raporu 2026-07-21)
  const G = fresh(31);
  G.globalWeek = 0;
  const g = talepBekle(G);
  if (!g) { check('kasa-yok senaryosu için talep bulunamadı', false); }
  else {
    G.economy.kasa = 0;
    const m = G.inbox.find((x) => x.action === 'ultras' && x.grup === g.name && !x.resolved);
    const html = itemActions(G, m);
    check('kasa yetmiyor → KARŞILA butonu kilitli (disabled + 🔒)', html.includes('disabled') && html.includes('🔒'));
    check('kabul iki kez denense de reddedilir', A.resolveUltras(G, m.id, 'kabul') === false && A.resolveUltras(G, m.id, 'kabul') === false);
    const uyari = G.inbox.filter((x) => (x.t || '').includes('Kasa bu jesti kaldırmıyor')).length;
    check('uyarı mektubu TEK (spam yok)', uyari === 1, `${uyari} adet`);
    check('talep hâlâ açık + dosya çözülmedi (kasa dolunca karşılanır)', !!g.talep && !m.resolved);
    G.economy.kasa = 50;
    check('kasa dolunca kabul işler', A.resolveUltras(G, m.id, 'kabul') === true);
  }
}
{
  // DUVAR GECESİ fırsat kanalı: iliski ≥70 → sezonda 1 bedava koreografi
  const G = fresh(9);
  G.globalWeek = 0;
  for (const g of G.fanGroups) { g.iliski = 85; g.talepCd = 9999; } // talep kanalını kapat, fırsatı aç
  let duvar = false;
  for (let s = 1; s <= 3 && !duvar; s++) {
    G.meta.season = s;
    for (let w = 1; w <= 34 && !duvar; w++) { G.meta.week = w; G.globalWeek++; A.ultrasTick(G); duvar = !!G.koreoPending; }
  }
  check('iliski ≥70 → duvar gecesi geldi (bedava koreografi + manşet)', duvar && G.inbox.some((x) => (x.t || '').includes('duvar örüyor')));
}

console.log('\n── DELEGE YEMEĞİ + KANCALAR ──');
{
  const G = fresh();
  check('dönem başı sofra hakkı dolu', G.delege.yemekHak === TUNING.DELEGE.YEMEK.hak);
  const kasa0 = G.economy.kasa;
  A.delegeYemek(G, 'eski'); A.delegeYemek(G, 'eski'); A.delegeYemek(G, 'is');
  check('3 sofra: kasa −3×maliyet, bloklar ısındı', Math.abs(G.economy.kasa - (kasa0 - 3 * TUNING.DELEGE.YEMEK.maliyet)) < 1e-9
    && G.delege.bloklar.eski === 50 + 2 * TUNING.DELEGE.YEMEK.artis && G.delege.bloklar.is === 50 + TUNING.DELEGE.YEMEK.artis);
  check('hak bitti → 4. sofra reddedilir', G.delege.yemekHak === 0 && A.delegeYemek(G, 'taban') === false);
  check('bilinmeyen blok reddedilir', A.delegeYemek(G, 'yok-boyle-blok') === false);

  // bilet kararı kancası (bilinçli, MUTLAK eşik — "zamla sonra indir" manipülasyonuna kapalı)
  const G2 = fresh();
  G2.inbox.unshift({ id: 'tst1', action: 'ticket' });
  A.resolveTicket(G2, 'tst1', 0.8);
  check('ucuz bilet (≤1.0) → tribün bloku +2', G2.delege.bloklar.tribun === 52);
  G2.inbox.unshift({ id: 'tst2', action: 'ticket' });
  A.resolveTicket(G2, 'tst2', 1.2);
  check('pahalı bilet (≥1.2) → tribün bloku −2 (geri 50)', G2.delege.bloklar.tribun === 50);
  G2.economy.ticketPrice = 1.3; // önce zamla…
  G2.inbox.unshift({ id: 'tst3', action: 'ticket' });
  A.resolveTicket(G2, 'tst3', 1.2); // …sonra "indir": hâlâ pahalı → ısıtmaz, SOĞUTUR
  check('manipülasyon kapalı: 1.3→1.2 "indirimi" yine −2', G2.delege.bloklar.tribun === 48);

  // sosyal proje kancası: taban +1
  const G3 = fresh();
  G3.economy.kasa = 50;
  A.sosyalProje(G3);
  check('sosyal proje → Üye Tabanı +1', G3.delege.bloklar.taban === 51);
}

console.log('\n── GÖÇ (eski kayıt) + UI DUMANI ──');
{
  const G = fresh();
  delete G.delege;
  for (const g of G.fanGroups) { delete g.iliski; delete g.talep; delete g.talepCd; delete g.duvarSezon; }
  A.migrateLoaded(G);
  check('göç: delege nötr kuruldu + ultras alanları tamam', G.delege && G.delege.bloklar.eski === 50
    && G.fanGroups.every((g) => g.iliski === 50 && g.talep === null));

  // kongre ekranı: projeksiyonlu + projeksiyonsuz render, NaN/undefined sızıntısı yok
  const G2 = karneli(fresh());
  G2.lastProj = eleksiyon(G2, { baslangicBorc: G2.termStartBorc });
  G2.myPos = 6;
  const html = congress.render(G2);
  check('kongre ekranı: Delege Blokları + Tribünler kartları var', html.includes('Delege Blokları') && html.includes('Tribünler'));
  check('kongre ekranı: NaN/undefined sızıntısı yok', !/NaN|undefined/.test(html));
  G2.lastProj = null;
  check('projeksiyonsuz kongre de temiz (boş durum)', !/NaN|undefined/.test(congress.render(G2)));

  // seçim gecesi: blok açılımı kartı (done aşamasında) + eski kayıt sonucu (bloksuz) çökmez
  const r = eleksiyon(G2, { baslangicBorc: G2.termStartBorc });
  G2.election = { ...r, revealed: true, revealStep: 7, done: true, counting: false, displayVote: Math.round(r.oyOrani * 100), kept: [], rivalSpeech: 'test' };
  const nHtml = eNight.render(G2);
  check('seçim gecesi: Sandık Açılımı blokları basılıyor', nHtml.includes('Sandık Açılımı') && nHtml.includes('Eski Tüfekler'));
  check('seçim gecesi: NaN/undefined yok', !/NaN|undefined/.test(nHtml));
  const eskiSonuc = { ...G2.election }; delete eskiSonuc.breakdown.bloklar; // eski kayıtta saklanmış sonuç
  G2.election = eskiSonuc;
  const nHtml2 = eNight.render(G2);
  check('eski (bloksuz) seçim sonucu çökmez, açılım kartı sessizce yok', !nHtml2.includes('Sandık Açılımı'));
}

console.log(`\nSONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
