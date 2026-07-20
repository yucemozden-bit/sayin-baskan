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

// GERÇEK GİZLİ REYTİNG: scout'un GÖRDÜĞÜ güç ≠ gerçek güç. Sapma deterministik
// (oyuncu|hafta|scoutLv) — aynı hafta aynı sayı (render'da zıplamaz, kayıt bozulmaz);
// yeni haftada gözlemci yeniden bakar, sayı hafif oynayabilir. Sorgu ±1'e daraltır,
// Derin Rapor gerçeği verir, GERÇEK ancak İMZADAN SONRA sahada ortaya çıkar.
export function shownRating(p, scoutLv = 0, week = 0) {
  const fog = Math.max(1, TUNING.FOG_BASE - scoutLv * TUNING.FOG_PER_SCOUT);
  const h = Math.ceil(fog / 2);
  const n = h32(String(p.id) + '|' + week + '|' + scoutLv);
  const sapma = (n % (2 * h + 1)) - h; // -h..+h deterministik gözlem hatası
  return { deger: Math.max(30, Math.min(99, p.overall + sapma)), h, sapma };
}

// TEK GÖRÜNÜM TÜRETİCİ: UI ham veriyi değil bunu okur — gerçek reyting UI'a SIZMAZ.
export function publicView(p, scoutLv = 0, week = 0) {
  const sr = shownRating(p, scoutLv, week);
  const ask = askingFee(p);
  return {
    id: p.id, name: p.name, pos: p.pos, age: p.age, contractYears: p.contractYears,
    shownRating: sr.deger, ratingLo: sr.deger - sr.h, ratingHi: sr.deger + sr.h, sis: sr.h,
    ask, askLo: Math.round(ask * (1 - 0.03 * sr.h)), askHi: Math.round(ask * (1 + 0.03 * sr.h)),
    ilgi: p._ilgi || 0, kalan: p._kalan ?? null, sorgu: p._sorgu || null, derin: p._derin || null,
  };
}

// DETERMİNİSTİK HAVUZ GENİŞLETİCİ: çekirdek (seed'li) pazarın üstüne hash tabanlı +N isim.
// pos verilirse o mevkide üretir (ilan sonucu havuz genişlemesi).
// band: [lo,hi] verilirse güç bandı ref+lo..ref+hi+scout olur (haftalık vitrin yıldızı yüksek banttan gelir)
export function extendMarketDet(refStrength, { names = null, scout = 0, count = 70, salt = 0, pos = null, exclude = null, band = null } = {}) {
  const POS = ['GK', 'DEF', 'MID', 'FWD'];
  const out = [];
  const sb = Math.round((scout || 0) * 1.5);
  for (let i = 0; i < count; i++) {
    const rng = mk(h32('mktx|' + salt + '|' + i) ^ Math.imul(refStrength + 11, 2654435761));
    const ri = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
    const ov = Math.max(35, Math.min(92, refStrength + (band ? ri(band[0], band[1] + sb) : ri(-9, 10 + sb))));
    const age = ri(18, 33);
    // İSİM ÇAKIŞMA ENGELİ (kullanıcı raporu 2026-07-21: kadrodaki "Osman Nas" için piyasa KLONU
    // üretilip alım dosyası gelmişti — "benim oyuncuma teklif mi soruyor?" karmaşası).
    // exclude (kadro isimleri) çakışırsa SOYADI determinist kaydır — rand tüketmez, hash kararlı.
    let name = 'Serbest ' + i;
    if (names) {
      const fi = ri(0, names.first.length - 1); let li = ri(0, names.last.length - 1);
      name = `${names.first[fi]} ${names.last[li]}`;
      for (let k = 0; exclude && exclude.has(name) && k < names.last.length; k++) {
        li = (li + 1) % names.last.length;
        name = `${names.first[fi]} ${names.last[li]}`;
      }
      if (exclude) exclude.add(name); // set MUTASYONA uğrar: aynı üretimde iç klon da doğmaz (2026-07-22)
    }
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
