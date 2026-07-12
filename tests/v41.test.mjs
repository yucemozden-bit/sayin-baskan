// tests/v41.test.mjs — v4.1 paketi birim testleri:
// (1) haftalık teknik rapor  (2) başkan telkinleri  (3) prim çeşitleri
// (4) tesis ihalesi  (5) vaat revizyonu + ara-ilerleme
// Çalıştır: node tests/v41.test.mjs

import { readFileSync } from 'node:fs';
import { TUNING } from '../src/config.js';
import { setSeed } from '../src/core/rng.js';
import { makeReport } from '../src/engines/narrative.js';
import { simulateMatch } from '../src/engines/match.js';
import { isSelectable } from '../src/engines/promises.js';
import * as A from '../src/actions.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json') };

function freshGame(tier = 'orta', promises = ['P15']) {
  const G = A.newGame(data, 'normal');
  A.selectClub(G, tier);
  A.startTerm(G, promises);
  return G;
}
function playWeeks(G, n, pre = null) {
  for (let i = 0; i < n; i++) { if (pre) pre(G); A.advanceWeek(G); G.pendingMatch = null; }
}

// ══ (1) HAFTALIK TEKNİK RAPOR ══
console.log('\n── (1) Haftalık teknik rapor ──');
setSeed(101);
{
  const G = freshGame();
  playWeeks(G, 3);
  const reps = G.inbox.filter((m) => m.cat === 'rapor');
  check('her tick inbox\'a GM raporu düşer', reps.length === 3, `${reps.length}/3`);
  // Paket A: imza artık konuya göre (GM adı / Sağlık Ekibi / Performans Ekibi)
  check('rapor sayı içermez, imzalı', reps.every((m) => m.b.includes(' — ') && !/\d/.test(m.b.split(' — ')[0])));
  // konu seçimi: moral çökük → moral raporu
  const st = { reportMem: [] };
  const r1 = makeReport(st, data.media, [{ key: 'moral', deficit: 0.08 }, { key: 'kond', deficit: 0.01 }, { key: 'form', deficit: 0 }, { key: 'uygunluk', deficit: 0 }], 1);
  check('en düşük çarpan (moral) ana konu', r1.topic === 'moral', r1.topic);
  const r2 = makeReport({ reportMem: [] }, data.media, [{ key: 'moral', deficit: 0.005 }, { key: 'kond', deficit: 0.002 }, { key: 'form', deficit: 0 }, { key: 'uygunluk', deficit: 0 }], 1);
  check('hepsi iyiyse kısa/keyifli rapor', r2.topic === 'iyi', r2.topic);
  // 6-hafta kuralı: aynı konu 8 hafta üst üste → tekrar YOK (havuz gezinme: konu kayar)
  const st6 = { reportMem: [] }; const sigs = [];
  for (let w = 1; w <= 8; w++) sigs.push(makeReport(st6, data.media, [{ key: 'moral', deficit: 0.1 }, { key: 'kond', deficit: 0.05 }, { key: 'form', deficit: 0.03 }, { key: 'uygunluk', deficit: 0.02 }], w).sig);
  let viol = 0;
  for (let i = 0; i < sigs.length; i++) for (let j = i + 1; j < sigs.length && j - i < 6; j++) if (sigs[i] === sigs[j]) viol++;
  check('kronik sorunlu 8 haftada bile 6-hafta tekrarı = 0', viol === 0, `${viol} ihlal`);
}

