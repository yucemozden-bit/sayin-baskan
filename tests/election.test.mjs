// tests/election.test.mjs — Vaat + eşik olayı + seçim (Bible-14.1/15/16) + V4-§13 senaryoları
// Çalıştır: node tests/election.test.mjs

import { TUNING, TIERS } from '../src/config.js';
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import { Player } from '../src/models/player.js';
import { generateSquad, squadMarketValue } from '../src/models/squadGen.js';
import { createLeague, playWeek, standings } from '../src/engines/league.js';
import { applyEconomy, payDebt } from '../src/engines/economy.js';
import { computeTargets, applyInertia } from '../src/engines/gauges.js';
import { checkThresholdEvents, tickEventFlags } from '../src/engines/events.js';
import { selectPromises, judgePromises } from '../src/engines/promises.js';
import { oyOrani, eleksiyon, sozKarne } from '../src/engines/election.js';

let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  → ' + detail : ''}`);
  ok ? pass++ : fail++;
}
const r1 = (x) => Math.round(x * 10) / 10;
const promisesData = JSON.parse(readFileSync(new URL('../src/data/promises.json', import.meta.url))).promises;

// ══════════════ (1) BIBLE-16.2 VEKTÖRÜ ══════════════
console.log('\n── BIBLE-16.2 vektörü ──');
// Verilen girdiler: sportif=100, taraftar=68, mali=53.5, itibar=58, söz=56, rakip=35
const oy = oyOrani({ sportif: 100, taraftar: 68, mali: 53.5, itibar: 58, soz: 56, rival: 35 });
check('oyOranı ≈ %53.9 (±1)', Math.abs(oy * 100 - 53.9) <= 1, `%${r1(oy * 100)}`);
// Bible-16.2 örneği %50 eşiğiyle yazılmıştı ("%53.9 → KAZANDI"). Formül doğrulaması yukarıda;
// eşik artık tasarım kararıyla WIN_LINE=0.55 (bu vektör mevcut eşikte kaybeder — bilinçli).
check('Bible-16.2 orijinal eşiğinde (%50) KAZANDI', oy > 0.50, `%${r1(oy * 100)} > 50`);

// ══════════════ (2) VAAT: 0 vaat & tutulmayan vaat ══════════════
console.log('\n── Vaat sistemi ──');
const s0 = { gauges: { taraftar: 60, guven: 55 }, economy: { borc: 60 }, club: {}, facilities: {}, promises: [], rival: { attractiveness: 0 } };
check('0 vaat → SözTutma nötr 50', sozKarne(s0) === 50, `${sozKarne(s0)}`);

const s1 = { gauges: { taraftar: 60, guven: 55 }, economy: { borc: 60 }, club: {}, facilities: {}, rival: { attractiveness: 0 }, sozTutmaBirikim: 0 };
selectPromises(s1, ['P02', 'P04'], promisesData); // borçsuz(4) + kadro+40(4)
const rivalBefore = s1.rival.attractiveness;
const j = judgePromises(s1, { P02: false, P04: false }); // ikisi de tutulmadı
check('tutulmayan vaat → rakip çekicilik arttı', s1.rival.attractiveness > rivalBefore, `${rivalBefore} → ${s1.rival.attractiveness}`);
check('tutulmayan vaat → SözTutma düştü (<50 karne)', sozKarne(s1) < 50, `${r1(sozKarne(s1))}`);

// ══════════════ (3) EŞİK OLAYLARI DUMANI (Bible-14.1) ══════════════
console.log('\n── Eşik olayları (Bible-14.1) ──');
const ke = { gauges: { guven: 15, taraftar: 60, mali: 60, itibar: 50 }, flags: {} };
checkThresholdEvents(ke);
check('güven<20 → budgetLock + taraftar −5', ke.flags.budgetLock === 4 && ke.gauges.taraftar === 55);
const be = { gauges: { guven: 60, taraftar: 20, mali: 60, itibar: 50 }, flags: {} };
checkThresholdEvents(be);
check('taraftar<25 → boykot bayrağı', be.flags.boykot === 3);
const me = { gauges: { guven: 60, taraftar: 60, mali: 10, itibar: 50 }, flags: {} };
checkThresholdEvents(me);
check('mali<15 → transfer tahtası', me.flags.transferBan === 2);
const ze = { gauges: { guven: 60, taraftar: 60, mali: 60, itibar: 50 }, flags: {} };
checkThresholdEvents(ze, { champion: true });
check('şampiyon → itibar +15, taraftar +20', ze.gauges.itibar === 65 && ze.gauges.taraftar === 80);

