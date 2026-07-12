// src/engines/promises.js — Vaat sistemi (Bible-15)
// Dönem başında max MAX_PROMISES seçilir → anlık umut bonusu (Zorluk×HOPE_MULT),
// baselineSnapshot alınır; umut HOPE_DECAY ile söner. Dönem sonunda kept/broken
// etkileri sozTutma/taraftar/guven/rakip'e uygulanır. Katsayılar TUNING'den.

import { TUNING } from '../config.js';
import { sponsor, forma, uyelik } from './economy.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Vaat için baseline metriği anlık kaydet (dönem sonu karşılaştırması).
function snapshot(state) {
  let ticariHaft = 0;
  try { ticariHaft = sponsor(state) + forma(state) + uyelik(state); } catch { /* eksik state (test fixture) — 0 kalır */ }
  return {
    borc: state.economy?.borc,
    kadroDeger: state.club?.kadroDeger,
    stadyum: state.facilities?.stadyum,
    antrenman: state.facilities?.antrenman,
    tibbi: state.facilities?.tibbi,
    akademi: state.facilities?.akademi,
    scout: state.facilities?.scout,
    brandValue: state.club?.brandValue,
    fanCount: state.club?.fanCount,   // P14: marka = taraftar tabanı büyümesi
    ticariHaft,                        // P16: haftalık ticari gelir tabanı
  };
}

// Dönem başında vaat seç (max MAX_PROMISES). Anlık umut bonusu taraftara eklenir.
// promisesData: data/promises.json içindeki promises dizisi.
// Koşullu seçilebilirlik (v4.1-5): duruma uymayan vaat listede görünse de SEÇİLEMEZ.
export function isSelectable(state, id) {
  if (id === 'P02' && (state.economy?.borc ?? 0) < TUNING.P02_MIN_BORC) return false; // borçsuz kulüpte borçsuzluk vaadi olmaz
  if (id === 'P23' && (state.club?.hedefSira ?? 15) < 13) return false;               // ligde kalma: sadece küme hattı beklentisi
  return true;
}

export function selectPromises(state, ids, promisesData) {
  const filtered = ids.filter((id) => isSelectable(state, id));
  state.promises = filtered.slice(0, TUNING.MAX_PROMISES).map((id) => {
    const p = promisesData.find((x) => x.id === id);
    const hope = p.difficulty * TUNING.HOPE_MULT;
    state.gauges.taraftar = clamp(state.gauges.taraftar + hope, 0, 100); // anlık umut bonusu
    return { id, difficulty: p.difficulty, baselineSnapshot: snapshot(state), kept: null, hopeRemaining: hope };
  });
  return state.promises;
}

// Oyun ortasında (sezon içi) yeni söz ver. Anlık umut bonusu + baselineSnapshot buradan alınır;
// midTerm işaretli. Dönem sonu normal değerlendirilir (tutulmazsa yaptırım işler).
export function addMidPromise(state, id, promisesData) {
  if (!isSelectable(state, id)) return false;
  state.promises = state.promises || [];
  if (state.promises.some((pr) => pr.id === id && pr.kept === null)) return false; // zaten aktif
  const p = promisesData.find((x) => x.id === id);
  if (!p) return false;
  const hope = p.difficulty * TUNING.HOPE_MULT;
  state.gauges.taraftar = clamp(state.gauges.taraftar + hope, 0, 100); // anlık umut bonusu (el güçlenir)
  state.promises.push({ id, difficulty: p.difficulty, baselineSnapshot: snapshot(state), kept: null, hopeRemaining: hope, midTerm: true });
  return true;
}

// Umut bonusu her tick söner (HOPE_DECAY). Kalan umut inbox/analitik için izlenir.
export function decayPromiseHope(state) {
  for (const pr of state.promises || []) pr.hopeRemaining *= (1 - TUNING.HOPE_DECAY);
}
export function totalHope(state) {
  return (state.promises || []).reduce((s, pr) => s + pr.hopeRemaining, 0);
}

// Dönem sonunda vaatleri yargıla. keptMap: {id: bool}. Kept/broken etkileri uygulanır.
// Döner: {sozTutmaBirikim, tutulmayan (broken sayısı)}.
export function judgePromises(state, keptMap) {
  const K = TUNING.KEPT, B = TUNING.BROKEN;
  state.rival = state.rival || { attractiveness: 0 };
  let deltaSoz = 0, broken = 0;
  for (const pr of state.promises || []) {
    const kept = !!keptMap[pr.id];
    pr.kept = kept;
    const d = pr.difficulty;
    if (kept) {
      deltaSoz += d * K.soz;
      state.gauges.taraftar = clamp(state.gauges.taraftar + d * K.taraftar, 0, 100);
      state.gauges.guven = clamp(state.gauges.guven + d * K.guven, 0, 100);
    } else {
      broken++;
      deltaSoz -= d * B.soz;
      state.gauges.taraftar = clamp(state.gauges.taraftar - d * B.taraftar, 0, 100);
      state.gauges.guven = clamp(state.gauges.guven - d * B.guven, 0, 100);
      state.rival.attractiveness += d * B.rakip;
    }
  }
  state.sozTutmaBirikim = (state.sozTutmaBirikim || 0) + deltaSoz;
  return { sozTutmaBirikim: state.sozTutmaBirikim, tutulmayan: broken };
}
