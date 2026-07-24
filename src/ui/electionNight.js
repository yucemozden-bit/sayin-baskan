// src/ui/electionNight.js — Seçim gecesi TAM SAHNE (v3-I / D7):
// 1) karne kartları TEK TEK açılır (DEVAM) → 2) rakip son konuşması → 3) salınımlı sayım
// → 4) sonuç sahnesi → 5) bileşen analiz dökümü ("seni X seçtirdi/kaybettirdi").
import { TUNING } from '../config.js';
import { esc } from './frame.js';
import { muhalif } from '../engines/world.js';
import { sbTopbar } from './cockpit.js';

const NAMES = { sportif: 'Sportif', taraftar: 'Taraftar', mali: 'Mali', itibar: 'İtibar', soz: 'Söz Tutma', aile: 'Aile' };
const KEYS = ['sportif', 'taraftar', 'mali', 'itibar', 'soz'];          // oy ağırlıklı 5 bileşen (ELECT_W)
const KART_KEYS = [...KEYS, 'aile'];                                     // karnede 6. kart: Aile (eşikli +2 oy bonusu)

// sb-cinematic KABUK (eski tema dersi — sezon sonu töreniyle aynı format): topbar faz çipi +
// sahne + bottombar; DEVAM etiketi adım mantığıyla burada üretilir (main.js sadeleşti).
function kabuk(G, inner, label, not) {
  return `<div class="sb-root sb-cinematic sn-root">
    <div class="sb-atmo"></div><div class="sb-vignette"></div>
    ${sbTopbar(G, { phaseChip: 'KONGRE SEÇİMİ · SANDIK' })}
    <div class="sb-body sb-body-col secim-toren-body"><div class="sn-fit">${inner}</div></div>
    <footer class="sb-bottombar">
      <div class="sb-bb-l"><span class="sb-bb-k">SEÇİM GECESİ</span><span class="sb-bb-note">${esc(not)}</span></div>
      <button class="sb-btn sb-btn-primary" data-act="devam">${esc(label)}</button>
    </footer>
  </div>`;
}

