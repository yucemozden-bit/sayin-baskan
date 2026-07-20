// tests/kaos.test.mjs — KAOS FUZZER (2026-07-22 "devasa test"): UI dispatch yüzeyindeki
// aksiyonları TUHAF girdilerle çağırır — hayalet id, çift tıklama, kapalı pencere, boş kasa,
// saçma argüman. Beklenti: HİÇBİRİ fırlatmaz (görünür ret / sessiz yok-sayma), G'ye NaN
// sızmaz, gauge'lar bantta kalır, borç negatife düşmez.
// Çalıştır: node tests/kaos.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

function nanAv(obj, yol = 'G', d = 0, seen = new Set()) {
  if (d > 7 || obj == null || typeof obj !== 'object' || seen.has(obj)) return null;
  seen.add(obj);
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'data') continue;
    if (typeof v === 'number' && !Number.isFinite(v)) return `${yol}.${k}`;
    if (typeof v === 'object') { const r = nanAv(v, `${yol}.${k}`, d + 1, seen); if (r) return r; }
  }
  return null;
}

function fresh(seed = 42) {
  setSeed(seed);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  return G;
}

// Her kaos vakası: çağrı fırlatmamalı + G sağlıklı kalmalı
function kaos(ad, G, fn) {
  let err = null;
  try { fn(G); } catch (e) { err = e; }
  const n = err ? null : nanAv(G);
  const gaugeBozuk = err ? null : Object.entries(G.gauges).find(([, v]) => !Number.isFinite(v) || v < 0 || v > 100);
  const ekoBozuk = !err && (!Number.isFinite(G.economy.kasa) || !Number.isFinite(G.economy.borc) || G.economy.borc < 0);
  check(`kaos: ${ad}`, !err && !n && !gaugeBozuk && !ekoBozuk,
    err ? String(err.message || err).slice(0, 90) : n ? `NaN ${n}` : gaugeBozuk ? `gauge ${gaugeBozuk[0]}=${gaugeBozuk[1]}` : ekoBozuk ? `eko kasa=${G.economy.kasa} borç=${G.economy.borc}` : '');
}

console.log('\n── HAYALET KİMLİKLER (olmayan id ile her aksiyon) ──');
{
  const G = fresh();
  kaos('sorgula hayalet id', G, (g) => A.sorgulaPlayer(g, 'hayalet-99'));
  kaos('derin rapor hayalet id', G, (g) => A.derinRapor(g, 'hayalet-99'));
  kaos('teklif iste hayalet id', G, (g) => A.requestOffer(g, 'hayalet-99'));
  kaos('vitrin hayalet id', G, (g) => A.vitrinToggle(g, 'hayalet-99'));
  kaos('kiralık liste hayalet id', G, (g) => A.toggleKiralikListe(g, 'hayalet-99'));
  kaos('sözleşme yenile hayalet id', G, (g) => A.renewContract(g, 'hayalet-99'));
  kaos('jest hayalet id', G, (g) => A.playerJest(g, 'hayalet-99'));
  kaos('söz undefined id', G, (g) => A.playerSoz(g, undefined));
  kaos('kaptan öner hayalet', G, (g) => A.proposeCaptain(g, 'hayalet-99'));
  kaos('satış dosyası hayalet mesaj', G, (g) => A.resolveSaleFile(g, 'yok-msg', 'sat'));
  kaos('transfer dosyası hayalet mesaj', G, (g) => A.resolveTransferFile(g, 'yok-msg', 'onay'));
  kaos('TD kriz hayalet mesaj', G, (g) => A.resolveTdKriz(g, 'yok-msg', 'kov'));
  kaos('ultras hayalet mesaj', G, (g) => A.resolveUltras(g, 'yok-msg', 'karsila'));
  kaos('banka kredisi hayalet mesaj', G, (g) => A.resolveBankLoan(g, 'yok-msg', 'kabul'));
  kaos('bilet hayalet mesaj', G, (g) => A.resolveTicket(g, 'yok-msg', 1.0));
  kaos('staff dosyası hayalet mesaj', G, (g) => A.hireStaffFile(g, 'yok-msg', 0));
  kaos('TD dosyası hayalet mesaj', G, (g) => A.hireCoachFile(g, 'yok-msg', 0));
  kaos('event hayalet mesaj', G, (g) => A.resolveEvent(g, 'yok-msg', 0));
  kaos('agenda hayalet mesaj', G, (g) => A.resolveAgenda(g, 'yok-msg', 'vizyon'));
}

