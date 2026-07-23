// src/engines/league.js — Lig (Bible-7)
//   18 takım, çift devreli fikstür (Berger/circle), G3/B1/M0, averaj sıralaması.
//   AI rakipler SADECE strength sayısı (canlı lig başkan simülasyonu V5-§2 kesiminde).
// Katsayılar TUNING'den; engines/ DOM'a dokunmaz.

import { TUNING } from '../config.js';
import { rand } from '../core/rng.js';
import { macGucu } from './power.js';
import { simulateMatch } from './match.js';

// Çift devreli fikstür — Berger (circle) yöntemi. n çift olmalı.
// İlk devre n-1 tur; ikinci devre aynı eşleşmeler ev/deplasman ters.
export function makeFixtures(ids) {
  const teams = ids.slice();
  if (teams.length % 2 !== 0) teams.push(null); // tek sayıysa bye
  const n = teams.length;
  const half = n / 2;
  const first = [];
  let rot = teams.slice(1); // sabit hariç dönen kısım
  for (let r = 0; r < n - 1; r++) {
    const line = [teams[0], ...rot];
    const round = [];
    for (let i = 0; i < half; i++) {
      const t1 = line[i];
      const t2 = line[n - 1 - i];
      if (t1 == null || t2 == null) continue; // bye
      // Ev/deplasman dengesi için tur+eşleşme paritesine göre yer değiştir
      const [home, away] = (r + i) % 2 === 0 ? [t1, t2] : [t2, t1];
      round.push({ home, away });
    }
    first.push(round);
    rot = [rot[rot.length - 1], ...rot.slice(0, -1)]; // döndür
  }
  // İkinci devre: ev/deplasman ters — her eşleşme birer kez ev-deplasman oynanır
  const second = first.map((round) => round.map((m) => ({ home: m.away, away: m.home })));
  return [...first, ...second];
}

// Lig durumu. teams: [{id, name, strength, mine?}]
export function createLeague(teams) {
  const table = {};
  for (const t of teams) {
    table[t.id] = { id: t.id, name: t.name, strength: t.strength, mine: !!t.mine, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, Pts: 0, son: [] };
  }
  return { table, fixtures: makeFixtures(teams.map((t) => t.id)), week: 0 };
}

