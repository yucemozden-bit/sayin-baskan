// src/engines/election.js — Seçim matematiği (Bible-16 + 16.1)
// Dönem sonu: 3 sezon karnesi SEASON_W ağırlıklı, 5 bileşen (sportif/taraftar/
// mali/itibar/söz), rakip çekiciliği (16.1), oyOranı. Katsayılar TUNING'den.
// Kampanya/münazara V5-§5 kesiminde (bu motor MVP çekirdeği).

import { TUNING } from '../config.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const N = TUNING.GAUGE.NEUTRAL;

// Lig sıra skoru: 1. → 100, son → 0 (Bible-16)
export function ligSkor(pos) {
  const n = TUNING.LEAGUE_TEAMS;
  return (100 * (n - pos)) / (n - 1);
}

// Kupa skoru (cap'li). season: {pos, champion, cup, europeWin, europeQual}
export function kupaSkor(s) {
  const C = TUNING.CUP_PTS;
  const raw = (s.champion ? C.lig : 0) + (s.cup ? C.kupa : 0) + (s.europeWin ? C.avrupaZafer : 0) + (s.europeQual ? C.avrupaKatilim : 0);
  return Math.min(raw, C.cap);
}

// Sportif karne: 3 sezon (ligSkor+kupaSkor) SEASON_W ağırlıklı, clamp 0-100 (Bible-16.2).
// KISMİ DÖNEM (canlı projeksiyon): sezonlar EN YENİ ağırlığa SAĞDAN hizalanır ve kullanılan ağırlıkla
// NORMALİZE edilir — böylece dönem başında tek (mevcut) sezon en yüksek ağırlığı alır, "hayalet" eksik
// sezonlar sportifi 5 kat düşürmez. 3 tam sezonda (dönem sonu seçimi) sonuç birebir AYNIdır (Σağırlık=1).
export function sportifKarne(seasons) {
  const W = TUNING.SEASON_W;
  if (!seasons || !seasons.length) return N; // veri yok → nötr (0 değil)
  const n = Math.min(seasons.length, W.length);
  const use = seasons.slice(-n);          // en yeni n sezon
  const wts = W.slice(W.length - n);      // ağırlıkları sona hizala (en yeni → en yüksek)
  let sum = 0, wsum = 0;
  use.forEach((s, i) => { sum += wts[i] * (ligSkor(s.pos) + kupaSkor(s)); wsum += wts[i]; });
  return clamp(sum / (wsum || 1), 0, 100);
}

// Mali karne: dönem başı vs sonu borç farkı + mali gauge (Bible-16)
export function maliKarne(state, baslangicBorc) {
  const ts = TUNING.TIER_SCALE[state.club.tier];
  const cap = TUNING.ELECTION.MALI_DEBT_CAP;
  const debtDelta = clamp((baslangicBorc - state.economy.borc) / ts, -cap, cap); // ±6 ile sınırlı
  const borcsuzBonus = state.economy.borc <= 0 ? (TUNING.ELECTION.BORCSUZ_MALI_BONUS || 0) : 0; // borçsuz kulüp sandıkta ödüllenir
  return clamp(N + debtDelta + (state.gauges.mali - N) * TUNING.ELECTION.MALI_GAUGE_W + borcsuzBonus, 0, 100);
}

// Söz tutma karnesi (Bible-16). 0 vaat → sozTutmaBirikim 0 → nötr 50.
export function sozKarne(state) {
  return clamp(N + (state.sozTutmaBirikim || 0), 0, 100);
}

// Rakip çekiciliği (Bible-16.1). components: hesaplanmış {sportif, taraftar, mali}.
export function rakipCekiciligi(state, { tutulmayanVaat = 0, sportif, taraftar, mali, kupasiz = false } = {}) {
  const R = TUNING.ELECTION, W = R.RIVAL_W;
  // Beklentiyi karşılayan kulüp (bileşenler ~ref) rakibe az koz verir; çöken boyut hâlâ besler.
  const zayifHane = clamp(R.RIVAL_ZAYIF_REF - Math.min(mali, taraftar, sportif), 0, 100);
  const ceza = Math.min(tutulmayanVaat * R.BROKEN_CEZA, 100);
  // Pozisyon gücü: rakibin en güçlü saldırı açısı (mali_kurtarıcı / şampiyonluk_vaadi / taraftar_dostu)
  const posMali = clamp((state.economy.borc / Math.max(state.club.kadroDeger || 1, 1)) * 100, 0, 100);
  const posTitle = kupasiz ? R.POS_TITLE : 0;
  const posPrice = state.economy.ticketPrice > R.POS_PRICE_THRESH
    ? (state.economy.ticketPrice - R.POS_PRICE_THRESH) * R.POS_PRICE_SCALE : 0;
  const pozisyon = Math.max(posMali, posTitle, posPrice);
  // Birikmiş çekicilik (Bible-15 BROKEN.rakip + sızıntılar + kampanya baskısı) — D6 ile bağlandı
  const birikim = (state.rival?.attractiveness || 0) * TUNING.ELECTION.ATTR_W;
  return clamp(W.zayif * zayifHane + W.ceza * ceza + W.pozisyon * pozisyon + birikim, 0, 100);
}

// Oy oranı çekirdek formülü (Bible-16). Bileşenler 0-100; döner 0-1.
export function oyOrani({ sportif, taraftar, mali, itibar, soz, rival }) {
  const W = TUNING.ELECT_W;
  const raw = W.sportif * sportif + W.taraftar * taraftar + W.mali * mali + W.itibar * itibar + W.soz * soz
    - rival * TUNING.RIVAL_FACTOR;
  return clamp(raw, 0, 100) / 100;
}

// Tam seçim (Bible-16). opts: {baslangicBorc, tutulmayanVaat}. history son 3 sezon.
export function eleksiyon(state, { baslangicBorc, tutulmayanVaat = 0 } = {}) {
  const H = state.history.seasons.slice(-TUNING.SEASONS_PER_TERM);
  const sportif = sportifKarne(H);
  const taraftar = state.gauges.taraftar;
  const mali = maliKarne(state, baslangicBorc ?? state.economy.borc);
  const itibar = state.gauges.itibar;
  const soz = sozKarne(state);
  const kupasiz = !H.some((s) => s.champion || s.cup || s.europeWin);
  const rival = rakipCekiciligi(state, { tutulmayanVaat, sportif, taraftar, mali, kupasiz });
  const oy = oyOrani({ sportif, taraftar, mali, itibar, soz, rival });
  return { oyOrani: oy, kazandi: oy > TUNING.WIN_LINE, breakdown: { sportif, taraftar, mali, itibar, soz, rival } };
}
