// src/ui/playerCard.js — OYUNCU KARTI (sb- görsel katman): geniş dosya kartı.
// Bizim deterministik SVG futbolcu avatarımız korunur (kulüp formalı büst). Güç halkası +
// potansiyel yıldızları + YETENEK PROFİLİ radar altıgeni + 6 segment çubuğu (FORM/KONDİSYON/
// MUTLULUK/TD UYUMU/KULÜP AİDİYETİ/BAŞKANA GÜVEN) + mevki mini sahası + son 5 maç + sezon
// istatistikleri + değer/bedel/maaş/sözleşme + satış/kiralık/sözleşme-yenile aksiyonları.
// Kadroda OLMAYAN (teklif/piyasa) oyuncu sisli/lite gösterilir: gerçek güç imzadan önce sızmaz.
import { esc, fmt } from './frame.js';
import { shownRating } from '../engines/market.js';
import { absHafta } from '../engines/ozel.js';
import { KISILIKLER, kisilikOf, klikOf, KLIK_TR } from '../engines/iliski.js';

const POS_TR = { GK: 'Kaleci', DEF: 'Stoper', MID: 'Orta saha', FWD: 'Forvet' };
const POS_COL = { GK: 'var(--club)', DEF: 'var(--info)', MID: 'var(--pos)', FWD: 'var(--warn)' };
const POS_HARF = { GK: 'K', DEF: 'S', MID: 'O', FWD: 'F' };

function h32(s) { let h = 0; const t = String(s); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return h; }
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// TD uyumu: oyuncu×hoca kimyası — kararlı (aynı ikili hep aynı), TD değişince değişir
export function tdUyum(p, coach) {
  return 42 + (h32(p.id + '|' + (coach?.name || '')) % 49); // 42-90
}
// Kulüp aidiyeti: köklü karakter + bağlam (kaptanlık bağlar; kiralık/satış listesi koparır)
export function aidiyet(p, G) {
  let a = 45 + (h32(p.name + '#aidiyet') % 41); // 45-85 taban
  if (p.id === G.captainId) a += 10;
  if (p.loanIn) a -= 25;
  if (p.vitrin) a -= 12;
  if (p.kiralikListe) a -= 8;
  return clamp(Math.round(a), 5, 99);
}
export function karakterOf(p) {
  const K = ['Lider ruhlu', 'Sakin ve dengeli', 'Hırslı', 'Alevlenebilir', 'Profesyonel', 'Mahalle çocuğu', 'Sessiz ama derin'];
  return K[h32(p.id + p.name) % K.length];
}
const KARAKTER_NOT = {
  'Lider ruhlu': 'soyunma odasını arkasından sürükler; sorumluluk ister, boşta bırakılırsa küser.',
  'Sakin ve dengeli': 'krizde soğukkanlı kalır; ne çok parlar ne söner, güvenilir bir eksendir.',
  'Hırslı': 'sürekli daha fazlasını ister; oynadıkça büyür, kulübede unutulursa patlar.',
  'Alevlenebilir': 'iyi yönetilirse lider olur, kötü günde soyunma odasını gerer.',
  'Profesyonel': 'işini duygusundan ayırır; sahada dengeli, kulis dedikodusuna karışmaz.',
  'Mahalle çocuğu': 'tribünle arası iyi, formaya bağlı; sevgi görürse taşın altına elini koyar.',
  'Sessiz ama derin': 'az konuşur çok gözler; doğru anda söz alır, hafife alınırsa içine kapanır.',
};
// Ayak (deterministik kozmetik — avatar/karakter deseniyle aynı): çoğunlukla sağ
const AYAK = ['Sağ ayak', 'Sağ ayak', 'Sağ ayak', 'Sol ayak', 'Çift ayak'];
const ayakOf = (p) => AYAK[h32(p.id + '#ayak') % AYAK.length];
// Potansiyel yıldızı (gerçek p.potential'dan) — 1..5
function potStars(potential) {
  const s = potential >= 78 ? 5 : potential >= 68 ? 4 : potential >= 58 ? 3 : potential >= 48 ? 2 : 1;
  return '★'.repeat(s) + '☆'.repeat(5 - s);
}