// ══════════════ RAKİP DURUM KATMANI (AI takımlar da yaşar) ══════════════
// Oyuncunun efektif gücü moral/form/kondisyon/sakatlıkla oynarken AI sabit bir çarpanla
// (AI_EFEKTIF 0.93) oynuyordu — tek taraflı bir dezavantajdı. Artık AI takımların da
// haftalık durumu var. DETERMİNİZM: ana RNG TÜKETİLMEZ, hash tabanlı yerel çekiliş.
function hash32(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
// hash → [0,1) tek atış (mulberry32 karıştırması; sponsorGen ile aynı desen)
function h01(s) { let t = (hash32(s) + 0x6D2B79F5) >>> 0; t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// Son N maçın puan oranı (0..1). Geçmiş yoksa null (sezon açılışı).
function son5Oran(team, n) {
  const s = team && team.son;
  if (!Array.isArray(s) || !s.length) return null;
  const dilim = s.slice(-n);
  const P = TUNING.MATCH.PTS;
  const puan = dilim.reduce((t, r) => t + (r === 'W' ? P.W : r === 'D' ? P.D : P.L), 0);
  return clamp01(puan / (dilim.length * P.W));
}

// Bir AI takımın o haftaki durum çarpanı. team: lig tablosu satırı · season/week: bağlam.
export function aiDurum(team, season = 1, week = 1) {
  const D = TUNING.MATCH.AI_DURUM;
  if (!D || !D.ON || !team) return TUNING.MATCH.AI_EFEKTIF ?? 1;
  const id = String(team.id || team.name || '?');
  const oran = son5Oran(team, D.SON_N);
  if (oran === null) return D.ILK_HAFTA ?? TUNING.MATCH.AI_EFEKTIF ?? 1; // sezon açılışı: nötr

  // 1) SAKATLIK DALGASI — BLOK hafta süren hash dalgası. Güçlü kadro daha iyi emer:
  //    alt sınır, takım gücüyle (25..92 → 0..1) DERINLIK oranında yukarı çekilir.
  const blok = Math.floor((week - 1) / Math.max(1, D.SAKAT_BLOK));
  const gucN = clamp01(((team.strength ?? 60) - 25) / 67);
  const altSinir = lerp(D.SAKAT[0], D.SAKAT[1], (D.SAKAT_DERINLIK ?? 0) * gucN);
  const sakat = lerp(altSinir, D.SAKAT[1], h01(`sk|${id}|${season}|${blok}`));

  // 2) MORAL — EMERGENT: son N maçın puanı. Lider moralli, dipteki moralsiz (rastgele değil).
  const moral = lerp(D.MORAL[0], D.MORAL[1], oran);

  // 3) FORM — yarı hash gürültüsü, yarı sonuç (kazanan takım formda; oyuncununkiyle aynı ruh)
  const w = D.FORM_HASH_W ?? 0.5;
  const form = lerp(D.FORM[0], D.FORM[1], clamp01(w * h01(`fm|${id}|${season}|${week}`) + (1 - w) * oran));

  const m = sakat * moral * form;
  return Math.min(D.BANT[1], Math.max(D.BANT[0], m));
}

// Tek maç: strength → MaçGücü (ev avantajı + şans) → Poisson skor.
// opts: {home, away, season, week} verilirse AI DURUM katmanı uygulanır (rakipler de yaşar).
export function simulateLeagueMatch(homeStr, awayStr, rng = rand, opts = {}) {
  const M = TUNING.MATCH;
  const dH = opts.home ? aiDurum(opts.home, opts.season, opts.week) : 1;
  const dA = opts.away ? aiDurum(opts.away, opts.season, opts.week) : 1;
  const homeMG = macGucu(homeStr * dH, { isHome: true, stadyum: M.AI_STAD, taraftar: M.AI_TARAFTAR });
  const awayMG = macGucu(awayStr * dA, { isHome: false });
  return simulateMatch(homeMG, awayMG);
}

export function applyResult(h, a, gH, gA) {
  const P = TUNING.MATCH.PTS;
  h.P++; a.P++;
  h.GF += gH; h.GA += gA; a.GF += gA; a.GA += gH;
  if (gH > gA) { h.W++; a.L++; h.Pts += P.W; a.Pts += P.L; }
  else if (gH < gA) { a.W++; h.L++; a.Pts += P.W; h.Pts += P.L; }
  else { h.D++; a.D++; h.Pts += P.D; a.Pts += P.D; }
  // DURUM katmanının moral/form beslemesi: son maç sonuçları (kayıtla birlikte taşınır).
  const N = (TUNING.MATCH.AI_DURUM || {}).SON_N || 5;
  const push = (t, r) => { (t.son = t.son || []).push(r); if (t.son.length > N) t.son.shift(); };
  push(h, gH > gA ? 'W' : gH < gA ? 'L' : 'D');
  push(a, gA > gH ? 'W' : gA < gH ? 'L' : 'D');
}

// Bir haftanın (turun) tüm maçlarını oynat.
export function playWeek(league, weekIndex, rng = rand) {
  const round = league.fixtures[weekIndex];
  const results = [];
  for (const m of round) {
    const h = league.table[m.home], a = league.table[m.away];
    const { gH, gA } = simulateLeagueMatch(h.strength, a.strength, rng, { home: h, away: a, season: league.season, week: weekIndex + 1 });
    applyResult(h, a, gH, gA);
    results.push({ home: m.home, away: m.away, gH, gA });
  }
  league.week = weekIndex + 1;
  return results;
}

// Sıralama: puan → averaj (GF−GA) → attığı gol (GF). (Bible-7)
export function standings(league) {
  return Object.values(league.table)
    .slice()
    .sort((x, y) => y.Pts - x.Pts || (y.GF - y.GA) - (x.GF - x.GA) || y.GF - x.GF)
    .map((t, i) => ({ ...t, rank: i + 1, GD: t.GF - t.GA }));
}

// Tüm sezonu oynat. Döner: {league, table (sıralı), matches (tüm maç sonuçları)}.
export function simulateSeason(teams, rng = rand) {
  const league = createLeague(teams);
  const matches = [];
  for (let w = 0; w < league.fixtures.length; w++) matches.push(...playWeek(league, w, rng));
  return { league, table: standings(league), matches };
}
