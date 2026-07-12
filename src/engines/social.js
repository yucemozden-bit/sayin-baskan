// src/engines/social.js — Sosyal medya simülasyonu (V5-6)
import { rand } from '../core/rng.js';
// sentiment(-100..100): taraftar gauge'ının HIZLI/oynak öncü göstergesi (atalet yok).
// sentiment = 0.5·son2maç + 0.2·biletAlgısı + 0.2·transferHeyecanı + 0.1·gündem

import { TUNING } from '../config.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// son2: son 2 maç puanı (0-6). ticketPrice, transferHype(0-100), gundem(-100..100)
export function computeSentiment({ son2puan = 3, ticketPrice = 1.0, transferHype = 50, gundem = 0 }) {
  const macSkoru = (son2puan / 6) * 200 - 100;            // 0-6 → -100..+100
  const biletAlgi = clamp(100 - (ticketPrice - 1) * 200, -100, 100); // ucuz→+, pahalı→−
  const transfer = transferHype * 2 - 100;               // 0-100 → -100..+100
  return clamp(0.5 * macSkoru + 0.2 * biletAlgi + 0.2 * transfer + 0.1 * gundem, -100, 100);
}

// Viral an (|etki|>eşik → %SOCIAL_VIRAL_P trend). Basit: büyük olay → viral post metni.
export function viralPost({ magnitude, positive }, rng = () => rand(0, 1)) {
  if (Math.abs(magnitude) < 6) return null;
  return positive ? 'Tribün coşkusu sosyalde trend oldu 🔥' : 'Taraftar tepkisi sosyalde patladı 😠';
}

// D8: haftalık akış — sentiment'e göre havuzdan 3 paylaşım + viral bayrağı (v5-§6).
// socialData: data/social.json. slots: {oyuncu, genç, vaat, sıra, rakip}
export function makeFeed(sentiment, socialData, slots = {}, rng = () => rand(0, 1)) {
  if (!socialData) return [];
  const S = TUNING.DELUXE.SOCIAL;
  const mood = sentiment > 20 ? 'pos' : sentiment < -20 ? 'neg' : 'notr';
  const mix = [mood, mood, rng() < 0.5 ? 'notr' : mood]; // 3 paylaşım, çoğunluk hakim duygu
  const posts = mix.map((m) => {
    const pool = socialData[m] || socialData.notr;
    let t = pool[Math.floor(rng() * pool.length)];
    t = t.replace(/\{(\w+)\}/g, (x, k) => slots[k] ?? '—');
    return { text: t, mood: m, viral: false };
  });
  if (Math.abs(sentiment) >= S.VIRAL_SENT && rng() < S.VIRAL_P) {
    posts[0] = { ...posts[0], viral: true, text: posts[0].text + (sentiment > 0 ? ' 🔥 [TREND]' : ' 😠 [TREND]') };
  }
  return posts;
}