// ══════════════ (4) V4-§13 SENARYOLARI (500 sim) ══════════════
// Ortak dönem simülasyonu: orta kulüp, 3 sezon, strateji parametreleriyle → seçim.
// Orta-tier lig: 55 güçlü kulüp genuine üst-yarı takımı (medyan ~47) — orta beklenti ust_yari.
const SCEN_OPP = [61, 58, 55, 53, 51, 50, 49, 48, 47, 46, 45, 44, 43, 42, 40, 38, 36]; // 17 rakip
const FAC = { stadyum: 4, antrenman: 4, tibbi: 3, akademi: 3, scout: 2, ticari: 3 };

function makeState(ticketPrice, extraDebt) {
  const T = TIERS.orta;
  return {
    club: { tier: 'orta', fanCount: T.fan, reputation: T.reputation, stadiumCapacity: T.stad, beklenti: T.beklenti, kadroDeger: T.kadroDeger },
    economy: { kasa: T.kasa, borc: T.borc + extraDebt, faizOrani: TUNING.RATE_BASE, ticketPrice },
    gauges: { ...T.gauges },
    squad: generateSquad('orta'),
    coach: { wage: 0.6 },
    facilities: { ...FAC },
    flags: {}, rival: { attractiveness: 0 }, sozTutmaBirikim: 0, history: { seasons: [] },
  };
}

function runSeason(state, strength) {
  const teams = [{ id: 'ME', name: 'ME', strength, mine: true }, ...SCEN_OPP.map((s, i) => ({ id: 'o' + i, name: 'o' + i, strength: s }))];
  const league = createLeague(teams);
  for (let w = 0; w < league.fixtures.length; w++) {
    const round = league.fixtures[w];
    const mm = round.find((m) => m.home === 'ME' || m.away === 'ME');
    playWeek(league, w);
    const myPos = standings(league).find((t) => t.id === 'ME').rank;
    const led = applyEconomy(state, { isHomeMatch: mm.home === 'ME', isSeasonWeek: true });
    applyInertia(state.gauges, computeTargets(state, { myPos, maliHedef: led.maliHedef }));
    checkThresholdEvents(state, {}); tickEventFlags(state);
  }
  for (let w = 0; w < TUNING.ECONOMY.WEEKS_PER_YEAR - TUNING.SEASON_WEEKS; w++) {
    applyEconomy(state, { isHomeMatch: false, isSeasonWeek: false });
  }
  return standings(league).find((t) => t.id === 'ME').rank;
}

function runTerm(st) {
  const state = makeState(st.ticket, st.extraDebt);
  for (let i = 0; i < st.stars; i++) state.squad.push(new Player({ id: 900 + i, pos: 'FWD', overall: 82, potential: 82, age: 26 }));
  state.club.kadroDeger = squadMarketValue(state.squad);
  const baslangicBorc = state.economy.borc;
  const strength = TIERS.orta.temelGuc + st.strengthBoost;
  const positions = [];
  for (let s = 0; s < TUNING.SEASONS_PER_TERM; s++) {
    const pos = runSeason(state, strength);
    positions.push(pos);
    state.history.seasons.push({ pos, champion: pos === 1, cup: false });
    if (st.payDebt) payDebt(state, state.economy.kasa - 10);
    checkThresholdEvents(state, { relegated: pos >= TUNING.LEAGUE.RELEGATION_FROM, champion: pos === 1 });
  }
  const res = eleksiyon(state, { baslangicBorc, tutulmayanVaat: 0 });
  return { won: res.kazandi, oy: res.oyOrani, b: res.breakdown, pos: positions[2], borc: state.economy.borc };
}

