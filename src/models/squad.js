// src/models/squad.js — Kadro yardımcıları (Bible-4/5)
// Kadro büyüklüğü 22-28, mevki dağılımı hedefi GK3/DEF8/MID8/FWD6 (Bible-4).
// Hat seçimi ve ilk-11 kurma (Bible-5.1/5.2). Katsayılar TUNING'den.

import { TUNING } from '../config.js';

export const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];

// Kadro hedefi (Bible-4) — üretim/denetim için referans.
export const SQUAD_TARGET = { min: 22, max: 28, dist: { GK: 3, DEF: 8, MID: 8, FWD: 6 } };

export function isAvailable(p) {
  return p.injuryWeeks === 0 && p.suspensionWeeks === 0 && !p.onIntlDuty;
}

const byOverallDesc = (a, b) => b.overall - a.overall;

// Bir mevkideki en iyi n oyuncu. availableOnly=true → sakat/cezalı/milli hariç.
export function bestAtPosition(squad, pos, n, availableOnly = false) {
  return squad
    .filter((p) => p.pos === pos && (!availableOnly || isAvailable(p)))
    .sort(byOverallDesc)
    .slice(0, n);
}

// İlk 11 (nominal en iyi kadro) — uygunluk hesabı için UYGUNLUK filtrelemez
// (Bible-5.2: tamKadro tüm ideal XI, mevcut ise onların uygun olanları).
export function idealXI(squad, need = TUNING.POWER.IDEAL_XI) {
  const xi = [];
  for (const pos of POSITIONS) xi.push(...bestAtPosition(squad, pos, need[pos], false));
  return xi;
}

// İlk 11 dışındaki en iyi n yedek (Bible-5.1 Derinlik: yedekOrt).
export function benchBest(squad, n = TUNING.POWER.YEDEK_COUNT, xi = idealXI(squad)) {
  const inXI = new Set(xi);
  return squad.filter((p) => !inXI.has(p)).sort(byOverallDesc).slice(0, n);
}