export function render(G) {
  const e = G.election;
  if (!e || !e.breakdown) return kabuk(G, '<div class="scene"><div class="overline">Seçim Gecesi</div><p class="muted">Sandık kuruluyor…</p></div>', 'DEVAM ▸', 'Sandık kuruluyor…'); // savunma: seçim verisi henüz yoksa çökme
  const b = e.breakdown;
  const step = e.revealStep ?? 0;

  const cards = KART_KEYS.map((k, i) =>
    `<div class="ec" style="opacity:${e.counting || e.done || i < step ? 1 : 0.18};transition:opacity .3s">
      <div class="k">${NAMES[k]}</div><div class="v tnum">${i < step || e.counting || e.done ? Math.round(b[k] ?? 0) : '?'}</div>
    </div>`).join('');

  // Faz 2: rakip son konuşması (kartlar açıldıktan sonra)
  const rivalBlock = step > KART_KEYS.length - 1 && !e.done
    ? `<div class="card" style="max-width:560px;margin:10px auto;border-color:var(--neg)">
        <div class="overline" style="color:var(--neg)">Rakip adayın son sözü</div>
        <div style="margin-top:6px;font-style:italic">${esc(e.rivalSpeech || '')}</div>
        <div class="muted" style="margin-top:6px">Rakip çekiciliği: <b class="neg">${Math.round(b.rival)}</b>${e.debateSwing ? ` · münazara etkisi: <b>${e.debateSwing > 0 ? '+' : ''}${e.debateSwing}</b>` : ''}${e.debateSkipped ? ' · <span class="neg">münazaradan kaçtın (−2)</span>' : ''}</div>
      </div>` : '';

  // GÖRSEL 5f: dev .led yüzde + iki aday barı + eşik çizgisi + sayım titremesi
  const oyGoster = (e.counting ? e.displayVoteShown : e.displayVote) || 0;
  // Kazanma çizgisi: seçim sonucunda hesaplanan gerçek eşiği kullan (küme-kal kulübünde %50'ye iner —
  // bkz. election.js eleksiyon.kazanmaCizgisi). Sonuç yoksa (canlı sayım öncesi) config tabanına düş.
  const esik = Math.round((e.kazanmaCizgisi ?? (G.cfg && G.cfg.WIN_LINE ? G.cfg.WIN_LINE : TUNING.WIN_LINE)) * 100);
  const voteTxt = (e.counting || e.done) ? `%${Math.round(oyGoster)}` : '—';
  const adayBar = (e.counting || e.done) ? `<div class="aday-bar">
    <div class="satir"><span>SEN</span><div class="track"><div class="sen" style="width:${Math.min(100, oyGoster)}%"></div><div class="esik-cizgi" style="left:${esik}%"></div></div></div>
    <div class="satir"><span class="muted">RAKİP</span><div class="track"><div class="rakip" style="width:${Math.max(0, 100 - oyGoster)}%"></div></div></div>
    <div class="micro" style="text-align:right">kesikli çizgi: kazanma çizgisi %${esik}</div>
  </div>` : '';
  let result = '';
  if (e.done) {
    result = e.kazandi
      ? `<div class="vote led result-won">KAZANDIN</div>
         <div class="donem-damga">${G.meta.term + 1}. DÖNEM</div>
         <div class="muted" style="margin-top:8px">Konfeti, tezahürat, rozet tazelendi.</div>`
      : `<div class="vote led result-lost">KAYBETTİN</div><div class="muted">Makam odası sessiz. Devir-teslim raporu hazırlanıyor.</div>${yakanBoyut(G)}`;
    // Faz 5: analiz + sandık açılımı + (kayıpta) veda — GENİŞ 3 SÜTUN (tek uzun kolon ölçeklenince
    // ortadan kırpılıyordu — kullanıcı raporu 2026-07-21; veda artık grid'in 3. paneli)
    const W = TUNING.ELECT_W;
    const contribs = KEYS.map((k) => ({ k, c: W[k] * b[k] })).sort((x, y) => y.c - x.c);
    const best = contribs[0], worst = contribs[contribs.length - 1];
    const analiz = `<div class="card">
      <div class="overline">Analiz — seni ne ${e.kazandi ? 'seçtirdi' : 'kaybettirdi'}?</div>
      <div class="fin-lines" style="margin-top:6px">
        ${contribs.map((x) => `<div class="l"><span>${NAMES[x.k]}</span><b class="tnum">+${x.c.toFixed(1)}</b></div>`).join('')}
        <div class="l"><span>Aile desteği</span><b class="tnum ${b.aileBonus ? 'pos' : ''}">${b.aileBonus ? '+2 oy — salonda ön sıradaydılar' : 'sandığa uzak kaldılar (+0)'}</b></div>
        <div class="l"><span class="neg">Rakip çekiciliği</span><b class="tnum neg">−${(b.rival * TUNING.RIVAL_FACTOR).toFixed(1)}</b></div>
        ${e.debateSwing ? `<div class="l"><span>Münazara/kampanya</span><b class="tnum">${e.debateSwing > 0 ? '+' : ''}${e.debateSwing}</b></div>` : ''}
      </div>
      <div class="muted" style="font-size:12px;margin-top:8px">En büyük koz: <b>${NAMES[best.k]}</b> · En zayıf halka: <b>${NAMES[worst.k]}</b></div>
    </div>`;
    result += `<div class="sn-done-grid">${analiz}${blokAcilimi(b)}${e.kazandi ? '' : farewell(G)}</div>`;
  }

  const inner = `<div class="scene secim-sahne ${e.done && !e.kazandi ? 'kaybettin-gri' : ''}" style="max-width:1080px">
    <div class="overline">Seçim Gecesi · Kongre üyeleri oy kullanıyor…</div>
    <h2 style="margin:6px 0">Dönem Karnesi</h2>
    <div class="elect-cards">${cards}</div>
    ${rivalBlock}
    <div class="vote led tnum ${e.counting ? 'sayim' : ''}" style="color:${e.done ? '' : 'var(--club-2)'}">${voteTxt}</div>
    ${adayBar}
    ${result}
  </div>`;
  // DEVAM etiketi — adım mantığı (eski main.js shell'inden taşındı; KART_KEYS 6'lı sabitle hizalı)
  const revealing = step <= KART_KEYS.length && !e.counting && !e.done;
  const label = e.done ? (e.kazandi ? 'Yeni Döneme Başla ▸' : 'Kariyer Sonu ▸')
    : e.counting ? 'Seçimi Sonlandır ▸'
      : revealing ? (step < KART_KEYS.length ? 'Karneyi Aç ▸' : 'Rakibi Dinle ▸') : 'Oyları Say ▸';
  const not = e.done ? (e.kazandi ? 'Kongre güven tazeledi — rozet yenilendi' : 'Devir-teslim raporu hazırlanıyor') : 'Kongre üyeleri oy kullanıyor…';
  return kabuk(G, inner, label, not);
}

