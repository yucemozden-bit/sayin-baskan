// src/engines/transfer.js — Transfer (Bible-11 MVP)
// Piyasa hedefi üretimi + bedel/teklif hesabı. Pencere yalnız sezon başı ve devre arası.
// State mutasyonu (al/sat) actions.js'te; burası saf hesap + üretim.

import { TUNING } from '../config.js';
import { rand, randint } from '../core/rng.js';
import { Player } from '../models/player.js';

// Pencere açık mı? Onay akışıyla (Başkanlık Hissi §1) pencere WINDOW_SPAN hafta sürer
// (1-4 ve 17-20): GM dosyaları, şartlı pazarlık turları ve satış teklifleri bu aralıkta akar.
export function windowOpen(week) {
  const span = TUNING.APPROVAL?.WINDOW_SPAN ?? 1;
  return TUNING.TRANSFER.WINDOWS.some((s) => week >= s && week < s + span);
}

// Alım bedeli = marketValue × premium (Bible-11)
export function transferFee(player) {
  return player.marketValue * rand(TUNING.TRANSFER.PREMIUM[0], TUNING.TRANSFER.PREMIUM[1]);
}

// Satış teklifi = marketValue × rand(0.8,1.3)
export function saleOffer(player) {
  return player.marketValue * rand(TUNING.TRANSFER.SALE[0], TUNING.TRANSFER.SALE[1]);
}

// Alım koşulu: pencere + peşinat (kasa ≥ bedel×0.3) + tahta yok (Bible-11)
export function canBuy(state, fee) {
  return !(state.flags && state.flags.transferBan > 0) && state.economy.kasa >= fee * TUNING.TRANSFER.DEPOSIT;
}

// Kulüp seviyesine göre piyasa hedefleri (bazıları takviye kalitesinde).
export function generateMarket(refStrength, { names = null, size = TUNING.TRANSFER.MARKET_SIZE, scout = 0 } = {}) {
  const POS = ['GK', 'DEF', 'MID', 'FWD'];
  // Gözlemci ağı (scout tesisi) geliştikçe daha yüksek tavanlı oyuncular bulunur.
  // NOT: randint çağrı SAYISI değişmez (sadece üst sınır) → seed'li akış kaymaz.
  const scoutBonus = Math.round((scout || 0) * 1.5);
  const list = [];
  for (let i = 0; i < size; i++) {
    const overall = Math.round(Math.max(35, Math.min(92, refStrength + randint(-6, 10 + scoutBonus))));
    const age = randint(18, 32);
    const potential = age < 24 ? Math.min(95, overall + randint(0, 8)) : overall;
    const p = new Player({
      id: 'mkt' + i, name: pickName(names, i), pos: POS[randint(0, 3)],
      overall, potential, age, contractYears: randint(1, 4),
    });
    p.fee = transferFee(p);
    list.push(p);
  }
  // Her pencerede 1 "marquee" yıldız (80-85) — pahalı; zengin/borçlanan kulüp kapabilir.
  // Yıldız → taraftar kanalı (yildizVarligi) bu sayede orta kulüplerde de tetiklenebilir.
  const star = new Player({
    id: 'mkt-star', name: pickName(names, size), pos: POS[randint(0, 3)],
    overall: randint(80, 85), potential: randint(82, 88), age: randint(24, 29), contractYears: randint(2, 4),
  });
  star.fee = transferFee(star);
  list.push(star);
  return list.sort((a, b) => b.overall - a.overall);
}

function pickName(names, i) {
  if (!names) return 'Serbest Oyuncu ' + (i + 1);
  if (rand(0, 1) < 0.3 && names.foreign) {
    const pool = Object.values(names.foreign)[randint(0, 2)];
    return pool[randint(0, pool.length - 1)];
  }
  return `${names.first[randint(0, names.first.length - 1)]} ${names.last[randint(0, names.last.length - 1)]}`;
}
