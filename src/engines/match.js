// src/engines/match.js — Maç motoru (Bible-6)
//   simulateMatch: MaçGücü → xG paylaşımı (SHARPNESS_K) → Poisson skor
//   sigmoidResult: skorsuz olasılık fallback (ayrı fonksiyon)
//   postMatch: form/moral/fitness/sakatlık/kart güncellemesi
// Katsayılar TUNING'den; engines/ DOM'a dokunmaz. RNG core/rng'den (test edilebilir).

import { TUNING } from '../config.js';
import { rand, randint } from '../core/rng.js';
import { idealXI } from '../models/squad.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const random01 = () => rand(0, 1);

// Poisson (Knuth); λ QA-§6 gereği kırpılır.
export function poisson(lambda, rng = random01) {
  const lam = Math.min(Math.max(lambda, 0), TUNING.MATCH.POISSON_CAP);
  const L = Math.exp(-lam);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

// Ana motor (Bible-6): iki MaçGücü'nden xG paylaşımı + Poisson skor.
// opts.baseGoals: toplam gol beklentisi override (v4.1 "kalemizi koruyalım" telkini T×0.7 kullanır).
// opts.tiltH / opts.tiltA: KADRO YÖNÜ çarpanı (power.atakSavunma) — o tarafın ATTIĞI xG'yi ölçekler.
// Varsayılan 1 → AI-AI lig maçları ve eski çağrılar birebir eski davranış.
export function simulateMatch(homeMG, awayMG, rng = random01, opts = {}) {
  const k = TUNING.SHARPNESS_K, T = opts.baseGoals ?? TUNING.BASE_GOALS;
  const hp = Math.pow(Math.max(homeMG, 0), k);
  const ap = Math.pow(Math.max(awayMG, 0), k);
  const hShare = hp / Math.max(hp + ap, 1e-9);
  const xgH = T * hShare * (opts.tiltH ?? 1), xgA = T * (1 - hShare) * (opts.tiltA ?? 1);
  const gH = poisson(xgH, rng), gA = poisson(xgA, rng);
  return { gH, gA, xgH, xgA, result: gH > gA ? 'W' : gH < gA ? 'L' : 'D' };
}

// D5 (v3-H): Maç highlight'ları — gol/kaçan/tansiyon kartları media.json ticker havuzundan.
// Döner: [{min, side:'biz'|'onlar'|'-', text, type}] dakika sıralı; momentum = xG payı.
export function generateHighlights(res, { myGoals, oppGoals, xgFor, xgAgn }, media, players = [], rng = random01) {
  const T = (media && media.ticker) || {};
  const pick = (arr) => arr[Math.floor(rng() * arr.length)] || '';
  const pname = () => { const p = players[Math.floor(rng() * Math.max(players.length, 1))]; return (p && p.name) || 'oyuncumuz'; };
  const M = TUNING.DELUXE.MATCH3;
  const hls = [];
  const mins = [];
  const uniqMin = () => { let m; do { m = 3 + Math.floor(rng() * 88); } while (mins.includes(m)); mins.push(m); return m; };
  for (let i = 0; i < myGoals; i++) hls.push({ min: uniqMin(), side: 'biz', type: 'gol', text: fill(pick(T.gol || ['{dk}\' GOL!']), uniqSafe(pname())) });
  for (let i = 0; i < oppGoals; i++) hls.push({ min: uniqMin(), side: 'onlar', type: 'gol', text: fill(pick(T.gol || ['{dk}\' GOL!']), 'rakip oyuncu') });
  const target = Math.min(M.HL_MAX, Math.max(M.HL_MIN, myGoals + oppGoals + 3));
  while (hls.length < target) {
    const kind = rng() < 0.6 ? 'kacan' : 'tansiyon';
    hls.push({ min: uniqMin(), side: kind === 'kacan' ? (rng() < 0.5 ? 'biz' : 'onlar') : '-', type: kind, text: fill(pick(T[kind] || ['{dk}\' tempo yüksek']), pname()) });
  }
  hls.sort((a, b) => a.min - b.min);
  for (const h of hls) h.text = h.text.replace('{dk}', h.min);
  return hls;
  function fill(t, name) { return t.replace('{oyuncu}', name); }
  function uniqSafe(n) { return n; }
}

// Sigmoid fallback (Bible-6): skorsuz sonuç olasılıkları.
//   Δ = homeMG − awayMG ; P(kazan)=1/(1+10^(−Δ/25)) ; P(beraberlik)=0.28·e^(−(Δ/18)²)
// Beraberlik dışı kalan olasılık ev/deplasman arasında sigmoid ile paylaşılır.
export function sigmoidResult(homeMG, awayMG, rng = random01) {
  const d = homeMG - awayMG;
  const pDraw = TUNING.DRAW_BASE * Math.exp(-Math.pow(d / TUNING.DRAW_WIDTH, 2));
  const pHomeDecisive = 1 / (1 + Math.pow(10, -d / TUNING.SIGMOID_DIV));
  const pHome = (1 - pDraw) * pHomeDecisive;
  const pAway = (1 - pDraw) * (1 - pHomeDecisive);
  const r = rng();
  const result = r < pHome ? 'W' : r < pHome + pDraw ? 'D' : 'L';
  return { result, pHome, pDraw, pAway };
}

// Maç sonrası oyuncu güncellemesi (Bible-6). squad'ı MUTASYONA uğratır.
// res: "W"|"D"|"L" (benim takımım açısından). facilities.tibbi sakatlığı yumuşatır.
export function postMatch(squad, res, facilities = {}, rng = random01) {
  const M = TUNING.MATCH, PL = TUNING.PLAYER;
  const tibbi = facilities.tibbi ?? TUNING.POWER.FAC_REF;
  const xi = new Set(idealXI(squad));
  const played = [];

  // 1) Kondisyon/form/moral (oynayanlar düşer, yedekler toparlanır)
  // Antrenman tesisi dinlenmeyi HIZLANDIRIR ("kondisyon çabuk toparlar" vaadi artık gerçek —
  // sv başına +FIT_ANT/maç; sv10'da yedek maç başına +4 ekstra toparlar)
  const antRest = (facilities.antrenman || 0) * (TUNING.FIT_ANT || 0);
  for (const p of squad) {
    if (xi.has(p)) {
      played.push(p);
      p.fitness = clamp(p.fitness - TUNING.FIT_DROP, 0, 100);
      // DIP FRENİ (2026-07-22): eşiğin altındaki oyuncuda yenilgi kaybı yarıya iner —
      // kötü seri kendini beslemesin ("dibe vuran daha fazla düşmez"). Kazanç deltaları aynı.
      const DF = TUNING.DIP_FREN || {};
      const dForm = TUNING.FORM_D[res], dMoral = TUNING.MORALE_D[res];
      p.form = clamp(p.form + (dForm < 0 && p.form < (DF.form ?? 0) ? dForm / 2 : dForm), 0, 100);
      p.morale = clamp(p.morale + (dMoral < 0 && p.morale < (DF.moral ?? 0) ? dMoral / 2 : dMoral), 0, 100);
    } else {
      p.fitness = clamp(p.fitness + TUNING.FIT_REST + antRest, 0, 100);
    }
  }

  // 2) Mevcut sakatlık/ceza sürelerini azalt (bu hafta geçti)
  for (const p of squad) {
    if (p.injuryWeeks > 0) p.injuryWeeks--;
    if (p.suspensionWeeks > 0) p.suspensionWeeks--;
  }

  // 3) YENİ sakatlık/kart — azaltma döngüsünden SONRA atanır ki AYNI tick azalmasın;
  //    böylece "1 haftalık sakatlık tam 1 maç kaçırtır" (Bible sıra hatası düzeltildi).
  for (const p of played) {
    const risk = TUNING.INJURY_BASE
      * (1 - tibbi * M.INJURY_TIBBI_RISK)
      * (1 + (PL.FITNESS_START - p.fitness) / M.INJURY_FITNESS_DIV);
    if (rng() < risk) {
      p.injuryWeeks = M.INJURY_DUR_MIN + Math.floor(rng() * M.INJURY_DUR_BASE * (1 - tibbi * M.INJURY_TIBBI_DUR));
    }
  }
  if (played.length && rng() < TUNING.RED_CARD_P) {
    const victim = played[Math.floor(rng() * played.length)];
    victim.suspensionWeeks = randint(M.RED_SUSP[0], M.RED_SUSP[1]);
  }

  return { playedCount: played.length };
}