// ── SVG FUTBOLCU AVATARI — düz-vektör büst (faceless): kulüp forması + forma numarası,
// 6 ten × 6 saç rengi × 5 saç stili × sakal → yüzlerce farklı yüz. GK koyu forma giyer.
export function playerAvatar(p, size = 92) {
  const h = h32(p.id + '|' + p.name);
  const skins = ['#EDC9A3', '#E0B48A', '#C99B6E', '#A97C50', '#8A5A34', '#6E4426'];
  const hairsC = ['#241B12', '#3C2A18', '#5C4326', '#151515', '#6B4B2F', '#4A3B33'];
  const skin = skins[h % skins.length];
  const hair = hairsC[(h >>> 3) % hairsC.length];
  const stil = (h >>> 6) % 5;
  const sakal = (h >>> 9) % 10 < 3; // ~%30 sakal
  const no = (h % 29) + 1;
  const gk = p.pos === 'GK';
  const uid = 'av' + (h % 100000);
  // Saç stilleri: 0 kısa · 1 yandan ayrık · 2 kıvırcık · 3 uzunca · 4 sıfır (gölge)
  const sacPath = [
    `<path d="M30 36a18 18 0 0 1 36 0c0-11-6-19-18-19s-18 8-18 19z" fill="${hair}"/>`,
    `<path d="M30 35c2-10 8-16 18-16 11 0 17 6 18 15-6-6-10-7-14-3-6-5-16-4-22 4z" fill="${hair}"/>`,
    `<path d="M29 36c-2-13 8-21 19-21s21 8 19 21c-2-5-5-8-8-7 1-4-2-7-5-6-2-3-6-3-8 0-3-2-6 1-5 5-4-1-9 2-12 8z" fill="${hair}"/>`,
    `<path d="M28 44c-2-18 8-27 20-27s22 9 20 27l-5-2c2-12-4-19-15-19s-17 7-15 19z" fill="${hair}"/>`,
    `<path d="M31 33a17 17 0 0 1 34 0c0-9-7-15-17-15s-17 6-17 15z" fill="${hair}" opacity=".45"/>`,
  ][stil];
  return `<svg class="pc-ava" viewBox="0 0 96 96" width="${size}" height="${size}" aria-hidden="true">
    <defs>
      <radialGradient id="${uid}bg" cx="50%" cy="28%" r="82%"><stop offset="0" stop-color="rgba(var(--club-rgb),.38)"/><stop offset="1" stop-color="rgba(8,12,22,.95)"/></radialGradient>
      <linearGradient id="${uid}fr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${gk ? '#3a4d33' : 'var(--club-2)'}"/><stop offset="1" stop-color="${gk ? '#222d1d' : 'var(--club)'}"/></linearGradient>
    </defs>
    <circle cx="48" cy="48" r="47" fill="url(#${uid}bg)" stroke="rgba(255,255,255,.14)"/>
    <path d="M16 96c1-19 15-29 32-29s31 10 32 29z" fill="url(#${uid}fr)"/>
    <path d="M40 68l8 7 8-7-4-3h-8z" fill="rgba(10,15,26,.55)"/>
    <text x="48" y="89" text-anchor="middle" font-family="Archivo,system-ui,sans-serif" font-weight="800" font-size="13" fill="rgba(255,255,255,.85)">${no}</text>
    <rect x="43" y="55" width="10" height="13" rx="4" fill="${skin}"/>
    <circle cx="48" cy="42" r="17" fill="${skin}"/>
    ${sakal ? `<path d="M34 46a14 14 0 0 0 28 0c0 12-6 17-14 17s-14-5-14-17z" fill="${hair}" opacity=".85"/>` : ''}
    ${sacPath}
  </svg>`;
}

