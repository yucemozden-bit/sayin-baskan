// src/engines/campaign.js — Seçim kampanyası mini-fazı (V5-5)
// Canlı oy projeksiyonu (eleksiyon formülünü mevcut state ile koşar) + KP harcama aksiyonları.
// Kampanya toplam etkisi maks ±CAMPAIGN.maxSwing (3 sezonluk emek > 3 haftalık şov).

import { TUNING } from '../config.js';
import { rand } from '../core/rng.js';
import { eleksiyon } from './election.js';

// "Bugün seçim olsa": mevcut karnelerle oy oranı (V3-C8 trend).
export function voteProjection(state, opts = {}) {
  return eleksiyon(state, { baslangicBorc: state.termStartBorc ?? state.economy.borc, tutulmayanVaat: opts.tutulmayanVaat ?? 0 });
}

// KP harcama aksiyonları (V5-5). Her biri küçük, tavanlı etki.
export const CAMPAIGN_ACTIONS = {
  delegeYemegi: { kp: 1, label: 'Delege yemeği', desc: 'Kurul/delege gönlü alınır (güven +)', apply: (s) => { s.gauges.guven = clamp(s.gauges.guven + 3, 0, 100); } },
  taraftarMitingi: { kp: 1, label: 'Taraftar mitingi', desc: 'Tribün coşar (taraftar +)', apply: (s) => { s.gauges.taraftar = clamp(s.gauges.taraftar + 3, 0, 100); } },
  basinTuru: { kp: 1, label: 'Basın turu', desc: 'Medya tonu yumuşar', apply: (s) => { s.mediaTone = (s.mediaTone || 0) + 0.5; } },
  projeLansmani: { kp: 2, label: 'Proje lansmanı', desc: 'Maket + render: vaat inandırıcılığı (taraftar+güven)', apply: (s) => { s.gauges.taraftar = clamp(s.gauges.taraftar + 2, 0, 100); s.gauges.guven = clamp(s.gauges.guven + 2, 0, 100); } },
  negatifKampanya: { kp: 2, label: 'Negatif kampanya', desc: 'Rakibin geçmişi (%35 geri teper)', apply: (s) => {
    if ((s._negRoll ?? rand(0, 1)) < 0.35) { s.rival.attractiveness += 5; s.gauges.itibar = clamp(s.gauges.itibar - 3, 0, 100); s._negBackfire = true; }
    else { s.rival.attractiveness = Math.max(0, s.rival.attractiveness - 8); s._negBackfire = false; }
  } },
};

// ── MÜNAZARA (v5-§5): 4 soru — en zayıf 2 + en güçlü 1 + rastgele 1 bileşen ──
// Her cevap tonu × gerçek karne = ±PER_Q; toplam ±MAX. Katılmamak: skipDebate cezası.
const COMP_TR = { sportif: 'sportif karne', taraftar: 'taraftar desteği', mali: 'mali tablo', itibar: 'kulüp itibarı', soz: 'söz tutma sicili' };

export function buildDebate(breakdown, rng = () => rand(0, 1)) {
  const comps = ['sportif', 'taraftar', 'mali', 'itibar', 'soz'];
  const sorted = comps.slice().sort((a, b) => breakdown[a] - breakdown[b]);
  const qs = [sorted[0], sorted[1], sorted[4]];
  const kalan = comps.filter((c) => !qs.includes(c));
  qs.push(kalan[Math.floor(rng() * kalan.length)]);
  return qs.map((c) => ({ comp: c, label: COMP_TR[c], value: breakdown[c] }));
}

// Cevap puanla: 'veri' güçlü konuda işler, zayıf konuda GERİ TEPER; 'vizyon' güvenli küçük;
// 'saldiri' rakip çekiciliği yüksekse tutar, düşükse çamur elde kalır.
export function scoreDebateAnswer(q, ton, rivalAttr) {
  const D = TUNING.DELUXE.DEBATE;
  if (ton === 'veri') return q.value >= D.THRESH ? D.PER_Q : -D.PER_Q;
  if (ton === 'vizyon') return D.VIZYON;
  if (ton === 'saldiri') return rivalAttr >= D.RIVAL_HIGH ? D.SALDIRI_OK : D.SALDIRI_MISS;
  return 0;
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Kampanya aksiyonu uygula (KP yeterse). Toplam kayma CAMPAIGN.maxSwing ile sınırlı.
export function applyCampaignAction(state, key) {
  const a = CAMPAIGN_ACTIONS[key];
  if (!a) return { ok: false };
  state.campaign = state.campaign || { kp: TUNING.CAMPAIGN.kpPerTick, swing: 0 };
  if (state.campaign.kp < a.kp || state.campaign.swing >= TUNING.CAMPAIGN.maxSwing) return { ok: false };
  a.apply(state);
  state.campaign.kp -= a.kp;
  state.campaign.swing += 1;
  return { ok: true };
}