console.log('\n── SAÇMA ARGÜMANLAR ──');
{
  const G = fresh(7);
  kaos('borç öde negatif', G, (g) => A.payDebtAmount(g, -50));
  kaos('borç öde aşırı (kasadan büyük)', G, (g) => A.payDebtAmount(g, 99999));
  kaos('tesis bilinmeyen', G, (g) => A.upgradeFacility(g, 'uzayUssu'));
  kaos('telkin saçma', G, (g) => A.setTelkin(g, 'isinlama'));
  kaos('prim saçma', G, (g) => A.setMatchPrim(g, 'cilgin'));
  kaos('demeç saçma ton', G, (g) => A.makeDemec(g, 'anarsist'));
  kaos('bilet fiyatı NaN', G, (g) => A.setTicketPrice(g, NaN));
  kaos('bilet fiyatı negatif', G, (g) => A.setTicketPrice(g, -3));
  kaos('özel varlık bilinmeyen', G, (g) => A.ozelVarlik(g, 'zeplin'));
  kaos('özel davet bilinmeyen', G, (g) => A.ozelDavet(g, 'ayYuruyusu'));
  kaos('özel bağış aşırı', G, (g) => A.ozelBagis(g, 99999));
  kaos('özel karar saçma index', G, (g) => A.ozelKarar(g, 42));
  kaos('sponsor bilinmeyen slot', G, (g) => A.signSponsor(g, 'sirtDovmesi', 'yok-1'));
  kaos('sponsor hayalet teklif', G, (g) => A.signSponsor(g, 'gogus', 'yok-1'));
  kaos('ilan saçma pozisyon', G, (g) => A.ilanVer(g, { pos: 'LIBERO', yasMax: 99, tavan: -5 }));
  kaos('vizyon saçma', G, (g) => A.chooseVision(g, 'kaos'));
}

console.log('\n── ÇİFT TIKLAMA (aynı karar iki kez) ──');
{
  const G = fresh(11);
  // gerçek bir tfile üret: GM'e teklif isteği
  const aday = (G.market || [])[0];
  if (aday) A.requestOffer(G, aday.id);
  const tf = G.inbox.find((m) => m.action === 'tfile' && !m.resolved);
  if (tf) {
    kaos('tfile onay 1. tık', G, (g) => A.resolveTransferFile(g, tf.id, 'red'));
    kaos('tfile onay 2. tık (çift)', G, (g) => A.resolveTransferFile(g, tf.id, 'onay'));
  } else check('kaos: tfile üretimi (ön koşul)', true, 'dosya gelmedi — atlandı');
  kaos('TD kov 1. kez', G, (g) => A.fireCoach(g));
  kaos('TD kov 2. kez (vekil varken)', G, (g) => A.fireCoach(g));
  kaos('TD pazarı kasasız', G, (g) => { g.economy.kasa = 0.2; A.tdPazar(g); });
  kaos('TD pazarı 2. kez aynı sezon', G, (g) => { g.economy.kasa = 50; A.tdPazar(g); A.tdPazar(g); });
  kaos('yeniden yapılandırma çift çağrı', G, (g) => { A.restructureDebt(g); A.restructureDebt(g); });
  kaos('kredi çift çağrı', G, (g) => { A.takeLoan(g, 20); A.takeLoan(g, 20); });
}