const renk = (v) => (v >= 62 ? 'var(--pos)' : v >= 45 ? 'var(--warn)' : 'var(--neg)');
// Segment çubuğu (10 dilim) — sağda etiketli metrik
function segBar(lbl, v, col, tip) {
  const val = clamp(Math.round(v), 0, 100);
  const dolu = Math.round(val / 10);
  const c = col || renk(val);
  const segs = Array.from({ length: 10 }, (_, i) => `<span class="pc-seg${i < dolu ? ' on' : ''}" style="${i < dolu ? `background:${c}` : ''}"></span>`).join('');
  return `<div class="pc-mrow" data-tip="${esc(tip || '')}"><i>${lbl}</i><span class="pc-segs">${segs}</span><em class="tnum" style="color:${c}">${val}</em></div>`;
}

// Güç halkası — dairesel gauge, ortada büyük sayı/aralık
function gucRing(pct, big, sub, tier, tip) {
  const C = 2 * Math.PI * 26;
  const off = (C * (1 - clamp(pct, 0, 100) / 100)).toFixed(1);
  return `<div class="pc-ring ${tier}" data-tip="${esc(tip || '')}">
    <svg viewBox="0 0 64 64"><circle class="pc-ring-bg" cx="32" cy="32" r="26"/><circle class="pc-ring-fg" cx="32" cy="32" r="26" transform="rotate(-90 32 32)" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off}"/></svg>
    <div class="pc-ring-c"><b${big.length > 3 ? ' style="font-size:.62em;letter-spacing:-.5px"' : ''}>${big}</b><i>${sub}</i></div>
  </div>`;
}

// YETENEK PROFİLİ radar altıgeni — 6 eksen (FORM/KOND/TD/GÜVEN/AİDİYET/MUTLU)
function radar(axes) {
  const cx = 90, cy = 88, R = 62;
  const ang = (i) => (-90 + i * 60) * Math.PI / 180;
  const pt = (i, r) => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r];
  const grid = [0.34, 0.67, 1].map((f) => `<polygon points="${axes.map((_, i) => pt(i, R * f).map((n) => n.toFixed(1)).join(',')).join(' ')}" class="pc-rd-grid"/>`).join('');
  const spokes = axes.map((_, i) => { const [x, y] = pt(i, R); return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="pc-rd-spoke"/>`; }).join('');
  const valPoly = axes.map((a, i) => pt(i, R * clamp(a.v, 0, 100) / 100).map((n) => n.toFixed(1)).join(',')).join(' ');
  const dots = axes.map((a, i) => { const [x, y] = pt(i, R * clamp(a.v, 0, 100) / 100); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.3" class="pc-rd-dot"/>`; }).join('');
  const labels = axes.map((a, i) => { const [x, y] = pt(i, R + 13); return `<text x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}" class="pc-rd-lbl" text-anchor="middle">${a.lbl}</text>`; }).join('');
  return `<svg class="pc-radar" viewBox="0 0 180 176">${grid}${spokes}<polygon points="${valPoly}" class="pc-rd-val"/>${dots}${labels}</svg>`;
}

// Mevki mini sahası — oyuncunun bölgesinde nokta
function miniPitch(pos) {
  const zx = ({ GK: 16, DEF: 62, MID: 100, FWD: 150 }[pos] ?? 100);
  return `<svg class="pc-pitch" viewBox="0 0 200 92">
    <rect x="1" y="1" width="198" height="90" rx="6" class="pc-pt-bg"/>
    <line x1="100" y1="1" x2="100" y2="91" class="pc-pt-ln"/><circle cx="100" cy="46" r="15" class="pc-pt-ln" fill="none"/>
    <rect x="1" y="26" width="24" height="40" class="pc-pt-ln" fill="none"/><rect x="175" y="26" width="24" height="40" class="pc-pt-ln" fill="none"/>
    <circle cx="${zx}" cy="46" r="9" class="pc-pt-dot"/><text x="${zx}" y="49.5" class="pc-pt-t" text-anchor="middle">${POS_HARF[pos] || '?'}</text>
  </svg>`;
}

