// src/ui/careerEnd.js — M4 KARİYER KAPANIŞ EKRANI (v4-§15): tam sahne.
// Dönemler · kupa vitrini · oy ortalaması · borç grafiği · yetiştirilen yıldızlar ·
// kimlik etiketleri · telkin profili · EN UNUTULMAZ 5 AN · tarih cümlesi.
import { esc } from './frame.js';

const KARNE_TR = {
  tamkadro: 'Tam kadro', rotasyon: 'Rotasyon', gencler: 'Gençler', kale: 'Kale',
  'ht:soyunma': 'Soyunma odası', 'ht:tribun': 'Tribün', 'ht:tdguven': 'TD güveni',
  'late:dok': 'Öne döktü', 'late:koru': 'Korudu',
};

// Basit ASCII-siz borç grafiği: SVG çizgi (ilk gün → son gün)
function borcGrafik(h) {
  if (!h || h.length < 2) return '<div class="muted">veri yok</div>';
  const W = 260, H = 60, max = Math.max(...h, 1);
  const pts = h.map((v, i) => `${(i / (h.length - 1)) * W},${H - (v / max) * (H - 6) - 3}`).join(' ');
  return `<svg width="${W}" height="${H}" style="max-width:100%">
    <polyline points="${pts}" fill="none" stroke="var(--warn)" stroke-width="2"/>
    <text x="0" y="${H - 2}" fill="var(--ink-3)" font-size="9">ilk gün ${h[0]}mn</text>
    <text x="${W - 70}" y="${H - 2}" fill="var(--ink-3)" font-size="9">son gün ${h[h.length - 1]}mn</text>
  </svg>`;
}

export function render(G) {
  const c = G.careerEnd;
  const kupalar = '🏆'.repeat(c.titles || 0) + '🥇'.repeat(c.cups || 0) || '—';
  const anlar = (c.anlar || []).map((a) => `<div class="msg" style="text-align:left">
    <div class="t">${a.etki > 0 ? '✦' : '✧'} ${esc(a.t)} <span class="muted" style="font-size:11px">· S${a.sezon} H${a.hafta}</span></div>
    <div class="b">${esc(a.b)}</div>
  </div>`).join('') || '<div class="muted">Defter boş kaldı — sessiz bir kariyer.</div>';
  const telkin = Object.entries(c.telkinProfil || {}).slice(0, 4)
    .map(([k, v]) => `${KARNE_TR[k] || k} ${v.n}`).join(' · ') || 'hiç karışmadı';
  const yildizlar = (c.yildizlar || []).length ? c.yildizlar.join(', ') : '—';

  return `<div class="scene" style="max-width:720px">
    <div class="overline">KARİYER KAPANIŞI · ${esc(c.reason)}</div>
    <h2 style="margin:8px 0;font-family:var(--serif);letter-spacing:2px">Işıklar Sönerken</h2>
    <div class="cockpit" style="grid-template-columns:1fr 1fr;text-align:left;margin-top:10px">
      <div class="card"><div class="overline">Bilanço</div>
        <div class="fin-lines" style="margin-top:6px">
          <div class="l"><span>Kazanılan dönem</span><b class="tnum">${c.termsWon}</b></div>
          <div class="l"><span>Sezon</span><b class="tnum">${c.seasons}</b></div>
          <div class="l"><span>Oy ortalaması</span><b class="tnum">${c.oyOrt != null ? '%' + Math.round(c.oyOrt * 100) : '—'}</b></div>
          <div class="l"><span>Kupa vitrini</span><b>${kupalar}</b></div>
        </div></div>
      <div class="card"><div class="overline">Borç Grafiği</div><div style="margin-top:8px">${borcGrafik(c.borcHistory)}</div></div>
      <div class="card"><div class="overline">Yetiştirilen Yıldızlar</div><div class="muted" style="margin-top:6px">${esc(yildizlar)}</div></div>
      <div class="card"><div class="overline">Kimlik & Telkin Profili</div>
        <div style="margin-top:6px">${c.kimlik ? `<span class="badge">${esc(c.kimlik)}</span>` : '<span class="muted">etiket oturmadı</span>'}</div>
        <div class="muted" style="font-size:12px;margin-top:6px">${esc(telkin)}</div></div>
    </div>
    <div class="overline" style="margin-top:16px">En Unutulmaz ${(c.anlar || []).length || ''} An</div>
    <div class="inbox-list" style="margin-top:8px">${anlar}</div>
    <div class="sentence" style="margin-top:18px;font-size:18px">“Tarih onu <b style="color:var(--club-2)">${esc(c.tag)}</b> olarak hatırlayacak.”</div>
    ${c.yanNot ? `<div class="muted" style="margin-top:6px;font-style:italic">…ve kulislerde bir dipnot: <b>${esc(c.yanNot)}</b>.</div>` : ''}
    ${c.senaryoNotu ? `<div class="muted" style="margin-top:4px">🎯 ${esc(c.senaryoNotu)}</div>` : ''}
    ${prestijBlok(G, c)}
  </div>`;
}

