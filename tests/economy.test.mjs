// tests/economy.test.mjs — Ekonomi + gauge + beklenti entegrasyonu (Bible-8/12/13)
// Çalıştır: node tests/economy.test.mjs

import { readFileSync } from 'node:fs';
import { TIERS, TUNING } from '../src/config.js';
import { generateSquad } from '../src/models/squadGen.js';
import { createLeague, playWeek, standings } from '../src/engines/league.js';
import { applyEconomy, bilet, maliHedef } from '../src/engines/economy.js';
import { computeTargets, applyInertia, targetTaraftar } from '../src/engines/gauges.js';
import { beklentiyeGoreSonuc } from '../src/engines/expectation.js';
import { maliKarne } from '../src/engines/election.js';
import { checkBorcsuz } from '../src/actions.js';

let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  → ' + detail : ''}`);
  ok ? pass++ : fail++;
}
const r1 = (x) => Math.round(x * 10) / 10;

// Orta kulüp durumu (TIERS.orta) — kadro squadGen ile üretilir (kalibre maaş/değer).
function makeOrtaState() {
  const T = TIERS.orta;
  return {
    club: { tier: 'orta', fanCount: T.fan, reputation: T.reputation, stadiumCapacity: T.stad, beklenti: T.beklenti },
    economy: { kasa: T.kasa, borc: T.borc, faizOrani: TUNING.RATE_BASE, ticketPrice: 1.0 },
    gauges: { ...T.gauges },
    squad: generateSquad('orta'),
    coach: { wage: 0.6 },
    facilities: { stadyum: 4, antrenman: 4, tibbi: 3, akademi: 3, scout: 2, ticari: 3 },
  };
}

// ══════════════ 1 SEZONLUK ENTEGRE SİMÜLASYON ══════════════
const teamsData = JSON.parse(readFileSync(new URL('../src/data/teams.json', import.meta.url)));
const MY_ID = 'vadi-1905';
const leagueTeams = teamsData.teams.map((t) => ({
  id: t.id, name: t.name, strength: t.id === MY_ID ? TIERS.orta.temelGuc : t.baseStrength, mine: t.id === MY_ID,
}));

const state = makeOrtaState();
const league = createLeague(leagueTeams);
const rows = [];
let minKasa = Infinity, maxKasa = -Infinity, maxBorc = -Infinity, anyNaN = false;

for (let w = 0; w < league.fixtures.length; w++) {
  const round = league.fixtures[w];
  const myMatch = round.find((m) => m.home === MY_ID || m.away === MY_ID);
  const isHome = myMatch.home === MY_ID;
  playWeek(league, w);
  const table = standings(league);
  const myPos = table.find((t) => t.id === MY_ID).rank;

  const led = applyEconomy(state, { isHomeMatch: isHome });
  const targets = computeTargets(state, { myPos, maliHedef: led.maliHedef });
  applyInertia(state.gauges, targets);

  const g = state.gauges;
  const row = { w: w + 1, isHome, myPos, kasa: state.economy.kasa, borc: state.economy.borc, ...g };
  rows.push(row);
  for (const v of [row.kasa, row.borc, g.guven, g.taraftar, g.mali, g.sportif, g.itibar]) if (!Number.isFinite(v)) anyNaN = true;
  minKasa = Math.min(minKasa, row.kasa); maxKasa = Math.max(maxKasa, row.kasa); maxBorc = Math.max(maxBorc, row.borc);
}

console.log('\n── ORTA KULÜP — 1 SEZON KASA/BORÇ/GAUGE SEYRİ ──');
console.log('  Hf Ev Sıra    Kasa    Borç | Güv Trf Mal Spo İtb');
const pad = (n, w) => String(n).padStart(w);
for (const row of rows.filter((r) => [1, 6, 12, 17, 24, 30, 34].includes(r.w))) {
  console.log(
    `  ${pad(row.w, 2)} ${row.isHome ? 'E' : 'D'} ${pad(row.myPos, 3)}  ${pad(r1(row.kasa), 6)}  ${pad(r1(row.borc), 6)} |`
    + ` ${pad(Math.round(row.guven), 3)} ${pad(Math.round(row.taraftar), 3)} ${pad(Math.round(row.mali), 3)} ${pad(Math.round(row.sportif), 3)} ${pad(Math.round(row.itibar), 3)}`,
  );
}
const last = rows[rows.length - 1];
console.log(`\n  Sezon sonu: ${last.myPos}. sıra · kasa ${r1(last.kasa)}mn · borç ${r1(last.borc)}mn · faiz ${r1(state.economy.faizOrani * 100)}%`);
console.log(`  Kasa aralığı: [${r1(minKasa)}, ${r1(maxKasa)}] mn · maks borç ${r1(maxBorc)} mn`);

// ══════════════ SANITY ══════════════
console.log('\n── SANITY ──');

// (1) kasa/borç makul: NaN yok, iflas yok (kasa≥0 otomatik borçlanma ile), borç spiral yok
check('kasa/borç seyri makul (NaN yok, iflas yok, borç spiral yok)',
  !anyNaN && minKasa >= 0 && maxKasa < 3000 && maxBorc <= TIERS.orta.borc * 2,
  `kasa[${r1(minKasa)},${r1(maxKasa)}] borç≤${r1(maxBorc)}`);

