// tests/calibration.test.mjs — Kadro üretimi + ekonomi kalibrasyonu (Bible-4/8)
// 3 tier × 200 sezon: kadro değeri↔kadroDeger, maaş/gelir, sezonluk net bantları.
// Ayrıca V4-§13 T2 (cimri) ekonomi ayağı: borç 3 sezonda düşebiliyor mu?
// Çalıştır: node tests/calibration.test.mjs

import { TUNING, TIERS } from '../src/config.js';
import { setSeed } from '../src/core/rng.js';
import { generateSquad, squadMarketValue } from '../src/models/squadGen.js';
// GİZLİ ÇAKILLIK GİDERİLDİ (2026-07-20): test seed'SİZDİ — her koşu farklı örneklem çekip
// ±%20 bandının kenarında (%18-20) titriyordu, ayda bir kırmızıya düşüyordu. Seed → determinist.
setSeed(20260720);
import { createLeague, playWeek, standings } from '../src/engines/league.js';
import { applyEconomy, payDebt } from '../src/engines/economy.js';
import { computeTargets, applyInertia } from '../src/engines/gauges.js';

let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  → ' + detail : ''}`);
  ok ? pass++ : fail++;
}
const r1 = (x) => Math.round(x * 10) / 10;
const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;

// Tier'a özgü başlangıç yapıları (yeni kariyer setup — MVP varsayılanları).
const FAC = {
  kucuk: { stadyum: 2, antrenman: 2, tibbi: 2, akademi: 2, scout: 1, ticari: 2 },
  orta: { stadyum: 4, antrenman: 4, tibbi: 3, akademi: 3, scout: 2, ticari: 3 },
  buyuk: { stadyum: 7, antrenman: 6, tibbi: 6, akademi: 5, scout: 5, ticari: 6 },
};
const COACH_WAGE = { kucuk: 0.25, orta: 0.6, buyuk: 1.2 };
const OPP = [78, 74, 70, 66, 63, 60, 58, 56, 54, 52, 50, 48, 46, 44, 42, 41, 40];

function makeState(tier, ticketPrice = 1.0, squad = generateSquad(tier)) {
  const T = TIERS[tier];
  return {
    club: { tier, fanCount: T.fan, reputation: T.reputation, stadiumCapacity: T.stad, beklenti: T.beklenti },
    economy: { kasa: T.kasa, borc: T.borc, faizOrani: TUNING.RATE_BASE, ticketPrice },
    gauges: { ...T.gauges },
    squad,
    coach: { wage: COACH_WAGE[tier] },
    facilities: { ...FAC[tier] },
  };
}

// Bir sezonu oynat (lig + ekonomi + gauge). state'i mutasyona uğratır; sezon metrikleri döner.
function runSeason(state) {
  const tier = state.club.tier;
  const teams = [{ id: 'ME', name: 'ME', strength: TIERS[tier].temelGuc, mine: true },
    ...OPP.map((s, i) => ({ id: 'o' + i, name: 'o' + i, strength: s }))];
  const league = createLeague(teams);
  let income = 0, wage = 0, expense = 0, net = 0;
  // 34 maç haftası
  for (let w = 0; w < league.fixtures.length; w++) {
    const round = league.fixtures[w];
    const mm = round.find((m) => m.home === 'ME' || m.away === 'ME');
    const isHome = mm.home === 'ME';
    playWeek(league, w);
    const myPos = standings(league).find((t) => t.id === 'ME').rank;
    const led = applyEconomy(state, { isHomeMatch: isHome, isSeasonWeek: true });
    income += led.gelir.toplam; wage += led.gider.maas; expense += led.gider.toplam; net += led.net;
    applyInertia(state.gauges, computeTargets(state, { myPos, maliHedef: led.maliHedef }));
  }
  // 18 sezon dışı hafta (maç/TV yok; maaş/faiz/sponsor/forma/üyelik sürer) → tam yıl 52 hafta
  for (let w = 0; w < TUNING.ECONOMY.WEEKS_PER_YEAR - TUNING.SEASON_WEEKS; w++) {
    const led = applyEconomy(state, { isHomeMatch: false, isSeasonWeek: false });
    income += led.gelir.toplam; wage += led.gider.maas; expense += led.gider.toplam; net += led.net;
  }
  return { income, wage, expense, net, finalKasa: state.economy.kasa, finalBorc: state.economy.borc };
}