// RETENTION: kariyer PUANI (aşılacak rekor) + sıradaki meydan okuma + kaçan rozetler.
// "Yeni Kariyer" düğmesini "bir kez daha" iştahına çevirir.
function prestijBlok(G, c) {
  const ach = Object.keys(G.achUnlocked || {}).length;
  const puan = Math.round(
    (c.termsWon || 0) * 100 + (c.titles || 0) * 60 + (c.cups || 0) * 30 +
    (c.seasons || 0) * 8 + Math.max(0, Math.round(((c.oyOrt || 0.5) - 0.5) * 200)) +
    ((c.yildizlar || []).length) * 20 + ach * 15);
  const unvan = puan >= 900 ? 'EFSANE' : puan >= 550 ? 'USTA' : puan >= 300 ? 'SAYGIN' : puan >= 120 ? 'DENEYİMLİ' : 'ÇAYLAK';
  // Kalıcı rekor: localStorage (tarayıcıda kariyerler arası kalır). Headless'ta yok → guard.
  let rekor = (G.career && G.career.bestScore) || 0;
  try { if (typeof localStorage !== 'undefined') rekor = Math.max(rekor, +(localStorage.getItem('sb_best') || 0)); } catch {}
  const yeniRekor = puan > rekor;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem('sb_best', String(Math.max(rekor, puan))); } catch {}
  if (G.career) G.career.bestScore = Math.max(rekor, puan);

  // Sıradaki meydan okuma — bu kariyerin eksiğinden türetilir (deterministik)
  let meydan;
  if (!(c.titles > 0)) meydan = { ik: '🏆', t: 'Bu kez ŞAMPİYONLUK kovala — vitrine ilk kupayı as.' };
  else if ((c.termsWon || 0) < 2) meydan = { ik: '🪑', t: 'Koltukta kal: üst üste 2 dönem seçilmeyi dene.' };
  else if (G.club && G.club.tier !== 'buyuk') meydan = { ik: '📈', t: 'Daha büyük bir kulüple başla — baskı da beklenti de katlanır.' };
  else meydan = { ik: '☠️', t: 'Geri Adım Yok modunu dene: tek yaşam, geri alma yok. Hardcore rozetler seni bekliyor.' };

  // Kaçan rozetler — completionist teaser
  const defs = (G.data.achievements && (G.data.achievements.achievements || G.data.achievements)) || [];
  const kilitli = defs.filter((d) => !(G.achUnlocked || {})[d.id]).slice(0, 3).map((d) => d.name);

  return `<div class="card kariyer-puan" style="max-width:520px;margin:18px auto 0">
    <div class="kp-row">
      <div class="kp-skor"><i>KARİYER PUANI</i><b class="led">${puan}</b><span class="kp-unvan">${unvan}</span></div>
      <div class="kp-rekor">${yeniRekor ? '<span class="kp-yeni">✦ YENİ REKOR!</span>' : `<span class="muted">en iyi: ${rekor}</span>`}</div>
    </div>
    <div class="kp-meydan">${meydan.ik} <b>Sıradaki hedef:</b> ${esc(meydan.t)}</div>
    ${kilitli.length ? `<div class="kp-kacan">🔒 Kaçan rozetler: ${kilitli.map(esc).join(' · ')}${defs.length ? ` <span class="muted">(+${defs.filter((d) => !(G.achUnlocked || {})[d.id]).length - kilitli.length} daha)</span>` : ''}</div>` : ''}
  </div>`;
}
