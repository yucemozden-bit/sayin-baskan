// src/ui/careerEnd.js — M4 KARİYER KAPANIŞ TÖRENİ (sb-cinematic tam-ekran, scroll YOK):
// eski dar tek kolon + kaydırma yerine genişliğe yayılan 3 panel (kullanıcı raporu 2026-07-22).
// Sol bilanço + borç grafiği · orta EN UNUTULMAZ 5 AN · sağ kimlik/yıldızlar + hanedan + kariyer puanı.
// Kök .sn-fit: fitSb ölçekler — taşma kırpılmaz, orantılı küçülür (bkz. fitsb-olcek-kurallari).
import { esc } from './frame.js';
import { sbTopbar } from './cockpit.js';

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
  const anlar = (c.anlar || []).map((a) => `<div class="se-ani ${a.etki > 0 ? 'iyi' : 'koyu'}">
      <span class="se-ani-ik">${a.etki > 0 ? '✦' : '✧'}</span>
      <div><b>${esc(a.t)} <span class="muted" style="font-size:10.5px;font-weight:400">· S${a.sezon} H${a.hafta}</span></b><i>${esc(a.b)}</i></div>
    </div>`).join('') || '<div class="muted">Defter boş kaldı — sessiz bir kariyer.</div>';
  const telkin = Object.entries(c.telkinProfil || {}).slice(0, 4)
    .map(([k, v]) => `${KARNE_TR[k] || k} ${v.n}`).join(' · ') || 'hiç karışmadı';
  const yildizlar = (c.yildizlar || []).length ? c.yildizlar.join(', ') : '—';

  const bilanco = `<div class="card se-card"><div class="overline">Bilanço</div>
    <div class="fin-lines" style="margin-top:6px">
      <div class="l"><span>Kazanılan dönem</span><b class="tnum">${c.termsWon}</b></div>
      <div class="l"><span>Sezon</span><b class="tnum">${c.seasons}</b></div>
      <div class="l"><span>Oy ortalaması</span><b class="tnum">${c.oyOrt != null ? '%' + Math.round(c.oyOrt * 100) : '—'}</b></div>
      <div class="l"><span>Kupa vitrini</span><b>${kupalar}</b></div>
    </div></div>`;
  const borc = `<div class="card se-card"><div class="overline">Borç Grafiği</div><div style="margin-top:8px">${borcGrafik(c.borcHistory)}</div></div>`;
  const kimlik = `<div class="card se-card"><div class="overline">Kimlik & Telkin Profili</div>
    <div style="margin-top:6px">${c.kimlik ? `<span class="badge">${esc(c.kimlik)}</span>` : '<span class="muted">etiket oturmadı</span>'}</div>
    <div class="muted" style="font-size:12px;margin-top:6px">${esc(telkin)}</div>
    <div class="overline" style="margin-top:10px">Yetiştirilen Yıldızlar</div>
    <div class="muted" style="margin-top:4px;font-size:12px">${esc(yildizlar)}</div></div>`;
  const anlarKart = `<div class="card se-card"><div class="overline">En Unutulmaz ${(c.anlar || []).length || ''} An</div>
    <div style="margin-top:4px">${anlar}</div></div>`;

  return `<div class="sb-root sb-cinematic ce-root">
    <div class="sb-atmo"></div><div class="sb-vignette"></div>
    ${sbTopbar(G, { phaseChip: 'KARİYER KAPANIŞI' })}
    <div class="sb-body sb-body-col ce-body">
      <div class="sn-fit"><div class="scene ce-scene">
        <div class="ce-hero">
          <div class="overline">Kariyer Kapanışı · ${esc(c.reason || '')}</div> <!-- .overline zaten uppercase basar; DOM'da özgün hali kalsın (testler gerekçeyi arar) -->
          <h1 class="ce-h1">Işıklar Sönerken</h1>
          <div class="ce-tarih">“Tarih onu <b>${esc(c.tag)}</b> olarak hatırlayacak.”</div>
          ${c.yanNot ? `<div class="muted ce-not">…ve kulislerde bir dipnot: <b>${esc(c.yanNot)}</b>.</div>` : ''}
          ${c.senaryoNotu ? `<div class="muted ce-not">🎯 ${esc(c.senaryoNotu)}</div>` : ''}
        </div>
        <div class="ce-grid">
          <div class="ce-kol">${bilanco}${borc}</div>
          <div class="ce-kol">${anlarKart}</div>
          <div class="ce-kol">${kimlik}${hanedanBlok(G)}${prestijBlok(G, c)}</div>
        </div>
      </div></div>
    </div>
    <footer class="sb-bottombar">
      <div class="sb-bb-l"><span class="sb-bb-k">SON DÜDÜK</span><span class="sb-bb-note">Koltuk el değiştirdi — ama tribün hikâyeyi unutmaz</span></div>
      <button class="sb-btn sb-btn-primary" data-act="devam">Yeni Kariyer ▸</button>
    </footer>
  </div>`;
}