console.log('\n── YANLIŞ FAZ / KAPALI PENCERE ──');
{
  const G = fresh(13);
  kaos('telefon yokken cevap', G, (g) => { g.phone = null; A.answerPhone(g, 0); });
  kaos('telefon yokken ertele', G, (g) => A.deferPhone(g));
  kaos('maç yokken devre arası kararı', G, (g) => { g.pendingMatch = null; A.htDecision(g, 'tdguven'); });
  kaos('maç yokken geç karar', G, (g) => A.lateDecision(g, 'dok'));
  kaos('maç yokken finishWeek', G, (g) => A.finishWeek(g));
  kaos('pencere kapalıyken ilan', G, (g) => { g.transferWindow = false; A.ilanVer(g, { pos: 'FWD', yasMax: 30, tavan: 20 }); });
  kaos('pencere kapalıyken teklif', G, (g) => { const m = (g.market || [])[1]; if (m) A.requestOffer(g, m.id); });
  kaos('kampanya fazı dışında campaignDo', G, (g) => A.campaignDo(g, 'taraftarMitingi'));
  kaos('münazara fazı dışında answerDebate', G, (g) => A.answerDebate(g, 'vizyon'));
  kaos('muhalefet yokken oppositionNext', G, (g) => A.oppositionNext(g));
  kaos('muhalefet yokken startComeback', G, (g) => A.startComeback(g));
  kaos('masa kartı yokken deskAction', G, (g) => { g.deskCard = null; A.deskAction(g); });
}

console.log('\n── UÇ EKONOMİ DURUMLARI ──');
{
  const G = fresh(17);
  kaos('kasa 0 + tüm tesisler yükseltme denemesi', G, (g) => { g.economy.kasa = 0; for (const f of ['antrenman', 'akademi', 'tibbi', 'scout', 'stadyum', 'ticari']) A.upgradeFacility(g, f); });
  kaos('borç 0 iken borç öde', G, (g) => { g.economy.borc = 0; A.payDebtAmount(g, 10); });
  kaos('dev borçla hafta ilerlet', G, (g) => { g.economy.borc = 400; A.advanceWeek(g); g.pendingMatch = null; });
  kaos('kasa uçta (0.01) hafta ilerlet', G, (g) => { g.economy.kasa = 0.01; A.advanceWeek(g); g.pendingMatch = null; });
}

console.log('\n── BOZUK KAYIT YÜKLEME (migrateLoaded zırhı) ──');
{
  const temiz = fresh(19);
  const raw = JSON.parse(JSON.stringify({ ...temiz, data: undefined }));
  for (const eksik of ['ozel', 'market', 'coach', 'staff', 'defter', 'museum', 'bkRel', 'derbi', 'sponsorPazari', 'delege', 'ultras']) {
    const kopya = JSON.parse(JSON.stringify(raw));
    delete kopya[eksik];
    kaos(`kayıtta '${eksik}' alanı yok → yükle + hafta oynat`, temiz, () => {
      const g2 = A.migrateLoaded(Object.assign(kopya, { data }));
      A.advanceWeek(g2); g2.pendingMatch = null;
      const n = nanAv(g2); if (n) throw new Error('yükleme sonrası NaN: ' + n);
    });
  }
}

console.log('\n── SEZON SONU KADRO TAVANI (görünür fesih — 2026-07-22 bug kilidi) ──');
{
  // Kullanıcı raporu: "sözleşmesi süren oyuncularım yeni sezonda sessizce yok oldu" —
  // kadro 30 tavanı mektupsuz kesiyordu ve ocak gençleri ilk kurbandı.
  const { Player } = await import('../src/models/player.js');
  const G = fresh(23);
  while ((G.hazirlik || 0) > 0) A.preSeasonWeek(G);
  while (G.squad.length < 33) {
    const p = new Player({ id: 'kts' + G.squad.length, name: 'Dolgu Oyuncu ' + G.squad.length, pos: 'MID', overall: 44, potential: 50, age: 20, contractYears: 2 });
    G.squad.push(p);
  }
  const ocak = G.squad.find((p) => p.age <= 23) || G.squad[G.squad.length - 1];
  ocak.ocak = true; ocak.age = Math.min(ocak.age, 21); ocak.overall = 40; // en zayıf ocak genci — eski kod ilk onu keserdi
  const kaptan = G.squad.find((p) => p.id === G.captainId);
  while (G.meta.week < G.SEASON_WEEKS && G.phase === 'SEASON_LOOP') { A.advanceWeek(G); G.pendingMatch = null; }
  A.endSeason(G);
  check('kadro tavanı: sezon sonu ≤30', G.squad.length <= 30, `${G.squad.length} oyuncu`);
  check('kesinti MEKTUPLA bildirildi (isim isim)', G.inbox.some((m) => (m.t || '').includes('kadro düzenlemesi') && (m.b || '').includes('serbest bırakıldı')));
  check('ocak genci KORUNDU (en zayıf olsa da)', G.squad.some((p) => p.id === ocak.id), ocak.name);
  check('kaptan korundu', !kaptan || G.squad.some((p) => p.id === kaptan.id));
}