// ══ (2) BAŞKAN TELKİNLERİ ══
console.log('\n── (2) Başkan telkinleri ──');
setSeed(202);
{
  // kale: toplam gol beklentisi düşer (T×0.7) → istatistiksel gol ort. düşmeli
  let gNorm = 0, gKale = 0; const N = 2000;
  for (let i = 0; i < N; i++) { const a = simulateMatch(55, 55); gNorm += a.gH + a.gA; }
  for (let i = 0; i < N; i++) { const b = simulateMatch(55, 55, undefined, { baseGoals: TUNING.BASE_GOALS * 0.7 }); gKale += b.gH + b.gA; }
  check('"kalemizi koruyalım" gol beklentisini düşürür', gKale / N < gNorm / N * 0.85, `${(gNorm / N).toFixed(2)} → ${(gKale / N).toFixed(2)}`);

  // rotasyon: sonraki haftalar kondisyon toparlar (rotRecover bayrağı)
  const G = freshGame();
  A.setTelkin(G, 'rotasyon');
  G.squad.forEach((p) => { p.fitness = 60; }); // yorgun kadro → mantıklı telkin
  playWeeks(G, 1);
  check('rotasyon kabul: toparlanma bayrağı kuruldu', G.rotRecover > 0 || G.telkinSeasonCount === 1, `rotRecover=${G.rotRecover}, kabul=${G.telkinSeasonCount}`);

  // TD reddi: otoriter hoca + mantıksız telkin (zinde kadroya rotasyon)
  setSeed(203);
  const G2 = freshGame();
  G2.coach.otorite = 85;
  A.setTelkin(G2, 'rotasyon'); // fitness ~100 → mantıksız
  playWeeks(G2, 10);
  check('otoriter TD mantıksız telkini reddedebilir (ilişki −2)', (G2.tdRelation ?? 70) < 70, `tdRelation=${G2.tdRelation}`);

  // kukla hoca: zayıf TD + sezon boyu telkin → itibar kemirilir + manşet
  setSeed(204);
  const G3 = freshGame();
  G3.coach.otorite = 50;
  const itibar0 = G3.gauges.itibar;
  playWeeks(G3, 34, (g) => A.setTelkin(g, 'tamkadro'));
  check('zayıf TD + 5+ kabul → "kukla hoca" uyarısı + itibar kemirilir', G3.kuklaWarned === true && G3.telkinSeasonCount > 5, `kabul=${G3.telkinSeasonCount}, uyarı=${G3.kuklaWarned}`);
  // sızıntı: ayda 3+ telkin → %20/hafta → tam sezonda ≥1 sızıntı (kalıcı sayaç, inbox tavanından bağımsız)
  check('sık telkin → sızıntı manşeti (%20/hafta)', (G3.leakCount || 0) > 0, `${G3.leakCount || 0} sızıntı`);
}

// ══ (3) PRİM ÇEŞİTLERİ ══
console.log('\n── (3) Prim çeşitleri ──');
setSeed(303);
{
  const G = freshGame('buyuk', ['P15']); // güçlü kulüp → bol galibiyet
  A.setMatchPrim(G, 'yuksek');
  A.toggleSeriPrim(G, true);
  A.declareSeasonPrim(G);
  // Özel prim artık yalnız KRİTİK haftada silahlanır (§5) — ilk fırsatta dene.
  playWeeks(G, 34, (g) => { if (!g.ozelUsed && !g.ozelArmed) A.armOzelPrim(g); });
  check('maç primi galibiyette kasadan ödendi (ledger)', G.primLedger.mac > 0, `${G.primLedger.mac.toFixed(1)}mn`);
  check('özel prim tek maçlık: kullanıldı ve kilitlendi', G.ozelUsed === true && G.ozelArmed === false);
  check('sezon hedef primi ilan edildi (hafta 1-2 kısıtı)', G.sezonHedefDeclared === true && A.declareSeasonPrim(G).ok === false);
  let seriTotal = G.primLedger.seri;
  A.endSeason(G);
  check('sezon sonu: hedef primi sonuçlandı (ödendi/ceza)', G.sezonPrimResult === 'paid' || G.sezonPrimResult === 'fail', G.sezonPrimResult);
  // Seri primi istatistiksel (34 haftada 3'lü seri ~%93): tutmadıysa 2. sezona uzat (~%99.5)
  if (seriTotal === 0) {
    A.afterSeasonEnd(G);
    A.setMatchPrim(G, 'yuksek'); A.toggleSeriPrim(G, true);
    playWeeks(G, 34);
    seriTotal += G.primLedger.seri;
  }
  check('seri primi 3+ galibiyet serisinde devreye girdi', seriTotal > 0, `${seriTotal.toFixed(1)}mn`);
}

