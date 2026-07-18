// src/core/sound.js — Ses & Juice (v4-§11 + ÇELİK 5d): 12 efekt, WebAudio SENTEZ.
// 5d POLİSH: efekt/ambiyans AYRI kanal · göreli miks tablosu (gol > tık) ·
// eşzamanlılık kapısı (aynı anda en fazla 3 ses; fazlası önceliğe göre elenir).
// Varsayılan %60; kapatılabilir. Başsız ortamda (test/node) sessizce devre dışı.

const S = { volume: 0.6, ambience: 0.5, enabled: true, ctx: null, aktif: 0 };
const MAX_ES_ZAMANLI = 3;

// ═══ GEÇİCİ: TÜM SESLER KAPALI (kullanıcı isteği — sonra revize edilecek) ═══
// tone()/noise() tek çıkış noktası; burada susturunca hiçbir efekt/ambiyans çalmaz (ayarlardan da açılamaz).
// Geri açmak için: SESSIZ = false yap ya da bu satırı sil.
const SESSIZ = true;

// Miks tablosu: efektlerin birbirine GÖRELİ seviyesi + kesme önceliği (yüksek = önemli)
const MIX = {
  tik: { vol: 0.30, pri: 0 }, devam: { vol: 0.55, pri: 1 }, inbox: { vol: 0.35, pri: 1 },
  gol: { vol: 1.00, pri: 3 }, kacan: { vol: 0.55, pri: 2 }, kart: { vol: 0.50, pri: 2 },
  kriz: { vol: 0.80, pri: 3 }, kasaArti: { vol: 0.40, pri: 1 }, kasaEksi: { vol: 0.50, pri: 1 },
  sayim: { vol: 0.45, pri: 2 }, muhur: { vol: 0.65, pri: 2 }, zafer: { vol: 1.00, pri: 3 }, yenilgi: { vol: 0.70, pri: 3 },
};
let sonPri = 0;

function ac() {
  if (typeof window === 'undefined' || !(window.AudioContext || window.webkitAudioContext)) return null;
  if (!S.ctx) S.ctx = new (window.AudioContext || window.webkitAudioContext)();
  return S.ctx;
}
// Eşzamanlılık kapısı: 3+ ses üst üste binmez — düşük öncelik elenir, yüksek geçer
function kapi(pri) {
  if (S.aktif < MAX_ES_ZAMANLI) return true;
  return pri >= sonPri; // önemli ses (gol/zafer) her zaman yol bulur
}
function say(dur) {
  S.aktif++;
  if (typeof setTimeout !== 'undefined') setTimeout(() => { S.aktif = Math.max(0, S.aktif - 1); }, dur * 1000 + 80);
}
function tone(freq, dur, { type = 'sine', vol = 1, slide = 0, delay = 0, pri = 1, kanal = 'fx' } = {}) {
  if (SESSIZ) return;
  const c = ac(); if (!c || !S.enabled || !kapi(pri)) return;
  sonPri = pri; say(dur + delay);
  const master = kanal === 'amb' ? S.ambience : S.volume;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, c.currentTime + delay);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), c.currentTime + delay + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + delay);
  g.gain.exponentialRampToValueAtTime(master * vol * 0.3, c.currentTime + delay + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + delay + dur);
  o.connect(g); g.connect(c.destination);
  o.start(c.currentTime + delay); o.stop(c.currentTime + delay + dur + 0.05);
}
function noise(dur, { vol = 1, delay = 0, pri = 1, kanal = 'fx' } = {}) {
  if (SESSIZ) return;
  const c = ac(); if (!c || !S.enabled || !kapi(pri)) return;
  sonPri = pri; say(dur + delay);
  const master = kanal === 'amb' ? S.ambience : S.volume;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource(), g = c.createGain();
  src.buffer = buf;
  g.gain.value = master * vol * 0.2;
  src.connect(g); g.connect(c.destination);
  src.start(c.currentTime + delay);
}
const mv = (k) => MIX[k].vol, mp = (k) => MIX[k].pri;