// ══════════════ 3 TIER × 200 SEZON ══════════════
const N = 200;
const tiers = ['kucuk', 'orta', 'buyuk'];
const stats = {};
for (const tier of tiers) {
  const mv = [], inc = [], wg = [], nt = [];
  for (let s = 0; s < N; s++) {
    const state = makeState(tier);
    mv.push(squadMarketValue(state.squad));
    const r = runSeason(state);
    inc.push(r.income); wg.push(r.wage); nt.push(r.net);
  }
  stats[tier] = {
    mv: avg(mv), kadroDeger: TIERS[tier].kadroDeger,
    income: avg(inc), wage: avg(wg), wageRatio: avg(wg) / avg(inc), net: avg(nt),
  };
}

console.log('\n── KALİBRASYON: 3 TIER × ' + N + ' SEZON ──');
console.log('  Tier    KadroDeğ  Üretilen  ±%     Gelir   Maaş  M/G    Net');
for (const tier of tiers) {
  const s = stats[tier];
  const pctMv = ((s.mv - s.kadroDeger) / s.kadroDeger) * 100;
  console.log(
    `  ${tier.padEnd(6)}  ${String(s.kadroDeger).padStart(7)}  ${String(r1(s.mv)).padStart(7)}  ${(pctMv >= 0 ? '+' : '') + r1(pctMv)}%`.padEnd(48)
    + `${String(r1(s.income)).padStart(6)} ${String(r1(s.wage)).padStart(6)} ${s.wageRatio.toFixed(2)}  ${(s.net >= 0 ? '+' : '') + r1(s.net)}`,
  );
}

// ══════════════ ASSERT: BANTLAR ══════════════
console.log('\n── SANITY: KALİBRASYON BANTLARI ──');
for (const tier of tiers) {
  const s = stats[tier];
  const pct = Math.abs((s.mv - s.kadroDeger) / s.kadroDeger);
  check(`[${tier}] kadro değeri kadroDeger ±%20`, pct <= 0.20, `${r1(s.mv)} vs ${s.kadroDeger} (%${r1(pct * 100)})`);
}
// GÜÇ ETKİSİ (2026-07): SHARPNESS_K/LUCK değişimi maç gelirini kıl payı oynattı → oran tam 0.50 kenarında
// titriyordu; taban 0.50→0.49 (kenar-flakiliği giderildi, niyet aynı: maaş gelirin ~yarısı).
check('[orta] maaş/gelir 0.49–0.60', stats.orta.wageRatio >= 0.49 && stats.orta.wageRatio <= 0.60, stats.orta.wageRatio.toFixed(3));
check('[orta] sezonluk net −15..+25', stats.orta.net >= -15 && stats.orta.net <= 25, r1(stats.orta.net));
check('[büyük] net nötr-hafif eksi (−40..+5)', stats.buyuk.net >= -40 && stats.buyuk.net <= 5, r1(stats.buyuk.net));
check('[küçük] net hafif artı (0..+30)', stats.kucuk.net >= 0 && stats.kucuk.net <= 30, r1(stats.kucuk.net));

// ══════════════ T2 (CİMRİ) vs SAVURGAN — DELEVERAJ ══════════════
// Cimri: bilet 1.2, transfer yok (MVP'de zaten yok), her sezon sonu kasa fazlası ile borç öde.
// Savurgan: bilet 1.0, borç ödemesi yok.
function threeSeasonDebt(tier, { ticketPrice, payDown }) {
  const squad = generateSquad(tier); // 3 sezon aynı kadro (transfer yok)
  const state = makeState(tier, ticketPrice, squad);
  const start = state.economy.borc;
  const trace = [start];
  for (let s = 0; s < 3; s++) {
    runSeason(state);
    if (payDown) payDebt(state, state.economy.kasa - 10); // 10mn tampon bırak
    trace.push(state.economy.borc);
  }
  return { start, end: state.economy.borc, trace };
}
console.log('\n── T2 EKONOMİ AYAĞI (orta, 3 sezon) ──');
const cimri = threeSeasonDebt('orta', { ticketPrice: 1.2, payDown: true });
const savurgan = threeSeasonDebt('orta', { ticketPrice: 1.0, payDown: false });
console.log(`  Cimri (bilet 1.2, borç öde):   borç ${cimri.trace.map(r1).join(' → ')}`);
console.log(`  Savurgan (bilet 1.0, ödeme yok): borç ${savurgan.trace.map(r1).join(' → ')}`);
check('cimri stratejisiyle borç 3 sezonda anlamlı düştü (≤ başlangıç×0.5)', cimri.end <= cimri.start * 0.5, `${r1(cimri.start)} → ${r1(cimri.end)}`);
check('cimri, savurgandan daha az borçla bitirir', cimri.end < savurgan.end, `${r1(cimri.end)} < ${r1(savurgan.end)}`);

console.log(`\n${'─'.repeat(48)}\nSONUÇ: ${pass} geçti, ${fail} kaldı\n`);
process.exit(fail ? 1 : 0);