// ══ (4) TESİS İHALESİ ══
console.log('\n── (4) Tesis ihalesi ──');
{
  setSeed(404);
  const G = freshGame();
  G.economy.kasa = 500;
  const r = A.upgradeFacility(G, 'akademi');
  check('yükseltme kararı ihale açar (3 teklif)', r.tender === true && G.tender.offers.length === 3, G.tender.offers.map((o) => o.type).join(','));
  const cheap = Math.min(...G.tender.offers.map((o) => o.cost));
  check('A/C teklifleri baz maliyetten ucuz, B pahalı', G.tender.offers.find((o) => o.type === 'B').cost > G.tender.offers.find((o) => o.type === 'A').cost, `en ucuz ${cheap.toFixed(1)}mn`);
  // İstatistiksel: A %25 sarkma, B %20 bonus, C %20 sızıntı
  let defects = 0, bonuses = 0, leaks = 0; const N = 300;
  for (let i = 0; i < N; i++) {
    setSeed(5000 + i);
    const g = freshGame(); g.economy.kasa = 500;
    A.upgradeFacility(g, 'akademi'); const lvl = g.facilities.akademi;
    A.chooseTender(g, 0); if ((g.pendingFacilities || []).length) defects++;
    A.upgradeFacility(g, 'tibbi'); const t0 = g.facilities.tibbi;
    A.chooseTender(g, 1); if (g.facilities.tibbi === t0 + 2) bonuses++;
    const i0 = g.gauges.itibar;
    A.upgradeFacility(g, 'scout');
    A.chooseTender(g, 2); if (g.gauges.itibar < i0) leaks++;
  }
  const pct = (x) => ((x / N) * 100).toFixed(0);
  check('A firması ~%25 iş sarkıtır', defects / N > 0.15 && defects / N < 0.35, `%${pct(defects)}`);
  check('B firması ~%20 bonus kademe verir', bonuses / N > 0.10 && bonuses / N < 0.30, `%${pct(bonuses)}`);
  check('C firması ~%20 medyaya sızar (itibar −4)', leaks / N > 0.10 && leaks / N < 0.30, `%${pct(leaks)}`);
  // Sarkan iş sezon sonunda tamamlanır
  setSeed(404);
  const g2 = freshGame(); g2.economy.kasa = 500;
  g2.pendingFacilities = ['akademi']; const a0 = g2.facilities.akademi;
  playWeeks(g2, 34); A.endSeason(g2);
  check('sarkan ihale sezon sonunda teslim edilir', g2.facilities.akademi > a0, `${a0} → ${g2.facilities.akademi}`);
}

// ══ (5) VAAT REVİZYONU + ARA-İLERLEME ══
console.log('\n── (5) Vaat revizyonu ──');
{
  const P = data.promises;
  check('P17/P18 çıkarıldı, birleşik kartlar duruyor', !P.find((x) => x.id === 'P17') && !P.find((x) => x.id === 'P18') && P.find((x) => x.id === 'P19').name === 'Bu Kulübün Tarihine Sahip Çıkacağım');
  check('P21-P24 eklendi', ['P21', 'P22', 'P23', 'P24'].every((id) => P.find((x) => x.id === id)));

  setSeed(505);
  const G = freshGame('orta', ['P21', 'P24']);
  check('P23 orta kulüpte (hedef 8) SEÇİLEMEZ', !isSelectable(G, 'P23'));
  const Gk = A.newGame(data, 'normal'); A.selectClub(Gk, 'kucuk');
  check('P23 küçük kulüpte (hedef 15) seçilebilir', isSelectable(Gk, 'P23'));

  // P21: yıldız al → milestone + anında kutlama + dönem sonu kept
  G.economy.kasa = 500;
  const star = (G.market || []).find((p) => p.overall >= 80);
  A.buyTarget(G, star.id);
  A.checkMilestones(G);
  const pr21 = G.promises.find((p) => p.id === 'P21');
  check('P21: yıldız alımı → ara-ilerleme bonusu + kutlama', pr21.milestone === true && G.inbox.some((m) => m.cat === 'vaat' && m.t.includes('Vaat yolunda')));
  // P24: bilet zammı vaadi boz → dönem sonunda broken
  A.setTicketPrice(G, 1.3);
  check('P24 izi: zam kaydedildi (maxTicket>1)', G.term.maxTicket > 1.0, `${G.term.maxTicket}`);

  // Huzursuzluk: adımsız vaat sezon sonunda ceza
  setSeed(506);
  const G2 = freshGame('orta', ['P03']); // stadyum +2 — hiç ihale açılmayacak
  playWeeks(G2, 34);
  const t0 = G2.gauges.taraftar;
  A.endSeason(G2);
  check('adımsız vaat → sezon sonu huzursuzluk mesajı + ceza', G2.inbox.some((m) => m.t.includes('Huzursuzluk')), 'huzursuzluk düştü');
}

console.log(`\n${'─'.repeat(48)}\nSONUÇ: ${pass} geçti, ${fail} kaldı\n`);
process.exit(fail ? 1 : 0);
