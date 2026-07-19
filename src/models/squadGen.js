// src/models/squadGen.js — Tier'a göre kadro üretimi (Bible-4 dağılımı)
// 24-26 oyuncu, mevki dağılımı SQUAD_TARGET, overall ~ N(tier.temelGuc, SD),
// büyük kulüpte 2-3 yıldız (80+) garantili, yaş 18-34. Katsayılar TUNING.SQUADGEN'den.
// marketValue/wage değerleri Player modelinden (kalibre edilmiş base() ile) gelir.

import { TUNING, TIERS } from '../config.js';
import { SQUAD_TARGET, POSITIONS } from './squad.js';
import { Player, marketValue } from './player.js';
import { rand, randint } from '../core/rng.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Box-Muller ile normal dağılım.
function gaussian(mean, sd, rng = rand) {
  const u1 = Math.max(rng(0, 1), 1e-9), u2 = rng(0, 1);
  return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function pickName(names, rng) {
  if (!names) return null;
  if (rng(0, 1) < 0.3 && names.foreign) {
    const pools = Object.values(names.foreign);
    const pool = pools[Math.floor(rng(0, 1) * pools.length)];
    return pool[Math.floor(rng(0, 1) * pool.length)];
  }
  const f = names.first[Math.floor(rng(0, 1) * names.first.length)];
  const l = names.last[Math.floor(rng(0, 1) * names.last.length)];
  return `${f} ${l}`;
}

// v4.3: TEKİL isim — used haritasına (ad→1) bakar, çakışırsa yeniden çeker (120×120 havuz bol).
// used verilmezse davranış eski haliyle aynı (geriye uyumlu; kayıtlı oyunlar etkilenmez).
export function uniqueName(names, used, rng = rand) {
  if (!names) return null;
  for (let i = 0; i < 25; i++) {
    const n = pickName(names, rng);
    if (!used || !used[n]) { if (used && n) used[n] = 1; return n; }
  }
  const n = pickName(names, rng); // teorik köşe: yine de dön (25 çakışma ≈ imkânsız)
  if (used && n) used[n] = 1;
  return n;
}

// Tier'a göre kadro üret. opts.names verilirse isimlendirir.
export function generateSquad(tier, { rng = rand, names = null, used = null } = {}) {
  const T = TIERS[tier];
  const G = TUNING.SQUADGEN;
  const dist = SQUAD_TARGET.dist;
  const players = [];
  let id = 0;

  for (const pos of POSITIONS) {
    for (let i = 0; i < dist[pos]; i++) {
      const overall = clamp(Math.round(gaussian(T.temelGuc, G.OVERALL_SD, rng)), G.OVERALL_CLAMP[0], G.OVERALL_CLAMP[1]);
      const age = randint(G.AGE[0], G.AGE[1]);
      const potential = age < G.YOUTH_AGE
        ? clamp(overall + randint(0, G.POT_SPREAD), overall, 95)
        : overall;
      players.push(new Player({
        id: id, name: uniqueName(names, used, rng), pos, overall, potential, age,
        contractYears: randint(G.CONTRACT[0], G.CONTRACT[1]),
      }));
      id++;
    }
  }

  // Büyük kulüp: 2-3 yıldız (80+) garantili.
  if (tier === 'buyuk') {
    const want = randint(G.BUYUK_STARS[0], G.BUYUK_STARS[1]);
    const top = players.slice().sort((a, b) => b.overall - a.overall);
    for (let i = 0; i < want; i++) {
      if (top[i].overall < TUNING.STAR_THRESHOLD) {
        top[i].overall = randint(G.STAR_MIN, G.STAR_MAX);
        top[i].potential = Math.max(top[i].potential, top[i].overall);
        top[i].refreshValue();
      }
    }
  }

  return players;
}

// Kadronun toplam piyasa değeri (kalibrasyon kontrolü için).
export function squadMarketValue(squad) {
  return squad.reduce((s, p) => s + p.marketValue, 0);
}

// Sezon sonu gelişim + yaşlanma (Bible-9). Genç+antrenman → gelişir; yaşlı → geriler.
// squad MUTASYONA uğrar. facilities.antrenman gelişim hızını sürer.
export function developSquad(squad, facilities, rng = rand) {
  const antrenman = facilities.antrenman || 0;
  for (const p of squad) {
    const once = p.overall; // ▲/▼ oku: sezon sonu değişimi de kadroda 3 hafta görünür
    p.age += 1;
    // Gelişim yaşı 27'ye uzadı (kullanıcı isteği 2026-07-21): <24 tam hız, 24-27 YARI hız.
    // rand SAYISI oyuncu başına hâlâ ≤1 (uygunluk kümesi genişledi — bilinçli akış kayması).
    if (p.age <= (TUNING.DEV_GEC_YAS ?? 23) && p.overall < p.potential) {
      const hiz = p.age < TUNING.SQUADGEN.YOUTH_AGE ? 1 : 0.5;
      p.overall = Math.min(p.potential, p.overall + Math.round(rng(0, antrenman * TUNING.DEV_U24_MAX) * hiz));
    }
    if (p.age > TUNING.AGE_DECAY_START) {
      p.overall = Math.max(30, p.overall - Math.round(rng(0, (p.age - TUNING.AGE_DECAY_START) * TUNING.DEV_DECAY_RATE)));
    }
    if (p.overall !== once) { p.okYon = p.overall > once ? 'up' : 'down'; p.okHafta = 3; }
    // ZIRH: kayıttan yüklenen / hanedan-oğlu gibi PLAIN oyuncularda metod yok — değer saf
    // fonksiyonla tazelenir (maraton D4 çökmesi: "p.refreshValue is not a function")
    if (p.refreshValue) p.refreshValue();
    else p.marketValue = marketValue(p.overall, p.age, p.potential ?? p.overall);
  }
  return squad;
}

// Gençlik alımı (Bible-11 / V4-§4): akademi seviyesine bağlı floor(akademi/2) genç üret.
export function youthIntake(facilities, { rng = rand, names = null, used = null } = {}) {
  const G = TUNING.SQUADGEN;
  const akademi = facilities.akademi || 0;
  const count = Math.floor(akademi / G.INTAKE_DIV);
  const POS = ['GK', 'DEF', 'MID', 'FWD'];
  const youths = [];
  for (let i = 0; i < count; i++) {
    const overall = clamp(Math.round(G.YOUTH_OVR_BASE + akademi * G.YOUTH_OVR_PER_AKADEMI + randint(-4, 4)), 30, 60);
    const potential = clamp(Math.round(gaussian(G.YOUTH_POT_BASE + akademi * G.YOUTH_POT_PER_AKADEMI, G.YOUTH_POT_SD, rng)), overall, 95);
    const age = randint(G.YOUTH_AGE_RANGE[0], G.YOUTH_AGE_RANGE[1]);
    youths.push(new Player({
      id: 'y' + i, name: uniqueName(names, used, rng), pos: POS[randint(0, 3)],
      overall, potential, age, contractYears: 3,
    }));
  }
  return youths.sort((a, b) => b.potential - a.potential); // en yetenekli başta
}
