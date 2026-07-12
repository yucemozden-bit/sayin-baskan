// src/engines/press.js — Basın toplantısı / demeç (V3-F)
// 4 ton; anlık gauge/ekonomi etkileri + medya tonu. State mutasyonu burada (events/promises gibi).

import { TUNING } from '../config.js';
import { rand } from '../core/rng.js';

export const TONES = ['iddiali', 'sakin', 'savunmaci', 'atesli'];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Demeç uygula. Döner: {tone, pfdk, ceza} özeti (inbox için).
export function applyDemec(state, tone, rng = rand) {
  const P = TUNING.PRESS[tone];
  if (!P) return { tone, ok: false };
  const g = state.gauges;
  if (P.taraftar) g.taraftar = clamp(g.taraftar + P.taraftar, 0, 100);
  if (P.guven) g.guven = clamp(g.guven + P.guven, 0, 100);
  if (P.itibar) g.itibar = clamp(g.itibar + P.itibar, 0, 100);
  if (P.kimya && state.kimya) state.kimya.kimya = clamp(state.kimya.kimya + P.kimya, 0, 100);
  if (P.mediaTone) state.mediaTone = (state.mediaTone || 0) + P.mediaTone;
  if (P.hype) state.transferHype = clamp((state.transferHype ?? 50) + P.hype, 0, 100); // sönümlenen heyecan kanalı

  let pfdk = false, ceza = 0;
  if (P.pfdkChance && rng(0, 1) < P.pfdkChance) {
    pfdk = true;
    ceza = rng(P.pfdkCost[0], P.pfdkCost[1]);
    state.economy.kasa -= ceza;
    state.atesliCount = (state.atesliCount || 0) + 1;
  }
  return { tone, pfdk, ceza };
}