// Sezon istatistiği — deterministik türetme (sim per-oyuncu gol/asist tutmaz; overall/pos/form'dan makul)
function seasonStats(p, G) {
  const mine = Object.values(G.league?.table || {}).find((t) => t.mine);
  const oynanan = mine?.P ?? Math.max(0, Math.min(G.meta?.week ?? 0, 34));
  const kadroRol = 0.55 + 0.45 * clamp((p.overall - 45) / 35, 0, 1);
  const mac = clamp(Math.round(oynanan * kadroRol) - Math.min(p.injuryWeeks || 0, 4), 0, 34);
  const golRate = { FWD: 0.42, MID: 0.16, DEF: 0.05, GK: 0 }[p.pos] ?? 0.12;
  const asRate = { FWD: 0.16, MID: 0.22, DEF: 0.08, GK: 0.01 }[p.pos] ?? 0.12;
  const jit = (k) => 0.75 + (h32(p.id + k) % 51) / 100; // 0.75-1.25
  const gol = Math.max(0, Math.round(mac * golRate * (p.overall / 66) * jit('#g')));
  const asist = Math.max(0, Math.round(mac * asRate * (p.overall / 66) * jit('#a')));
  const puan = (clamp(5.7 + (p.form - 50) / 32 + (p.overall - 60) / 55, 5.1, 8.7)).toFixed(1).replace('.', ',');
  return { mac, gol, asist, puan };
}
// Son 5 maç — OYUNCU BAŞINA (form + takım standing harmanı), per-oyuncu+per-maç hash ile ÇEŞİTLİ.
// Deterministik; asla "hep G" değil (G olasılığı tavanlı) ve her oyuncuda farklı dizi.
function son5(p, G) {
  const mine = Object.values(G.league?.table || {}).find((t) => t.mine);
  const P = mine?.P || 0;
  if (!P) return Array.from({ length: 5 }, () => '<span class="pc-s5c">·</span>').join(''); // henüz maç yok
  const teamG = mine.W / P, teamD = mine.D / P;
  const formF = clamp((p.form ?? 60) / 100, 0, 1);
  const pG = clamp(teamG * 0.55 + formF * 0.35, 0.1, 0.72);   // G eğilimi: takım oranı + form; tavan %72 → çeşitlilik
  const pB = clamp(teamD * 0.7 + 0.15, 0.1, 0.38);            // beraberlik payı
  const base = h32(p.id + '|s5|' + (G.worldSeason ?? G.meta?.season ?? 1));
  return Array.from({ length: 5 }, (_, i) => {
    // her maç için AYRI iyi-dağılmış değer (ardışık i'ler birbirine yakın çıkmasın → tek harf tuzağı)
    let x = (base ^ Math.imul(i + 1, 0x9E3779B1)) >>> 0;
    x = Math.imul(x ^ (x >>> 15), 0x85EBCA77) >>> 0;
    const r = (x % 1000) / 1000;
    const [cls, ch] = r < pG ? ['g', 'G'] : r < pG + pB ? ['b', 'B'] : ['m', 'M'];
    return `<span class="pc-s5c ${cls}">${ch}</span>`;
  }).join('');
}

// Oyuncuyu HER YERDE bul: kadro + gelen/giden teklif dosyaları (inbox tfile/sfile) + gecikmeli dosya + piyasa.
export function findAnyPlayer(G, id) {
  if (id == null) return null;
  const sid = String(id);
  let p = (G.squad || []).find((x) => String(x.id) === sid);
  if (p) return p;
  for (const m of G.inbox || []) if (m.file && m.file.player && String(m.file.player.id) === sid) return m.file.player;
  for (const ph of [G.phone, G.phoneDeferred, ...(G.phoneQueue || [])]) if (ph && ph.file && ph.file.player && String(ph.file.player.id) === sid) return ph.file.player;
  if (G.delayedFile && G.delayedFile.player && String(G.delayedFile.player.id) === sid) return G.delayedFile.player;
  p = (G.market || []).find((x) => String(x.id) === sid);
  return p || null;
}

