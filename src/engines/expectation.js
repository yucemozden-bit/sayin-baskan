// src/engines/expectation.js — Beklenti / göreceli başarı (Bible-13)
// hedefSıra artık SAYISAL (eskalasyon merdiveni ile dönemler arası değişir).
// beklentiyeGöreSonuç: hedef sıraya göre performans. Katsayı TUNING'den (zorlukla değişir).

import { TUNING } from '../config.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Tier başlangıç hedef sırası (etiketten).
export function hedefSiraOf(beklenti) {
  return TUNING.EXPECT.HEDEF_SIRA[beklenti];
}

// beklentiyeGöreSonuç = clamp(50 + (hedefSıra − myPos) × EXPECT_DELTA_K, 0, 100)
export function beklentiyeGoreSonuc(hedefSira, myPos, cfg = TUNING) {
  return clamp(TUNING.GAUGE.NEUTRAL + (hedefSira - myPos) * cfg.EXPECT_DELTA_K, 0, 100);
}

// Eskalasyon (Bible-13 merdiveni): dönem ort. sıra hedeften belirgin sapıyorsa kademe kaydır.
// Döner: yeni hedefSıra.
export function escalateHedef(hedefSira, avgFinish) {
  const L = TUNING.EXPECT.LADDER, m = TUNING.EXPECT.ESCALATE_MARGIN;
  let idx = L.indexOf(hedefSira);
  if (idx < 0) { // en yakın kademe
    idx = L.reduce((best, v, i) => (Math.abs(v - hedefSira) < Math.abs(L[best] - hedefSira) ? i : best), 0);
  }
  if (avgFinish <= hedefSira - m && idx < L.length - 1) idx++;       // belirgin ÜSTÜ → zorlaş
  else if (avgFinish >= hedefSira + m && idx > 0) idx--;             // belirgin ALTI → kolaylaş
  return L[idx];
}
