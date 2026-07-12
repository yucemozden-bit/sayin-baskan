// src/engines/narrative.js — Anlatı motoru (V3-D + V4-7)
// Etiket seçimi (D1) → media.json manşet havuzundan şablon (D2), 6 hafta tekrar YOK (V4-§7.1).
// Slotlar basitçe doldurulur. State'e headlineMem yazar (tekrar denetimi için).

import { TUNING } from '../config.js';
import { rand } from '../core/rng.js';

// Anlatı etiketi (V3-D1, MVP sadeleştirmesi). ctx: {myPos, gauges, son5puan}
export function selectTag(ctx) {
  const { myPos, gauges: g, son5puan = 6, week = 0 } = ctx;
  if (myPos <= 2 && week > 10) return 'SAMPIYONLUK_YARISI';
  if (g.mali < 25) return 'BORC_BATAGI';
  if (son5puan <= 3 || myPos >= 16) return 'KRIZ_KULUBU';
  if (myPos <= 6 && ctx.oncekiSezonKotu) return 'YENIDEN_DOGUS';
  return 'NORMAL';
}

// Manşet üret: media.headlines[tag] havuzundan, son 6 hafta içinde kullanılmamış (V4-§7.1).
// state.headlineMem = [{sig, week}]. Döner: {text, tone} (slotlar doldurulmuş).
export function makeHeadline(state, media, tag, week, slots = {}) {
  const pool = media.headlines[tag] || media.headlines.NORMAL;
  state.headlineMem = (state.headlineMem || []).filter((r) => week - r.week < 6);
  const used = new Set(state.headlineMem.map((r) => r.sig));
  const avail = pool.filter((h) => !used.has(h.text));
  const src = avail.length ? avail : pool; // hepsi kullanıldıysa mecburen tekrar
  const pick = src[Math.floor(rand(0, 1) * src.length)];
  state.headlineMem.push({ sig: pick.text, week });
  return { text: fillSlots(pick.text, slots), tone: pick.tone, tag, sig: pick.text };
}

function fillSlots(text, s) {
  return text.replace(/\{(\w+)\}/g, (m, k) => (s[k] != null ? s[k] : '—'));
}

// Haftalık teknik rapor (v4.1-1 + v4.3 ŞİDDET KADEMESİ): en zayıf çarpan ana konu;
// şablon, açığın ŞİDDETİNE göre hafif/orta/ağır havuzundan seçilir — GM asla abartmaz.
// 6-hafta tekrar YOK: aynı kademede şablon tükenirse komşu kademeye, o da biterse
// sonraki konuya kayar → 4 konu × 3 kademe × 2 + iyi 4 = 28 şablon, tekrar imkânsız.
// deficits: [{key, deficit, sev?, slots?}] — sev verilmezse eşiklerden hesaplanır.
export function makeReport(state, media, deficits, week) {
  const pools = media.reports || {};
  const R = TUNING.REPORT;
  const sevOf = (d) => d.sev || (d.deficit >= R.SEV.agir ? 'agir' : d.deficit >= R.SEV.orta ? 'orta' : 'hafif');
  const order = deficits.slice().sort((a, b) => b.deficit - a.deficit);
  const healthy = !order.length || order[0].deficit < R.OK_EPS;
  state.reportMem = (state.reportMem || []).filter((r) => week - r.week < 6);
  const used = new Set(state.reportMem.map((r) => r.sig));
  const fill = (t, d) => t.replace(/\{(\w+)\}/g, (m, k) => (d && d.slots && d.slots[k]) || 'oyuncumuz');

  const tryPool = (arr, topic, sev, d) => {
    const avail = (arr || []).filter((x) => !used.has(x));
    if (!avail.length) return null;
    const pick = avail[Math.floor(rand(0, 1) * avail.length)];
    state.reportMem.push({ sig: pick, week });
    return { topic, sev, text: fill(pick, d), sig: pick, healthy };
  };

  const topicOrder = healthy ? [{ key: 'iyi' }, ...order] : [...order, { key: 'iyi' }];
  for (const d of topicOrder) {
    const pool = pools[d.key];
    if (!pool) continue;
    if (Array.isArray(pool)) { const r = tryPool(pool, d.key, null, d); if (r) return r; continue; } // 'iyi'
    const sev = sevOf(d);
    // ÇELİK 4d düzeltmesi: kayma yalnız AŞAĞI — hiçbir kademe yukarı tırmanmaz ("GM asla abartmaz").
    // Eski ring orta→['orta','hafif','agir'] idi: havuz tükenince 2 sakatta "kalabalık" basıyordu.
    const ring = sev === 'agir' ? ['agir', 'orta', 'hafif'] : sev === 'orta' ? ['orta', 'hafif'] : ['hafif'];
    for (const s of ring) { const r = tryPool(pool[s], d.key, s, d); if (r) return r; }
  }
  const fallback = (pools.iyi || [''])[0];
  state.reportMem.push({ sig: fallback, week });
  return { topic: 'iyi', sev: null, text: fallback, sig: fallback, healthy };
}

// Medya tonu: son manşetlerin hareketli ortalaması (V3-D2). state.mediaTone güncellenir.
export function updateMediaTone(state, tone) {
  const mem = state.toneMem = (state.toneMem || []);
  mem.push(tone);
  if (mem.length > TUNING.HEADLINE_MEMORY) mem.shift();
  state.mediaTone = mem.reduce((a, b) => a + b, 0) / mem.length;
  return state.mediaTone;
}
