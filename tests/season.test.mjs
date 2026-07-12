// tests/season.test.mjs — Maç motoru + lig birim/sanity testleri (Bible-6/7)
// Çalıştır: node tests/season.test.mjs

import { readFileSync } from 'node:fs';
import { TIERS } from '../src/config.js';
import { simulateSeason } from '../src/engines/league.js';
import { postMatch } from '../src/engines/match.js';
import { isAvailable } from '../src/models/squad.js';

let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  → ' + detail : ''}`);
  ok ? pass++ : fail++;
}

// ══════════════ ÖRNEK SEZON (Orta kulüp presetiyle) ══════════════
// teams.json gerçek isimleri; bir kulüp "BEN" olarak Orta preset gücüne çekilir
// (Bible-3 TIERS.orta.temelGuc, config'ten okunur).
const teamsData = JSON.parse(readFileSync(new URL('../src/data/teams.json', import.meta.url)));
const MY_ID = 'vadi-1905';
const teams = teamsData.teams.map((t) => ({
  id: t.id,
  name: t.id === MY_ID ? t.name + ' (BEN)' : t.name,
  strength: t.id === MY_ID ? TIERS.orta.temelGuc : t.baseStrength,
  mine: t.id === MY_ID,
}));

const { table } = simulateSeason(teams);
console.log('\n── ÖRNEK SEZON — Final Puan Tablosu ──');
console.log('  #  Takım                     O   G  B  M   AG  YG   AV  P');
for (const t of table) {
  const mark = t.mine ? '»' : ' ';
  const nm = (t.name).padEnd(24).slice(0, 24);
  const pad = (n, w) => String(n).padStart(w);
  console.log(`${mark} ${pad(t.rank, 2)} ${nm} ${pad(t.P, 3)} ${pad(t.W, 3)}${pad(t.D, 3)}${pad(t.L, 3)} ${pad(t.GF, 4)}${pad(t.GA, 4)} ${pad(t.GD, 4)} ${pad(t.Pts, 3)}`);
}
const me = table.find((t) => t.mine);
console.log(`\n  BENİM KULÜBÜM: ${me.rank}. sıra · ${me.W}G ${me.D}B ${me.L}M · ${me.Pts} puan (güç 55)`);
const zone = me.rank === 1 ? 'ŞAMPİYON' : me.rank <= 4 ? 'Avrupa' : me.rank >= 16 ? 'KÜME HATTI' : 'orta sıra';
console.log(`  Sezon sonu bölge: ${zone}`);

// ══════════════ SANITY (500 sezon) ══════════════
// Kontrollü güç dağılımı: en güçlü 78, en zayıf 40.
const strengths = [78, 74, 70, 66, 63, 61, 60, 58, 56, 54, 52, 50, 48, 46, 44, 42, 41, 40];
const synth = strengths.map((s, i) => ({ id: 't' + i, name: 'Takım-' + i + ' (' + s + ')', strength: s }));
const rankOf = (tbl, id) => tbl.find((t) => t.id === id).rank;

const N = 500;
let sumRank78 = 0, sumRank40 = 0, goals = 0, matchCount = 0, homeW = 0, awayW = 0, draws = 0;
for (let s = 0; s < N; s++) {
  const { table: tbl, matches } = simulateSeason(synth);
  sumRank78 += rankOf(tbl, 't0');   // güç 78
  sumRank40 += rankOf(tbl, 't17');  // güç 40
  for (const m of matches) {
    goals += m.gH + m.gA; matchCount++;
    if (m.gH > m.gA) homeW++; else if (m.gA > m.gH) awayW++; else draws++;
  }
}
const avg78 = sumRank78 / N;
const avg40 = sumRank40 / N;
const gpm = goals / matchCount;
const homePct = (homeW / matchCount) * 100;
const awayPct = (awayW / matchCount) * 100;
const drawPct = (draws / matchCount) * 100;

console.log(`\n── SANITY (${N} sezon, ${matchCount} maç) ──`);
check(`Güç 78 takım ortalama sıra ≤ 4`, avg78 <= 4, `avg ${avg78.toFixed(2)}`);
check(`Güç 40 takım ortalama sıra ≥ 12`, avg40 >= 12, `avg ${avg40.toFixed(2)}`);
check(`Gol/maç ortalaması 2.3–2.9`, gpm >= 2.3 && gpm <= 2.9, `${gpm.toFixed(3)}`);
check(`Ev sahibi galibiyet > deplasman galibiyet`, homePct > awayPct, `ev %${homePct.toFixed(1)} · dep %${awayPct.toFixed(1)} · ber %${drawPct.toFixed(1)}`);

// ══════════════ postMatch dumanı (Bible-6) ══════════════
const squad = [
  ...Array(3).fill('GK'), ...Array(8).fill('DEF'), ...Array(8).fill('MID'), ...Array(6).fill('FWD'),
].map((pos, i) => ({ id: i, pos, overall: 60, morale: 65, form: 50, fitness: 100, injuryWeeks: 0, suspensionWeeks: 0, onIntlDuty: false }));
postMatch(squad, 'W', { tibbi: 5 });
const starters = squad.slice(0, 11); // idealXI ilk 11 (hepsi 60, ilk seçilenler)
const anyFitDrop = squad.some((p) => p.fitness < 100);
const anyFormUp = squad.some((p) => p.form > 50);
check('postMatch: oynayanların kondisyonu düştü', anyFitDrop);
check('postMatch: galibiyette form arttı', anyFormUp);

// 1 haftalık sakatlık TAM 1 maç kaçırtır (Bible sıra hatası düzeltmesi)
const mkSquad = (fwd) => [
  ...Array(3).fill('GK'), ...Array(8).fill('DEF'), ...Array(8).fill('MID'), ...Array(fwd).fill('FWD'),
].map((pos, i) => ({ id: i, pos, overall: 60, morale: 65, form: 50, fitness: 100, injuryWeeks: 0, suspensionWeeks: 0, onIntlDuty: false }));
const inj = { id: 99, pos: 'FWD', overall: 90, morale: 65, form: 50, fitness: 100, injuryWeeks: 1, suspensionWeeks: 0, onIntlDuty: false };
const sq2 = [...mkSquad(5), inj];
check('sakat oyuncu bu maça uygun DEĞİL (maçı kaçırır)', !isAvailable(inj));
postMatch(sq2, 'W', { tibbi: 5 }, () => 0.99);           // 1 hafta geçer (rng yüksek → yeni sakatlık yok)
check('1 haftalık sakatlık: 1 tick sonra iyileşti → tam 1 maç kaçırdı', inj.injuryWeeks === 0 && isAvailable(inj));

// Yeni verilen sakatlık AYNI tick azalmaz (rng=0 → sakatlık zorlanır, süre=MIN=1)
const sq3 = mkSquad(6);
postMatch(sq3, 'W', { tibbi: 0 }, () => 0);
check('yeni sakatlık aynı tick azalmadı (injuryWeeks=1 kaldı)', sq3.some((p) => p.injuryWeeks === 1));

console.log(`\n${'─'.repeat(48)}\nSONUÇ: ${pass} geçti, ${fail} kaldı\n`);
process.exit(fail ? 1 : 0);
