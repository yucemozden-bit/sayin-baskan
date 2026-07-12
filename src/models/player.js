// src/models/player.js — Oyuncu modeli (Bible-4)
// Piyasa değeri + maaş formülleri birebir Bible-4. Kişilik/gizli nitelik alanları
// ŞEMADA VAR ama MVP'de KULLANILMAZ (V5-§12 kesimi; TAM/DELUXE'te devreye girer).
// Katsayılar config TUNING.PLAYER'dan okunur (hardcode yok).

import { TUNING } from '../config.js';
import { rand } from '../core/rng.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// base(ov) = VAL_BASE × VAL_GROWTH^(ov − VAL_REF_OV)   (Bible-4)
export function baseValue(overall) {
  const P = TUNING.PLAYER;
  return P.VAL_BASE * Math.pow(P.VAL_GROWTH, overall - P.VAL_REF_OV);
}

// ageFactor = clamp(AGE_BASE − |age−AGE_PEAK|×AGE_SLOPE, AGE_CLAMP)   (zirve 24 yaş)
// ASİMETRİK: zirve öncesi hafif iskonto (gençlik zaten potFactor primi alır),
// zirve sonrası SERT erime — genç iyi paraya satılır, yaş aldıkça bedel düşer.
export function ageFactor(age) {
  const P = TUNING.PLAYER;
  const slope = age <= P.AGE_PEAK ? (P.AGE_SLOPE_GENC ?? P.AGE_SLOPE ?? 0.02) : (P.AGE_SLOPE_YASLI ?? P.AGE_SLOPE ?? 0.07);
  return clamp(P.AGE_BASE - Math.abs(age - P.AGE_PEAK) * slope, P.AGE_CLAMP[0], P.AGE_CLAMP[1]);
}

// potFactor = 1 + max(0, potential − overall) × POT_COEF
export function potFactor(overall, potential) {
  return 1 + Math.max(0, potential - overall) * TUNING.PLAYER.POT_COEF;
}

// marketValue = base(overall) × ageFactor × potFactor   (mn TL)   (Bible-4)
export function marketValue(overall, age, potential) {
  return baseValue(overall) * ageFactor(age) * potFactor(overall, potential);
}

// wage (sezonluk, mn) = marketValue × rand(WAGE_RATIO)   ; haftalık = wage/52
export function wageFor(mv, rng = rand) {
  const [lo, hi] = TUNING.PLAYER.WAGE_RATIO;
  return mv * rng(lo, hi);
}

export class Player {
  constructor({ id, name, pos, overall, potential, age, contractYears = 3, personality = null, hidden = null, rng = null } = {}) {
    // — Bible-4 çekirdek —
    this.id = id;
    this.name = name;
    this.pos = pos;                 // "GK" | "DEF" | "MID" | "FWD"
    this.overall = overall;         // 30-95 mevcut güç
    this.potential = potential ?? overall; // overall..95 tavan
    this.age = age;                 // 16-38

    const P = TUNING.PLAYER;
    this.morale = P.MORALE_START;   // 0-100
    this.fitness = P.FITNESS_START; // kondisyon 0-100
    this.form = P.FORM_START;       // 0-100
    this.injuryWeeks = 0;
    this.suspensionWeeks = 0;
    this.onIntlDuty = false;

    this.marketValue = marketValue(this.overall, this.age, this.potential);
    this.wage = wageFor(this.marketValue, rng || undefined); // sezonluk mn (rng verilirse deterministik — ana akış kaymaz)
    this.contractYears = contractYears;

    // — V5-§12 kesimi: MVP'de KULLANILMAZ (şemada dursun) —
    // Kişilik tipi (V4-E1): Profesyonel|Hırslı|Sadık|Alevlenebilir|Lider|Kırılgan
    this.personality = personality;
    // Gizli nitelikler 1-20 (V3-A2) — sadece scout raporu cümlesiyle ima edilir
    this.hidden = hidden ?? {
      sakatlanmaYatkinligi: null,
      profesyonellik: null,
      basincaDayaniklilik: null,
      onemliMacPerformansi: null,
    };
    // Sosyal/dinamik (V4-E2/E3) — TAM katmanda hesaplanır
    this.hierarchy = 0;      // hiyerarşi puanı
    this.socialGroup = null; // sosyal grup id
    this.baskanaGuven = 50;  // 0-100
  }

  // Bible-4: isStar = overall >= STAR_THRESHOLD (config'ten)
  get isStar() {
    return this.overall >= TUNING.STAR_THRESHOLD;
  }

  // Değeri güncelle (yaş/gelişim değişince çağrılır)
  refreshValue() {
    this.marketValue = marketValue(this.overall, this.age, this.potential);
    return this.marketValue;
  }
}
