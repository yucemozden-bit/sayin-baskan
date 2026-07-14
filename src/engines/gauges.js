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
  yildiz = TUNING.GAUGE.NEUTRAL, vaatUmudu = TUNING.GAUGE.NEUTRAL, boykotCezasi = 0, buyume = 0 } = {}) {
  const G = TUNING.GAUGE, W = G.W_TARAFTAR;
  const bekUstu = Math.max(0, B - G.NEUTRAL); // beklenti üstü sonuç → EK destek
  return clamp(W.beklenti * B + W.bilet * biletMemnun + W.yildiz * yildiz + W.vaat * vaatUmudu
    + G.TARAFTAR_OVERPERF_K * bekUstu + G.BUYUME_TARAFTAR_K * buyume - boykotCezasi, 0, 100);
}

export function targetGuven({ sportif, mali, taraftar, vaatIlerleme = TUNING.GAUGE.NEUTRAL, B = TUNING.GAUGE.NEUTRAL, buyume = 0 } = {}) {
  const G = TUNING.GAUGE, W = G.W_GUVEN;
  const bekUstu = Math.max(0, B - G.NEUTRAL); // beklenti üstü → kurul daha çok güvenir
  return clamp(W.sportif * sportif + W.mali * mali + W.taraftar * taraftar + W.vaat * vaatIlerleme
    + G.GUVEN_OVERPERF_K * bekUstu + G.BUYUME_GUVEN_K * buyume, 0, 100);
}

// Tüm hedefleri hesapla. drivers, diğer motorların çıktısını taşır:
//   {myPos, cupBonus, maliHedef, vaatUmudu, vaatIlerleme, boykotCezasi, itibarHedef}
export function computeTargets(state, drivers) {
  const hedefSira = state.club.hedefSira ?? TUNING.EXPECT.HEDEF_SIRA[state.club.beklenti];
  const B = beklentiyeGoreSonuc(hedefSira, drivers.myPos);
  // BÜYÜME (kadro değeri + güç) — sezon başı tabanına göre POZİTİF büyüme (0-1). Taban yoksa 0.
  const bazKD = state.club.kadroDegerBaz || state.club.kadroDeger || 1;
  const bazTG = state.temelGucBaz || state.temelGuc || 1;
  const buyume = clamp(((state.club.kadroDeger || bazKD) / bazKD - 1) * 0.55 + ((state.temelGuc || bazTG) / bazTG - 1) * 0.45, 0, 1);
  const sportif = targetSportif({ myPos: drivers.myPos, cupBonus: drivers.cupBonus ?? 0 });
  const taraftar = targetTaraftar({
    beklentiyeGoreSonuc: B,
    biletMemnun: biletFiyatMemnuniyeti(state.economy.ticketPrice),
    yildiz: yildizVarligi(state.squad),
    vaatUmudu: drivers.vaatUmudu,
    boykotCezasi: drivers.boykotCezasi ?? 0,
    buyume,
  });
  const mali = drivers.maliHedef;
  const guven = targetGuven({ sportif, mali, taraftar, vaatIlerleme: drivers.vaatIlerleme, B, buyume });
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