// (2) bilet fiyatı 0.6 vs 1.6: doluluk ve gelir doğru yönde
const priceState = makeOrtaState();
priceState.economy.ticketPrice = 0.6; const b06 = bilet(priceState);
priceState.economy.ticketPrice = 1.6; const b16 = bilet(priceState);
check('ucuz bilet → doluluk daha yüksek', b06.doluluk > b16.doluluk, `%${r1(b06.doluluk * 100)} > %${r1(b16.doluluk * 100)}`);
check('pahalı bilet → gelir daha yüksek (bu bantta talep inelastik)', b16.gelir > b06.gelir, `${r1(b16.gelir)} > ${r1(b06.gelir)} mn/maç`);

// (3) gauge ataleti: tek maçlık maksimum şok gauge'ı %20'den (İtibar %8) fazla oynatmıyor
const g0 = { guven: 50, taraftar: 50, mali: 50, sportif: 50, itibar: 50 };
const gap = 100 - 50; // maksimum şok (hedef=100)
applyInertia(g0, { guven: 100, taraftar: 100, mali: 100, sportif: 100, itibar: 100 });
const dGuven = g0.guven - 50, dItibar = g0.itibar - 50;
check('tek tick güven değişimi ≤ %20 (INERTIA)', dGuven <= 0.20 * gap + 1e-9 && Math.abs(dGuven - 0.20 * gap) < 1e-9, `Δ${r1(dGuven)} (=%${r1((dGuven / gap) * 100)} boşluk)`);
check('İtibar ataleti daha yavaş (%8)', Math.abs(dItibar - 0.08 * gap) < 1e-9, `Δ${r1(dItibar)}`);

// (4) küçük 12. sıra → taraftar hedefi >50 ; büyük 4. sıra → <50 (ikincil sürücüler nötr)
const Bk = beklentiyeGoreSonuc(15, 12); // küçük: hedefSıra 15, delta +3
const Bb = beklentiyeGoreSonuc(1, 4);   // büyük: hedefSıra 1, delta −3
const tk = targetTaraftar({ beklentiyeGoreSonuc: Bk });
const tb = targetTaraftar({ beklentiyeGoreSonuc: Bb });
check('küçük kulüp 12. → taraftar hedefi > 50', tk > 50, `${r1(tk)} (beklentiyeGöreSonuç ${r1(Bk)})`);
check('büyük kulüp 4. → taraftar hedefi < 50', tb < 50, `${r1(tb)} (beklentiyeGöreSonuç ${r1(Bb)})`);

// ══════════════ BORÇSUZ ÖDÜLÜ (mali disiplin uçar + geçiş dalgası) ══════════════
console.log('\n── BORÇSUZ ÖDÜLÜ ──');
{
  // maliHedef: aynı kasa, borçsuz vs borçlu — borçsuz mali gauge hedefi belirgin yüksek
  const sBorclu = makeOrtaState(); sBorclu.economy.kasa = 40; sBorclu.economy.borc = 40;
  const sBorcsuz = makeOrtaState(); sBorcsuz.economy.kasa = 40; sBorcsuz.economy.borc = 0;
  const mhBorclu = maliHedef(sBorclu, 5, 5), mhBorcsuz = maliHedef(sBorcsuz, 5, 5);
  check('maliHedef: borçsuz kulüp mali tabloyu belirgin yükseltir', mhBorcsuz >= mhBorclu + TUNING.ECONOMY.BORCSUZ_MALI_BONUS - 1e-6, `borçlu ${r1(mhBorclu)} → borçsuz ${r1(mhBorcsuz)}`);

  // maliKarne (seçim): borçsuz flat bonus sandığa yansır
  const eBorclu = makeOrtaState(); eBorclu.economy.borc = 10; eBorclu.gauges.mali = 60;
  const eBorcsuz = makeOrtaState(); eBorcsuz.economy.borc = 0; eBorcsuz.gauges.mali = 60;
  const mkBorclu = maliKarne(eBorclu, 10), mkBorcsuz = maliKarne(eBorcsuz, 0);
  check('maliKarne: borçsuz kulüp seçim mali karnesini yükseltir', mkBorcsuz > mkBorclu, `borçlu ${r1(mkBorclu)} → borçsuz ${r1(mkBorcsuz)}`);

  // checkBorcsuz: borçsuza GEÇİŞ ANI — diğer disiplinlere bir defalık coşku dalgası + inbox
  const G = { economy: { borc: 5 }, gauges: { taraftar: 50, itibar: 50, guven: 50 }, meta: { season: 1, week: 3 }, inbox: [] };
  checkBorcsuz(G);
  check('borçluyken tetiklenmez', G.gauges.taraftar === 50 && G.inbox.length === 0);
  G.economy.borc = 0; checkBorcsuz(G);
  check('borçsuza geçiş: taraftar+itibar+güven yükselir + kutlama mesajı',
    G.gauges.taraftar > 50 && G.gauges.itibar > 50 && G.gauges.guven > 50 && G.inbox.some((m) => /borçsuz/i.test(m.t)),
    `trf ${r1(G.gauges.taraftar)} itb ${r1(G.gauges.itibar)} güv ${r1(G.gauges.guven)}`);
  const trf1 = G.gauges.taraftar;
  G._borcsuzActive = false; checkBorcsuz(G); // aynı sezon yeniden geçiş → kutlanmaz (istismar koruması)
  check('aynı sezon ikinci coşku tetiklenmez (kredi-öde istismar koruması)', G.gauges.taraftar === trf1);
  G._borcsuzActive = false; G._borcsuzSeason = 1; G.meta.season = 2; const trf2 = G.gauges.taraftar; checkBorcsuz(G);
  check('yeni sezonda borçsuzluk yeniden kutlanabilir', G.gauges.taraftar > trf2);
}

console.log(`\n${'─'.repeat(48)}\nSONUÇ: ${pass} geçti, ${fail} kaldı\n`);
process.exit(fail ? 1 : 0);