// HANEDAN (2.8): kariyer biterken aile ne bırakıyor — halef kızı, formalı oğul, ya da sessiz veda.
function hanedanBlok(G) {
  const oz = G.ozel;
  if (!oz) return '';
  const satirlar = [];
  if (oz.flags?.kizKulupte) satirlar.push(`👔 <b>${esc(oz.aile?.c1 || 'Kızın')}</b> kulüp masasında yetişti — koridorlarda "geleceğin başkanı" diye anılıyor. Koltuk aileye emanet.`);
  if (oz.flags?.ogulKadroda) satirlar.push(`⚽ <b>${esc(oz.aile?.c2 || 'Oğlun')}</b> senin armanla sahada — tribün onun formasında senin hikâyeni okuyor.`);
  else if (oz.flags?.ogulAkademide) satirlar.push(`🎓 <b>${esc(oz.aile?.c2 || 'Oğlun')}</b> akademide ter döküyor — hikâyesi daha yeni başlıyor.`);
  const ort = oz.iliski ? Math.round((oz.iliski.es + oz.iliski.c1 + oz.iliski.c2) / 3) : 0;
  satirlar.push(ort >= 70
    ? `💗 Ev seni hiç yalnız bırakmadı — ${esc(oz.aile?.es || '')} Hanım son gün de ön sıradaydı.`
    : ort < 45 ? '🕯 Koltuk çok şey aldı — evdeki sandalyeler uzun süre boş kaldı.'
      : '🏠 Aile bu yolculuğu seninle taşıdı — bazen uzaktan, ama hep orada.');
  return `<div class="card se-card"><div class="overline">Hanedan — Aile Ne Bırakıyor</div>
    <div style="margin-top:6px;display:grid;gap:6px;font-size:12.5px">${satirlar.map((s) => `<div>${s}</div>`).join('')}</div></div>`;
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

  return `<div class="card kariyer-puan">
    <div class="kp-row">
      <div class="kp-skor"><i>KARİYER PUANI</i><b class="led">${puan}</b><span class="kp-unvan">${unvan}</span></div>
      <div class="kp-rekor">${yeniRekor ? '<span class="kp-yeni">✦ YENİ REKOR!</span>' : `<span class="muted">en iyi: ${rekor}</span>`}</div>
    </div>
    <div class="kp-meydan">${meydan.ik} <b>Sıradaki hedef:</b> ${esc(meydan.t)}</div>
    ${kilitli.length ? `<div class="kp-kacan">🔒 Kaçan rozetler: ${kilitli.map(esc).join(' · ')}${defs.length ? ` <span class="muted">(+${defs.filter((d) => !(G.achUnlocked || {})[d.id]).length - kilitli.length} daha)</span>` : ''}</div>` : ''}
  </div>`;
}