console.log('\n── TESİS YIPRANMASI (2026-07-22 kural kilidi: 3 sezon ihmal → −1 seviye, stadyum muaf) ──');
{
  const G = fresh(31);
  while ((G.hazirlik || 0) > 0) A.preSeasonWeek(G);
  G.facilities.akademi = 4; G.facilities.stadyum = 5; G.facilities.tibbi = 0;
  const ws = G.worldSeason ?? 1;
  G.tesisBakim = { antrenman: ws, tibbi: ws - 5, akademi: ws - 3, scout: ws, ticari: ws - 3 };
  G.facilities.ticari = 0; // sv0 → yıpranacak şeyi yok
  const stad0 = G.facilities.stadyum, ant0 = G.facilities.antrenman;
  while (G.meta.week < G.SEASON_WEEKS && G.phase === 'SEASON_LOOP') { A.advanceWeek(G); G.pendingMatch = null; }
  A.endSeason(G);
  check('3 sezon ihmal → akademi 1 seviye düştü', G.facilities.akademi === 3, `akademi ${G.facilities.akademi}`);
  check('düşüş MEKTUPLA bildirildi', G.inbox.some((m) => (m.t || '').includes('Tesis yıpranması')));
  check('stadyum MUAF (hiç düşmez)', G.facilities.stadyum === stad0);
  check('bakımlı tesis düşmez (antrenman sayacı taze)', G.facilities.antrenman === ant0);
  check('sv0 tesis negatife inmez', G.facilities.ticari === 0 && G.facilities.tibbi === 0, `ticari ${G.facilities.ticari} tibbi ${G.facilities.tibbi}`);
  check('düşen tesisin sayacı sıfırlandı (art arda her sezon düşmez)', G.tesisBakim.akademi === (G.worldSeason ?? 1));
}

console.log('\n── STADYUM KONFORU (2026-07-22 kural kilidi: seviye doluluğu yazar, kapasite MEGA işi) ──');
{
  const { bilet } = await import('../src/engines/economy.js');
  const G = fresh(37);
  G.economy.ticketPrice = 2; // pahalı bilet → doluluk tavandan (1.0) uzak; konfor farkı tam ölçülür
  G.facilities.stadyum = 0;
  const kohne = bilet(G).doluluk;
  G.facilities.stadyum = 10;
  const modern = bilet(G).doluluk;
  const fark = modern - kohne;
  check('konfor: sv0 → sv10 doluluk farkı ~12 puan', fark > 0.10 && fark < 0.14, `%${(fark * 100).toFixed(1)}`);
  // KAPASİTE TABLOSU (2026-07-22 kullanıcı çıpaları: sv2 9.000 · sv4 18.000 · sv7 35.000 · sv10 80.000)
  const { stadKapasite } = await import('../src/engines/facilities.js');
  const cipa = { 2: 9000, 4: 18000, 7: 35000, 10: 80000 };
  for (const [sv, hedef] of Object.entries(cipa)) {
    G.facilities.stadyum = +sv;
    check(`kapasite sv${sv} = ${hedef.toLocaleString('tr-TR')} (kullanıcı çıpası)`, stadKapasite(G) === hedef, `${stadKapasite(G)}`);
  }
  const dizi = Array.from({ length: 11 }, (_, sv) => { G.facilities.stadyum = sv; return stadKapasite(G); });
  check('kapasite 11 seviyede tekdüze büyür', dizi.every((v, i) => i === 0 || v > dizi[i - 1]), dizi.join('→'));
  G.facilities.stadyum = 10;
  G.megaStad = true;
  check('MEGA kompleks: sv10 × 1.2 = 96.000', stadKapasite(G) === 96000, `${stadKapasite(G)}`);
  G.megaStad = false;
}

console.log('\n────────────────────────────────────────────────');
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
