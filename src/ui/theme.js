// src/ui/theme.js — GÖRSEL KİMLİK §2: kulüp renginin runtime sızması.
// teams.json colors[0] → parlaklık 55-65'e normalize → --club / --club-soft / --club-glow / --club-2.
// KONTRAST BEKÇİSİ: türetilen renk koyu mürekkep (#241A06) üstünde ≥4.5:1 tutana dek açılır.
// Saf yardımcılar export edilir (testlenebilir); DOM yazımı guard'lı.

// Varsayılan kulüpler (CLUB sabitlerindeki üçlü) — teams.json'da yoklar
const DEFAULTS = {
  'Yıldızspor': '#D4A62A',      // başkanlık altını (mevcut kimlik)
  'İmparator FK': '#7B1E3B',    // bordo imparatorluk
  'Gölköy SK': '#2E7D5B',       // göl yeşili
};

export function hexToHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0; const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s, l };
}
export function hslToHex({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return '#' + to(r) + to(g) + to(b);
}
// WCAG göreli parlaklık + kontrast oranı
export function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
}
export function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const KOYU_INK = '#241A06'; // badge/devam üzerindeki koyu metin

// Renk üret: parlaklık 55-65 bandına normalize + koyu mürekkeple 4.5:1 garantisi
export function deriveClubColor(hex) {
  const hsl = hexToHsl(hex);
  if (!hsl) return '#D4A62A';
  hsl.l = Math.min(Math.max(hsl.l, 0.55), 0.65);
  hsl.s = Math.min(Math.max(hsl.s, 0.35), 0.9); // gri/ölü renk kalmasın
  let out = hslToHex(hsl);
  let guard = 0;
  while (contrast(out, KOYU_INK) < 4.5 && guard++ < 12) { // bekçi: yetmiyorsa kademeli AÇIL
    hsl.l = Math.min(hsl.l + 0.03, 0.85);
    out = hslToHex(hsl);
  }
  return out;
}
export function clubPalette(hex) {
  const club = deriveClubColor(hex);
  const hsl = hexToHsl(club);
  const bright = hslToHex({ ...hsl, l: Math.min(hsl.l + 0.14, 0.88) });
  const n = parseInt(club.slice(1), 16);
  const rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  return { club, club2: bright, soft: `rgba(${rgb},.14)`, glow: `rgba(${rgb},.30)`, rgb };
}
// Kulübün ham rengi: teams.json'dan (havuz kimliği) ya da varsayılan üçlü
export function rawClubColor(G) {
  const t = (G.data && G.data.teams || []).find((x) => x.name === G.club.name);
  if (t && t.colors && t.colors[0]) {
    // ilk renk çok koyuysa (lacivert formalar) ikinciyi dene — vurgu rengi olarak daha canlı olan
    const a = hexToHsl(t.colors[0]), b = t.colors[1] && hexToHsl(t.colors[1]);
    if (a && b && Math.abs(a.l - 0.6) > Math.abs(b.l - 0.6)) return t.colors[1];
    return t.colors[0];
  }
  return DEFAULTS[G.club.name] || '#D4A62A';
}
// Runtime uygulama (DOM guard'lı — headless testte no-op)
let sonUygulanan = null;
export function applyClubTheme(G) {
  if (typeof document === 'undefined' || !G || !G.club || !G.club.name) return null;
  if (sonUygulanan === G.club.name) return null;
  sonUygulanan = G.club.name;
  const p = clubPalette(rawClubColor(G));
  const r = document.documentElement.style;
  r.setProperty('--club', p.club);
  r.setProperty('--club-2', p.club2);
  r.setProperty('--club-soft', p.soft);
  r.setProperty('--club-glow', p.glow);
  r.setProperty('--club-rgb', p.rgb);
  return p;
}
// AI rakip şeridi için renk (sonraki maç kartı / skorbord)
export function oppColor(G, oppName) {
  const t = (G.data && G.data.teams || []).find((x) => x.name === oppName);
  return (t && t.colors && t.colors[0]) || '#5F6C88';
}
