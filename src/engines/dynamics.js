// src/engines/dynamics.js — Kişilik & dinamikler (V4-E) + birebir görüşme (V5-7)
// Kişilik atama, hiyerarşi/katman, moral yayılımı (grup + lider). Katsayılar makul MVP sabitleri.

import { rand, randint } from '../core/rng.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export const PERSONALITIES = ['Profesyonel', 'Hırslı', 'Sadık', 'Alevlenebilir', 'Lider', 'Kırılgan'];

// Doğuşta kişilik ata (V4-E1). Zaten varsa dokunma.
export function assignPersonalities(squad, rng = rand) {
  for (const p of squad) {
    if (!p.personality) p.personality = PERSONALITIES[randint(0, PERSONALITIES.length - 1)];
    if (p.kulupteYil == null) p.kulupteYil = randint(1, 6);
  }
  return squad;
}

// Hiyerarşi puanı (V4-E2): 0.4·overall + 0.3·(yıl×8) + 0.3·yaşFaktörü + liderBonus
export function hierarchy(p) {
  const yasFaktoru = clamp(100 - Math.abs(p.age - 29) * 4, 0, 100); // 29 civarı zirve
  const lider = p.personality === 'Lider' ? 20 : 0;
  return clamp(0.4 * p.overall + 0.3 * Math.min((p.kulupteYil || 1) * 8, 100) + 0.3 * yasFaktoru + lider, 0, 120);
}
export function katman(h) {
  return h > 75 ? 'Lider' : h > 60 ? 'Etkili' : h > 40 ? 'Çekirdek' : 'Genç';
}

// Moral yayılımı (V4-E2): her oyuncu takım ortalamasına %10 çekilir (grup çekimi).
// KORUNUMLU: toplam morali değiştirmez (dengeyi bozmaz) — sadece varyansı azaltır.
// K2 Kaptan kurumu: kaptan yayılım MERKEZİDİR — ortalamada ağırlığı ×1.4
// (Bible-E2'nin ertelenen "lider etkisi" kaptan üzerinden bağlandı; korunumlu kalır).
export function spreadMorale(squad, captainId = null, captainWeight = 1.4) {
  if (!squad.length) return squad;
  let sum = 0, wsum = 0;
  for (const p of squad) {
    const w = p.id === captainId ? captainWeight : 1;
    sum += p.morale * w; wsum += w;
  }
  const avg = sum / wsum;
  for (const p of squad) p.morale = clamp(p.morale + (avg - p.morale) * 0.10, 0, 100);
  return squad;
}

// Birebir görüşme (V5-7): yaklaşım × kişilik → moral etkisi (sonuç kesin gösterilmez; motor uygular).
const GORUSME = { Babacan: 4, Profesyonel: 6, Sert: -2 };
export function gorusme(player, yaklasim, rng = rand) {
  let delta = GORUSME[yaklasim] ?? 0;
  if (player.personality === 'Kırılgan' && yaklasim === 'Sert') delta -= 8;
  if (player.personality === 'Hırslı' && yaklasim === 'Profesyonel') delta += 4;
  if (player.personality === 'Sadık') delta += 2;
  delta += Math.round(rand(-2, 2));
  player.morale = clamp(player.morale + delta, 0, 100);
  return { delta, moral: player.morale };
}