export function render(G) {
  const p = findAnyPlayer(G, G._pcard);
  if (!p) return '';
  const yabanci = !(G.squad || []).some((x) => x === p); // kadromda değil (teklif/piyasa oyuncusu)
  const derin = !!p._derin;              // derin rapor alındıysa gerçek güç bilinir
  const sisli = yabanci && !derin;       // güç SİSİ: kadroda değil ve derin rapor yok
  // BUG DERSİ (2026-07-21): derin rapor yalnız GÜCÜ netleştirir — kart DÜZENİ hep yabancılığa
  // bakar. Eskiden derin raporlu piyasa oyuncusu TAM kadro kartıyla açılıyordu (Jest/Söz/Satış/
  // Sözleşme butonları + son 5 maç + başkana güven — hiçbiri benim olmayan oyuncuya ait olamaz).

  let gucBig, gucSub, gucTip, tierVal;
  if (!yabanci) {
    gucBig = String(p.overall); gucSub = 'GÜÇ'; gucTip = 'Mevcut güç'; tierVal = p.overall;
  } else if (derin) {
    gucBig = String(p.overall); gucSub = 'GÜÇ ✓'; gucTip = 'Derin rapor — gerçek güç netleşti (skaut dosyası kesinleşti)'; tierVal = p.overall;
  } else if (p._sorgu) {
    const g = p._sorgu.guc, hh = p._sorgu.h ?? 1;
    gucBig = `${g - hh}–${g + hh}`; gucSub = 'GÜÇ ±'; gucTip = 'Sorgu sonrası daralmış tahmin — gerçek güç imzadan sonra sahada belli olur'; tierVal = g;
  } else {
    const s = shownRating(p, G.facilities?.scout ?? 0, G.meta?.week ?? 0);
    gucBig = `${s.deger - s.h}–${s.deger + s.h}`; gucSub = 'GÜÇ ~'; gucTip = 'Scout tahmini — sis scout tesisiyle daralır; gerçek güç imzadan sonra belli olur'; tierVal = s.deger;
  }
  const tier = tierVal >= 75 ? 't1' : tierVal >= 60 ? 't2' : tierVal >= 45 ? 't3' : 't4';
  const uyum = tdUyum(p, G.coach);
  const aid = aidiyet(p, G);
  const guven = Math.round(p.baskanaGuven ?? 50);
  const kis = p.relx?.kisilik || kisilikOf(p.id + '#' + (p.name || '')); // salt-okur: relx yoksa aynı hash'ten türet
  const bedel = Math.round(p.marketValue * 1.12 * 10) / 10;
  const krk = karakterOf(p);

  // — ORTAK BAŞLIK — (potansiyel: kadro oyuncusunda hep; yabancıda yalnız derin raporla görünür)
  const potStar = (!sisli) && p.potential ? `<div class="pc-pot" data-tip="Potansiyel — gelişim tavanı">POTANSİYEL <b>${potStars(p.potential)}</b></div>` : '';
  const chips = `<span class="pc-chip" style="border-color:${POS_COL[p.pos]};color:${POS_COL[p.pos]}">${POS_TR[p.pos] || p.pos}</span>
    <span class="pc-chip">${p.age} yaş</span>
    <span class="pc-chip">${ayakOf(p)}</span>
    ${p.age <= 21 ? '<span class="pc-chip g">GENÇ</span>' : ''}
    ${(p.ocak && p.age <= 23) ? '<span class="pc-chip alt" data-tip="Altyapıdan yetişti">ALTYAPI</span>' : (p.yeniHafta > 0 ? '<span class="pc-chip yeni" data-tip="Yeni transfer — 3 hafta sonra kalkar">YENİ</span>' : '')}
    ${p.id === G.captainId ? '<span class="pc-chip c" data-tip="Kaptan">C</span>' : ''}
    ${p.loanIn ? '<span class="pc-chip i">KİRALIK</span>' : ''}
    ${p.vitrin ? '<span class="pc-chip i">SATIŞTA</span>' : ''}
    ${p.kiralikListe ? '<span class="pc-chip i">KİRALIK LİSTESİNDE</span>' : ''}
    ${p.injuryWeeks > 0 ? `<span class="pc-chip i">🩹 ${p.injuryWeeks} HAFTA</span>` : ''}
    ${p.suspensionWeeks > 0 ? '<span class="pc-chip i">🟥 CEZALI</span>' : ''}
    <span class="pc-chip krk" data-tip="Karakter — ${esc(KARAKTER_NOT[krk] || '')}">${esc(krk)}</span>`;
  // BAŞKANLIK DOSYASI kimliği: üstte altın tick'li dosya şeridi — kart "modal" değil, masaya konan evrak
  const head = `<div class="pc-dosya"><span class="sb-tick"></span>${yabanci ? (derin ? 'SKAUT DOSYASI · KESİN RAPOR ✓' : 'SKAUT DOSYASI · İMZASIZ') : 'OYUNCU DOSYASI · KULÜP ARŞİVİ'}</div>
  <div class="pc-head">
    ${playerAvatar(p, 84)}
    <div class="pc-kim">
      <div class="pc-nm">${esc(p.name)}</div>
      <div class="pc-chips">${chips}</div>
    </div>
    <div class="pc-guc">${gucRing(tierVal, gucBig, gucSub, tier, gucTip)}${potStar}</div>
  </div>`;

  // — YABANCI: lite kart (derin raporlu da olsa — kadro aksiyonları/iç profil imzadan önce sızmaz) —
  if (yabanci) {
    return `<div class="pcard-ovl" data-act="pcardClose"><div class="pcard pcard-lite ${tier}" data-act="noop">
      <button class="pc-close" data-act="pcardClose" aria-label="Kapat">✕</button>
      ${head}
      <div class="pc-lite-body">
        <div class="pc-mrows">
          ${segBar('FORM', p.form, null, 'Son haftalardaki saha performansı')}
          ${segBar('KONDİSYON', p.fitness, null, 'Bacaklardaki güç')}
          ${segBar('MUTLULUK', p.morale, null, 'Moral')}
        </div>
        <div class="pc-lite-note">🔒 TD uyumu · kulüp aidiyeti · başkana güven — ancak <b>İMZADAN SONRA</b> ölçülür (senin kulübüne/hocana göre şekillenir).</div>
      </div>
      <div class="pc-stats-strip">
        <span class="pc-cell"><i>DEĞER</i><b>${fmt(p.marketValue)}mn</b></span>
        <span class="pc-cell" data-tip="Bugün satılsa piyasa primiyle beklenen bedel"><i>TAHMİNİ BEDEL</i><b>~${fmt(bedel)}mn</b></span>
        <span class="pc-cell"><i>MAAŞ</i><b>${fmt(p.wage)}mn<em>/sezon</em></b></span>
        <span class="pc-cell"><i>SÖZLEŞME</i><b>${p.contractYears ?? '—'} yıl</b></span>
      </div>
      <div class="pc-actions">
        <span class="pc-hint">👁 Kadronda değil — teklif/piyasa oyuncusu. Transfer masası GM dosyasından yürür.</span>
        <button class="pc-btn" data-act="pcardClose">Kapat</button>
      </div>
    </div></div>`;
  }

  // — ZENGİN KART (kadro oyuncusu) —
  const st = seasonStats(p, G);
  const talip = p._ilgi ?? (p.overall >= 70 ? (h32(p.id + '#tlp') % 3) : 0);
  const endYil = 2025 + (G.worldSeason ?? G.meta?.season ?? 1) + (p.contractYears ?? 1);
  const renewKilit = (p.contractYears ?? 0) >= 5 || p._renewTerm === (G.meta?.term ?? 1);
  // İLİŞKİ (2.1): jest haftada 1 (tüm kadro), söz oyuncu başına 1 aktif
  const absW = absHafta(G); // MONOTONİK — jest hakkı dönem geçişinde şaşmaz
  const jestHak = (G.ozel?.seviye ?? 1) >= 5 ? 2 : 1; // Halkın Adamı (sv.5+): haftada 2 jest
  const jestDolu = G.jestH?.hafta === absW && G.jestH.n >= jestHak;
  const sozVar = !!p.relx?.soz;
  const aksiyon = p.loanIn
    ? `<span class="pc-hint">🔒 Kiralık oyuncu — sezon sonu asıl kulübüne döner; satılamaz, listelenemez.</span>
       <button class="pc-btn" data-act="pcardClose">Kapat</button>`
    : `<button class="pc-btn" data-act="pJest" data-arg="${p.id}" ${jestDolu ? 'disabled' : ''} data-tip="${jestDolu ? 'Bu hafta bir jest yapıldı — haftada bir' : (p.injuryWeeks > 0 ? 'Hastane ziyareti: güven + moral, kliği de ısıtır' : 'Başkanla yemek: güven + moral, kliği de ısıtır')}">${p.injuryWeeks > 0 ? '💐 Ziyaret Et' : '🤝 Jest Yap'}</button>
       <button class="pc-btn" data-act="pSoz" data-arg="${p.id}" ${sozVar || p.vitrin ? 'disabled' : ''} data-tip="${sozVar ? 'Söz zaten defterde — sezon sonu tutulursa güven büyür' : p.vitrin ? 'Satış listesindeyken söz verilmez' : '“Seni satmayacağım” — güven sıçrar; bozarsan manşet olur'}">${sozVar ? '📜 Söz Verildi' : '📜 Satmam Sözü'}</button>
       <button class="pc-btn ${p.vitrin ? 'on' : ''}" data-act="vitrin" data-arg="${p.id}" data-tip="${p.vitrin ? 'Satış listesinden geri çek' : 'Menajerlere sinyal gider; teklifler 2-4 haftada gelir'}">${p.vitrin ? '🏷 Satıştan çek' : 'Satış listesi'}</button>
       <button class="pc-btn ${p.kiralikListe ? 'on' : ''}" data-act="kiralikListe" data-arg="${p.id}" data-tip="${p.kiralikListe ? 'Kiralık listesinden çek' : 'Pencere açıkken alt sıralardan kiralık dosyası gelebilir'}">${p.kiralikListe ? '↩ Kiralıktan çek' : 'Kiralık'}</button>
       <button class="pc-btn pri" data-act="renewContract" data-arg="${p.id}" ${renewKilit ? 'disabled' : ''} data-tip="${renewKilit ? 'Sözleşmesi zaten uzun / bu dönem yenilendi' : 'Sözleşmeyi uzat: moral ve aidiyet yükselir, maaş biraz artar'}">Sözleşme Yenile</button>
       <button class="pc-btn" data-act="pcardClose">Kapat</button>`;

  return `<div class="pcard-ovl" data-act="pcardClose"><div class="pcard pcard-rich ${tier}" data-act="noop">
    <button class="pc-close" data-act="pcardClose" aria-label="Kapat">✕</button>
    ${head}
    <div class="pc-sec-t">YETENEK PROFİLİ</div>
    <div class="pc-profil">
      ${radar([
    { lbl: 'FORM', v: p.form }, { lbl: 'KOND', v: p.fitness }, { lbl: 'TD', v: uyum },
    { lbl: 'GÜVEN', v: guven }, { lbl: 'AİDİYET', v: aid }, { lbl: 'MUTLU', v: p.morale },
  ])}
      <div class="pc-mrows">
        ${segBar('FORM', p.form, null, 'Son haftalardaki saha performansı')}
        ${segBar('KONDİSYON', p.fitness, null, 'Bacaklardaki güç — rotasyonla toparlar')}
        ${segBar('MUTLULUK', p.morale, null, 'Moral — satış listesi ve kötü seriler yıpratır')}
        ${segBar('TD UYUMU', uyum, 'var(--info)', 'Hocayla sahadaki kimyası — TD değişirse bu da değişir')}
        ${segBar('KULÜP AİDİYETİ', aid, 'var(--club-2)', 'Armaya bağlılık — kaptanlık bağlar, satış listesi koparır')}
        ${segBar('BAŞKANA GÜVEN', guven, 'var(--pos)', 'Sana güveni — verdiğin kararlar iz bırakır')}
      </div>
    </div>
    <div class="pc-mid">
      <div class="pc-pitch-box"><div class="pc-sec-s">MEVKİ · ${(POS_TR[p.pos] || p.pos).toLocaleUpperCase('tr')}</div>${miniPitch(p.pos)}</div>
      <div class="pc-s5-box"><div class="pc-sec-s">SON 5 MAÇ</div><div class="pc-s5">${son5(p, G)}</div></div>
    </div>
    <div class="pc-krk-note"><span class="pc-krk-tag">${esc(krk)}</span> karakter: ${esc(KARAKTER_NOT[krk] || '')}</div>
    <div class="pc-krk-note pc-rel-note" data-tip="İlişki: jest/söz ile büyür, kırık söz ve vetoyla kırılır. Güven ≥70 → haftalık moral + yenilemede indirimli zam; <30 → huzursuzluk">
      <span class="pc-krk-tag">${esc(KISILIKLER[kis]?.ad || kis)}</span> ilişki: ${esc(KISILIKLER[kis]?.not || '')} · <b>${esc(KLIK_TR[klikOf(p)] || '')}</b>${(p.relx?.iyilik || 0) > 0 ? ` · sana borçlu: <b class="pos">${p.relx.iyilik}</b>` : ''}${p.relx?.soz ? ' · <b style="color:var(--club-2)">SÖZ DEFTERDE</b>' : ''}${guven < 30 ? ' · <b class="neg">HUZURSUZ</b>' : ''}
    </div>
    <div class="pc-stats">
      <span class="pc-cell"><i>MAÇ</i><b>${st.mac}</b></span>
      <span class="pc-cell"><i>GOL</i><b>${st.gol}</b></span>
      <span class="pc-cell"><i>ASİST</i><b>${st.asist}</b></span>
      <span class="pc-cell"><i>ORT. PUAN</i><b style="color:${st.puan >= '7' ? 'var(--pos)' : 'var(--ink-1)'}">${st.puan}</b></span>
      <span class="pc-cell"><i>TALİP</i><b>${talip ? talip + ' kulüp' : 'yok'}</b></span>
    </div>
    <div class="pc-stats-strip">
      <span class="pc-cell"><i>DEĞER</i><b>${fmt(p.marketValue)}mn</b></span>
      <span class="pc-cell" data-tip="Bugün satılsa piyasa primiyle beklenen bedel"><i>TAHMİNİ BEDEL</i><b>~${fmt(bedel)}mn</b></span>
      <span class="pc-cell"><i>MAAŞ</i><b>${fmt(p.wage)}mn<em>/sezon</em></b></span>
      <span class="pc-cell" data-tip="Sözleşme bitişi"><i>SÖZLEŞME BİTİŞİ</i><b>30.06.${endYil}<em>${p.contractYears ?? '—'} sezon</em></b></span>
    </div>
    <div class="pc-actions">${aksiyon}</div>
  </div></div>`;
}
