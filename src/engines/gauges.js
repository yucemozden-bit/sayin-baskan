// src/engines/gauges.js — 5 gauge + hedef sürücüleri + atalet (Bible-12)
// Her tick gauge'lar hesaplanan HEDEFE INERTIA kadar yaklaşır; İtibar daha yavaş
// (INERTIA_ITIBAR). Katsayılar TUNING'den; engines/ DOM'a dokunmaz.
// MVP notu: yıldız/vaat/kupa gibi ikincil sürücüler yoksa NEUTRAL (50) alınır.

import { TUNING } from '../config.js';
import { beklentiyeGoreSonuc } from './expectation.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Lig sıra skoru: 1. sıra → 100, son sıra → 0 (Bible-12)
export function ligSiraSkoru(myPos) {
  const n = TUNING.LEAGUE_TEAMS;
  return clamp((100 * (n - myPos)) / (n - 1), 0, 100);
}

// Bilet fiyatı memnuniyeti: fiyat 1.0 → 50 (nötr), ucuz → yüksek, pahalı → düşük.
export function biletFiyatMemnuniyeti(ticketPrice) {
  return clamp(TUNING.GAUGE.NEUTRAL - (ticketPrice - 1) * TUNING.GAUGE.PRICE_SATISF_SLOPE, 0, 100);
}

// Yıldız varlığı: kadrodaki yıldız sayısından türetilir (0-100).
export function yildizVarligi(squad = []) {
  const stars = squad.filter((p) => p.overall >= TUNING.STAR_THRESHOLD).length;
  return clamp(stars * TUNING.GAUGE.STAR_PRESENCE_K, 0, 100);
}

// — Hedef sürücüleri (Bible-12) —
export function targetSportif({ myPos, cupBonus = 0 }) {
  return clamp(ligSiraSkoru(myPos) + cupBonus, 0, 100);
}

export function targetTaraftar({ beklentiyeGoreSonuc: B, biletMemnun = TUNING.GAUGE.NEUTRAL,
  yildiz = TUNING.GAUGE.NEUTRAL, vaatUmudu = TUNING.GAUGE.NEUTRAL, boykotCezasi = 0 } = {}) {
  const W = TUNING.GAUGE.W_TARAFTAR;
  return clamp(W.beklenti * B + W.bilet * biletMemnun + W.yildiz * yildiz + W.vaat * vaatUmudu - boykotCezasi, 0, 100);
}

export function targetGuven({ sportif, mali, taraftar, vaatIlerleme = TUNING.GAUGE.NEUTRAL } = {}) {
  const W = TUNING.GAUGE.W_GUVEN;
  return clamp(W.sportif * sportif + W.mali * mali + W.taraftar * taraftar + W.vaat * vaatIlerleme, 0, 100);
}

// Tüm hedefleri hesapla. drivers, diğer motorların çıktısını taşır:
//   {myPos, cupBonus, maliHedef, vaatUmudu, vaatIlerleme, boykotCezasi, itibarHedef}
export function computeTargets(state, drivers) {
  const hedefSira = state.club.hedefSira ?? TUNING.EXPECT.HEDEF_SIRA[state.club.beklenti];
  const B = beklentiyeGoreSonuc(hedefSira, drivers.myPos);
  const sportif = targetSportif({ myPos: drivers.myPos, cupBonus: drivers.cupBonus ?? 0 });
  const taraftar = targetTaraftar({
    beklentiyeGoreSonuc: B,
    biletMemnun: biletFiyatMemnuniyeti(state.economy.ticketPrice),
    yildiz: yildizVarligi(state.squad),
    vaatUmudu: drivers.vaatUmudu,
    boykotCezasi: drivers.boykotCezasi ?? 0,
  });
  const mali = drivers.maliHedef;
  const guven = targetGuven({ sportif, mali, taraftar, vaatIlerleme: drivers.vaatIlerleme });
  // İtibar: itibar tabanına (reputation) beklenti-üstü sıra katkısı; INERTIA_ITIBAR ile yavaş.
  const itibarBase = drivers.itibarHedef ?? ((state.club.reputation ?? state.gauges.itibar) + TUNING.GAUGE.ITIBAR_ANCHOR_ADD);
  const itibar = clamp(itibarBase + TUNING.GAUGE.ITIBAR_OVERPERF_K * Math.max(0, B - TUNING.GAUGE.NEUTRAL), 0, 100);
  return { guven, taraftar, mali, sportif, itibar };
}

// Atalet: her gauge hedefe INERTIA kadar yaklaşır; İtibar INERTIA_ITIBAR ile (Bible-12).
// state.gauges'ı MUTASYONA uğratır.
export function applyInertia(gauges, targets) {
  for (const g of ['guven', 'taraftar', 'mali', 'sportif']) {
    gauges[g] += (targets[g] - gauges[g]) * TUNING.INERTIA;
  }
  gauges.itibar += (targets.itibar - gauges.itibar) * TUNING.INERTIA_ITIBAR;
  return gauges;
}
