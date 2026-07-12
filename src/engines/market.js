// src/engines/market.js — PİYASA MODÜLÜ (transfer-ekrani-inceleme A8):
// tek fiyat formülü (askingFee), tek görünüm türetici (publicView) ve deterministik
// havuz genişletici (extendMarketDet). Ana RNG'yi TÜKETMEZ — seed'li testler/kayıt kaymaz.
import { TUNING } from '../config.js';
import { Player } from '../models/player.js';

function h32(s) { let h = 0; const t = String(s); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return h; }
function mk(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// TEK FİYAT FORMÜLÜ: istenen bedel = taban × (1 + ilgi×0.12). Menajer tavrı pazarlıkta işler.
export function askingFee(p) {
  return Math.round((p.fee || p.marketValue || 0) * (1 + (p._ilgi || 0) * 0.12));
}

// TEK GÖRÜNÜM TÜRETİCİ: UI ham veriyi değil bunu okur (gerçek reyting sızmaz; MVP'de
// trueRating==overall, sis GÖRÜNÜMDE — ileride gizli reyting bu tek noktadan açılır).
export function publicView(p, scoutLv = 0) {
  const fog = Math.max(1, TUNING.FOG_BASE - scoutLv * TUNING.FOG_PER_SCOUT);
  const h = Math.ceil(fog / 2);
  const ask = askingFee(p);
  return {
    id: p.id, name: p.name, pos: p.pos, age: p.age, contractYears: p.contractYears,
    shownRating: p.overall, ratingLo: p.overall - h, ratingHi: p.overall + h, sis: h,
    ask, askLo: Math.round(ask * (1 - 0.03 * h)), askHi: Math.round(ask * (1 + 0.03 * h)),
    ilgi: p._ilgi || 0, kalan: p._kalan ?? null, sorgu: p._sorgu || null,
  };
}

// DETERMİNİSTİK HAVUZ GENİŞLETİCİ: çekirdek (seed'li) pazarın üstüne hash tabanlı +N isim.
// pos verilirse o mevkide üretir (ilan sonucu havuz genişlemesi).
export function extendMarketDet(refStrength, { names = null, scout = 0, count = 70, salt = 0, pos = null } = {}) {
  const POS = ['GK', 'DEF', 'MID', 'FWD'];
  const out = [];
  const sb = Math.round((scout || 0) * 1.5);
  for (let i = 0; i < count; i++) {
    const rng = mk(h32('mktx|' + salt + '|' + i) ^ Math.imul(refStrength + 11, 2654435761));
    const ri = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
    const ov = Math.max(35, Math.min(92, refStrength + ri(-9, 10 + sb)));
    const age = ri(18, 33);
    const name = names ? `${names.first[ri(0, names.first.length - 1)]} ${names.last[ri(0, names.last.length - 1)]}` : 'Serbest ' + i;
    const p = new Player({
      id: `mktx-${salt}-${i}`, name, pos: pos || POS[ri(0, 3)],
      overall: ov, potential: age < 24 ? Math.min(95, ov + ri(0, 8)) : ov,
      age, contractYears: ri(1, 4), rng,
    });
    const pr = TUNING.TRANSFER.PREMIUM;
    p.fee = p.marketValue * ((pr[0] + pr[1]) / 2);
    const mh = h32(String(p.id) + '|' + p.name);
    p._ilgi = mh % 4; p._kalan = 2 + ((mh >>> 4) % 4);
    out.push(p);
  }
  return out;
}
