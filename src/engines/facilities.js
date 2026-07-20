// src/engines/facilities.js — Tesisler (Bible-9)
// Yükseltme maliyeti = baseCost × max(1,L)^FAC_EXP (FAC_EXP=1.5). MVP: yükseltme anında biter
// (inşaat süresi Bible-9 detayı, TAM katmana ertelendi). State mutasyonu actions.js'te.

import { TUNING } from '../config.js';

export const FACILITIES = ['stadyum', 'antrenman', 'tibbi', 'akademi', 'scout', 'ticari'];

// L → L+1 yükseltme maliyeti (mn) — Bible-9. max(1,L): L0→1 de tam bedelli (0^1.5=0 bedava değil;
// bakım yıpranmasıyla tesis 1→0'a düşse bile yeniden yükseltme istismarı olmasın).
export function upgradeCost(tesis, level) {
  return TUNING.FAC_COST[tesis] * Math.pow(Math.max(1, level), TUNING.FAC_EXP);
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

// STADYUM KAPASİTESİ (kullanıcı tasarımı 2026-07-22): kapasiteyi SEVİYE belirler — config
// STAD_KAP.TABLO açık tablodur (çıpalar: sv2 9.000 · sv4 18.000 · sv7 35.000 · sv10 80.000),
// MEGA kompleks ×1.2. TEK KAYNAK: gişe geliri (economy.bilet) ve tüm ekranlar bunu okur;
// club.stadiumCapacity salt eski-kayıt/legacy alanı. Tier yalnız BAŞLANGIÇ seviyesini belirler.
export function stadKapasite(state) {
  const K = TUNING.STAD_KAP;
  const sv = Math.max(0, Math.min(K.TABLO.length - 1, state.facilities?.stadyum ?? 0));
  return Math.round(K.TABLO[sv] * (state.megaStad ? K.MEGA : 1) / 100) * 100;
}