// KONGRE 2.6: sandık blok açılımı — hangi seçmen kütlesi ne verdi.
// KART_KEYS'e DOKUNMAZ (6'lı revealStep sabiti aynı); eski kayıt sonuçlarında bloklar yoksa boş döner.
function blokAcilimi(b) {
  if (!b || !b.bloklar) return '';
  const D = TUNING.DELEGE;
  const rows = Object.entries(D.BLOK).map(([k, B]) => {
    const blk = b.bloklar[k];
    if (!blk) return '';
    return `<div class="l"><span>${B.ad} <span class="muted">(%${Math.round(B.pay * 100)})</span></span>
      <b class="tnum">${Math.round(blk.oy)} <span class="muted" style="font-weight:400">· ilişki ${blk.iliski}</span></b></div>`;
  }).join('');
  const d = b.dEtki || 0;
  return `<div class="card" style="max-width:520px;margin:10px auto;text-align:left">
    <div class="overline">Sandık Açılımı — Delege Blokları</div>
    <div class="fin-lines" style="margin-top:6px">${rows}
      <div class="l"><span>Blok ilişkilerinin net etkisi</span><b class="tnum ${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}">${d > 0 ? '+' : ''}${d.toFixed(1)} puan</b></div>
    </div>
  </div>`;
}

// B5d: hangi taraftar boyutu seni yaktı — kaybediş analizine tek satır
function yakanBoyut(G) {
  const b = G.boyutlar;
  if (!b) return '';
  const TR = { transfer: 'Transfer sessizliği', stil: 'Oyun stili ("korkak futbol" algısı)', kimlik: 'Kimlik kopuşu' };
  const dusuk = Object.entries({ transfer: b.transfer, stil: b.stil, kimlik: b.kimlik }).sort((x, y) => x[1] - y[1])[0];
  if (!dusuk || dusuk[1] >= 48) return '';
  return `<div class="muted" style="margin-top:6px;font-size:13px">Sandık analizi: seni asıl yakan boyut — <b style="color:var(--neg)">${TR[dusuk[0]]}</b> (${Math.round(dusuk[1])}/100).</div>`;
}

// Y8: KAYBETME VEDA SAHNESİ — boş makam odası + kurul vedaları (loyalty'e göre) + muhalif gazetecinin
// adil vedası. sn-done-grid'in 3. paneli olarak KOMPAKT (3 veda — tek kolon çağındaki 5'li liste
// sahneyi taşırıyordu).
function farewell(G) {
  const vedalar = (G.board || []).slice(0, 3).map((m) => {
    const soz = m.loyalty >= 60
      ? `"Başkanım… yolun açık olsun. Bu odada seninle çalışmak şerefti."`
      : m.loyalty < 45
        ? `"Kongre konuştu. Anahtarları masaya bırakın lütfen."`
        : `"Böyle günler de var. Kulüp hepimizden büyük."`;
    return `<div class="sn-veda"><b>${esc(m.name)} <span class="muted">(${esc(m.archetype)})</span></b><i>${soz}</i></div>`;
  }).join('');
  const mj = muhalif((G.data || {}).media);
  const mjBlock = mj ? `<div class="sn-veda sn-veda-mj"><b>📰 ${esc(mj.name)} — veda yazısı</b>
      <i>"Yıllarca eleştirdim; hakkını teslim edeyim: koltuğa yapışmadı, sandığın önünde eğildi. Kaybetti ama kulübü ayakta bıraktı."</i></div>` : '';
  return `<div class="card">
    <div class="overline">Boş makam odası — ışıklar sönüyor</div>
    <div class="muted" style="font-size:12px;margin:6px 0">Kutular toplandı. Duvarda arma, masada devir-teslim dosyası…</div>
    ${vedalar}
    ${mjBlock}
  </div>`;
}