const SCEN = {
  'T1 Popülist': { ticket: 0.6, stars: 3, strengthBoost: 6, extraDebt: 200, payDebt: false },
  'T2 Cimri': { ticket: 1.2, stars: 0, strengthBoost: 0, extraDebt: 0, payDebt: true },
  'T3 Dengeli': { ticket: 1.0, stars: 1, strengthBoost: 3, extraDebt: 0, payDebt: true },
};
const NS = 500;
setSeed(20260705); // deterministik senaryo koşumu (tekrarlanabilir dengeleme)
const winPct = {}, diag = {};
for (const [name, st] of Object.entries(SCEN)) {
  let wins = 0; const acc = { oy: 0, sportif: 0, taraftar: 0, mali: 0, itibar: 0, soz: 0, rival: 0, pos: 0, borc: 0 };
  for (let i = 0; i < NS; i++) {
    const r = runTerm(st);
    if (r.won) wins++;
    acc.oy += r.oy * 100; acc.pos += r.pos; acc.borc += r.borc;
    for (const k of ['sportif', 'taraftar', 'mali', 'itibar', 'soz', 'rival']) acc[k] += r.b[k];
  }
  winPct[name] = (wins / NS) * 100;
  for (const k in acc) acc[k] /= NS;
  diag[name] = acc;
}

console.log('\n── V4-§13 SENARYOLARI (' + NS + ' sim/senaryo) ──');
console.log('  Senaryo      Kazanma%  Son.Sıra  oyOranı | Spor Trf Mal İti Söz Rak');
for (const name of Object.keys(SCEN)) {
  const d = diag[name];
  console.log(`  ${name.padEnd(11)} ${r1(winPct[name]).toString().padStart(6)}%  ${r1(d.pos).toString().padStart(5)}   %${r1(d.oy).toString().padStart(4)}  | ${[d.sportif, d.taraftar, d.mali, d.itibar, d.soz, d.rival].map((x) => Math.round(x).toString().padStart(3)).join(' ')}`);
}

console.log('\n── SANITY: SENARYO BANTLARI ──');
// Bantlar WIN_LINE 0.55 eşiğine göre güncellendi (idealize senaryolar). Sıralama korunur: dengeli > cimri >> popülist.
// GÜÇ ETKİSİ (2026-07, kullanıcı isteği): SHARPNESS_K 1.6→3.0 — takım gücü galibiyeti daha çok belirliyor.
// Bu İDEALİZE senaryolarda (ortalama-üstü kadro, hep borç kapatılır, kariyer eskalasyonu YOK) etki
// tavana yakın: ortalama-üstü kulüp ligde istikrarlı yüksek bitince seçim karnesi uçuyor → cimri %60→92,
// dengeli %76→99. NOT: gerçek TAM-KARİYER zorluğu (autoplay hayatta kalma bantları) DEĞİŞMEDİ — eskalasyon
// ve ekonomi baskısı orada devrede. Bu bantlar yalnız formülün ideal-senaryo tepkisini ölçer.
check('T1 popülist kaybetme ≥ %90', (100 - winPct['T1 Popülist']) >= 90, `kayıp %${r1(100 - winPct['T1 Popülist'])}`);
check('T2 cimri kazanma %82-98', winPct['T2 Cimri'] >= 82 && winPct['T2 Cimri'] <= 98, `%${r1(winPct['T2 Cimri'])}`);
check('T3 dengeli kazanma %90-100', winPct['T3 Dengeli'] >= 90 && winPct['T3 Dengeli'] <= 100, `%${r1(winPct['T3 Dengeli'])}`);
check('sıralama korunur: dengeli > cimri', winPct['T3 Dengeli'] > winPct['T2 Cimri'], `dengeli %${r1(winPct['T3 Dengeli'])} > cimri %${r1(winPct['T2 Cimri'])}`);

console.log(`\n${'─'.repeat(48)}\nSONUÇ: ${pass} geçti, ${fail} kaldı\n`);
process.exit(fail ? 1 : 0);
