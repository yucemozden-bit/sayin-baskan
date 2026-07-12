// src/engines/facilities.js — Tesisler (Bible-9)
// Yükseltme maliyeti = baseCost × L^1.6. MVP: yükseltme anında biter (inşaat süresi
// Bible-9 detayı, TAM katmana ertelendi). State mutasyonu actions.js'te.

import { TUNING } from '../config.js';

export const FACILITIES = ['stadyum', 'antrenman', 'tibbi', 'akademi', 'scout', 'ticari'];

// L → L+1 yükseltme maliyeti (mn) — Bible-9
export function upgradeCost(tesis, level) {
  return TUNING.FAC_COST[tesis] * Math.pow(level, TUNING.FAC_EXP);
}

// Efektif indirim çarpanı (1 = indirim yok · 0.7 = %30 ucuz). İki kaynak birleşir:
//  • senaryo belediye desteği (tesisIndirim, yalnız 1. dönem, tüm tesisler)
//  • K1 olay kartı indirimi (belediye-arsa/arsa-indirimi) — kapsam: 'term' | 'season'
export function facilityDiscountMult(state, tesis) {
  let mult = 1;
  if (state.tesisIndirim && state.meta && state.meta.term === 1) mult *= state.tesisIndirim; // B4a
  const fd = state.facilityDisc && state.facilityDisc[tesis];
  if (fd && state.meta && fd.term === state.meta.term && (fd.scope === 'term' || fd.season === state.meta.season)) {
    mult *= (1 - fd.disc); // disc = indirim oranı (0.3 → %30 ucuz)
  }
  return mult;
}

// İndirim dahil efektif yükseltme maliyeti — tek doğruluk kaynağı (UI + ihale aynı sayıyı görür)
export function effectiveUpgradeCost(state, tesis) {
  return upgradeCost(tesis, state.facilities[tesis]) * facilityDiscountMult(state, tesis);
}

// Yükseltilebilir mi? (max seviye + kasa yeter + bütçe kilidi yok) — indirimli maliyetle
export function canUpgrade(state, tesis) {
  const lvl = state.facilities[tesis];
  if (lvl >= TUNING.TRANSFER.FAC_MAX) return false;
  if (state.flags && state.flags.budgetLock > 0) return false;
  return state.economy.kasa >= effectiveUpgradeCost(state, tesis);
}

// Stadyum kapasitesi (Bible-9: 12000 + L×4000)
export function stadiumCapacity(level) {
  return 12000 + level * 4000;
}