// 12 efekt (v4-§11 listesi) — seviyeler MIX tablosundan (gol > tık garantisi)
export const FX = {
  tik: () => tone(660, 0.04, { type: 'square', vol: mv('tik'), pri: mp('tik') }),
  devam: () => tone(220, 0.09, { type: 'square', vol: mv('devam'), pri: mp('devam') }),
  inbox: () => { tone(880, 0.05, { vol: mv('inbox'), pri: mp('inbox') }); tone(1170, 0.05, { vol: mv('inbox') * 0.8, delay: 0.06, pri: mp('inbox') }); },
  gol: () => { noise(0.45, { vol: mv('gol'), pri: mp('gol') }); tone(392, 0.3, { type: 'sawtooth', vol: mv('gol') * 0.6, slide: 200, pri: mp('gol') }); },
  kacan: () => tone(300, 0.25, { type: 'sawtooth', vol: mv('kacan'), slide: -180, pri: mp('kacan') }),
  kart: () => { tone(2000, 0.08, { type: 'square', vol: mv('kart'), pri: mp('kart') }); tone(2000, 0.08, { type: 'square', vol: mv('kart'), delay: 0.12, pri: mp('kart') }); },
  kriz: () => tone(80, 0.5, { type: 'sawtooth', vol: mv('kriz'), slide: -30, pri: mp('kriz') }),
  kasaArti: () => { tone(1320, 0.06, { vol: mv('kasaArti'), pri: mp('kasaArti') }); tone(1760, 0.09, { vol: mv('kasaArti'), delay: 0.07, pri: mp('kasaArti') }); },
  kasaEksi: () => tone(160, 0.2, { type: 'triangle', vol: mv('kasaEksi'), slide: -60, pri: mp('kasaEksi') }),
  sayim: () => tone(90, 0.12, { type: 'sine', vol: mv('sayim'), pri: mp('sayim') }),
  zafer: () => { [392, 494, 587, 784].forEach((f, i) => tone(f, 0.22, { type: 'square', vol: mv('zafer') * 0.5, delay: i * 0.15, pri: mp('zafer') })); noise(0.8, { vol: mv('zafer') * 0.5, delay: 0.3, pri: mp('zafer') }); },
  yenilgi: () => tone(240, 0.9, { type: 'sine', vol: mv('yenilgi'), slide: -140, pri: mp('yenilgi') }),
  muhur: () => { tone(120, 0.09, { type: 'square', vol: mv('muhur'), pri: mp('muhur') }); noise(0.12, { vol: mv('muhur') * 0.6, pri: mp('muhur') }); }, // AÇILIŞ 4a: tok damga
  // Başarım açılışı — parlak yükselen arpej (zafer'den kısa, tatmin edici "kazandın" tınısı)
  basari: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: mv('zafer') * 0.42, delay: i * 0.08, pri: mp('zafer') })); tone(1568, 0.12, { vol: mv('zafer') * 0.3, delay: 0.34, pri: mp('zafer') }); },
  // Hedefe yaklaşma — nazik tek "ping" (dikkat çeker, rahatsız etmez)
  hedef: () => { tone(988, 0.07, { vol: mv('inbox') * 0.7, pri: mp('inbox') }); tone(1319, 0.08, { vol: mv('inbox') * 0.55, delay: 0.08, pri: mp('inbox') }); },
};
// Kritik maç son 10 dk: yükselen uğultu — AMBİYANS kanalından (ayrı seviye)
export function ugultu(level = 0.5) { noise(0.6, { vol: 0.3 + level * 0.5, pri: 2, kanal: 'amb' }); }

export function setVolume(v) { S.volume = Math.max(0, Math.min(1, v)); }
export function setAmbience(v) { S.ambience = Math.max(0, Math.min(1, v)); } // 5d: ambiyans kanalı
export function setEnabled(on) { S.enabled = !!on; }
export function getSound() { return { volume: S.volume, ambience: S.ambience, enabled: S.enabled, mix: MIX }; }
