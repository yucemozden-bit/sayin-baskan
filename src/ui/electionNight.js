// src/ui/electionNight.js — Seçim gecesi TAM SAHNE (v3-I / D7):
// 1) karne kartları TEK TEK açılır (DEVAM) → 2) rakip son konuşması → 3) salınımlı sayım
// → 4) sonuç sahnesi → 5) bileşen analiz dökümü ("seni X seçtirdi/kaybettirdi").
import { TUNING } from '../config.js';
import { esc } from './frame.js';
import { muhalif } from '../engines/world.js';

const NAMES = { sportif: 'Sportif', taraftar: 'Taraftar', mali: 'Mali', itibar: 'İtibar', soz: 'Söz Tutma' };
const KEYS = ['sportif', 'taraftar', 'mali', 'itibar', 'soz'];

export function render(G) {
  const e = G.election;
  if (!e || !e.breakdown) return '<div class="scene"><div class="overline">Seçim Gecesi</div><p class="muted">Sandık kuruluyor…</p></div>'; // savunma: seçim verisi henüz yoksa çökme
  const b = e.breakdown;
  const step = e.revealStep ?? 0;

  const cards = KEYS.map((k, i) =>
    `<div class="ec" style="opacity:${e.counting || e.done || i < step ? 1 : 0.18};transition:opacity .3s">
      <div class="k">${NAMES[k]}</div><div class="v tnum">${i < step || e.counting || e.done ? Math.round(b[k]) : '?'}</div>
    </div>`).join('');

  // Faz 2: rakip son konuşması (kartlar açıldıktan sonra)
  const rivalBlock = step > KEYS.length - 1 && !e.done
    ? `<div class="card" style="max-width:560px;margin:10px auto;border-color:var(--neg)">
        <div class="overline" style="color:var(--neg)">Rakip adayın son sözü</div>
        <div style="margin-top:6px;font-style:italic">${esc(e.rivalSpeech || '')}</div>
        <div class="muted" style="margin-top:6px">Rakip çekiciliği: <b class="neg">${Math.round(b.rival)}</b>${e.debateSwing ? ` · münazara etkisi: <b>${e.debateSwing > 0 ? '+' : ''}${e.debateSwing}</b>` : ''}${e.debateSkipped ? ' · <span class="neg">münazaradan kaçtın (−2)</span>' : ''}</div>
      </div>` : '';

  // GÖRSEL 5f: dev .led yüzde + iki aday barı + eşik çizgisi + sayım titremesi
  const oyGoster = (e.counting ? e.displayVoteShown : e.displayVote) || 0;
  const esik = Math.round((G.cfg && G.cfg.WIN_LINE ? G.cfg.WIN_LINE : TUNING.WIN_LINE) * 100);
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
      : `<div class="vote led result-lost">KAYBETTİN</div><div class="muted">Makam odası sessiz. Devir-teslim raporu hazırlanıyor.</div>${yakanBoyut(G)}${farewell(G)}`;
    // Faz 5: analiz dökümü — ağırlıklı katkılar
    const W = TUNING.ELECT_W;
    const contribs = KEYS.map((k) => ({ k, c: W[k] * b[k] })).sort((x, y) => y.c - x.c);
    const best = contribs[0], worst = contribs[contribs.length - 1];
    result += `<div class="card" style="max-width:520px;margin:14px auto;text-align:left">
      <div class="overline">Analiz — seni ne ${e.kazandi ? 'seçtirdi' : 'kaybettirdi'}?</div>
      <div class="fin-lines" style="margin-top:6px">
        ${contribs.map((x) => `<div class="l"><span>${NAMES[x.k]}</span><b class="tnum">+${x.c.toFixed(1)}</b></div>`).join('')}
        <div class="l"><span class="neg">Rakip çekiciliği</span><b class="tnum neg">−${(b.rival * TUNING.RIVAL_FACTOR).toFixed(1)}</b></div>
        ${e.debateSwing ? `<div class="l"><span>Münazara/kampanya</span><b class="tnum">${e.debateSwing > 0 ? '+' : ''}${e.debateSwing}</b></div>` : ''}
      </div>
      <div class="muted" style="font-size:12px;margin-top:8px">En büyük koz: <b>${NAMES[best.k]}</b> · En zayıf halka: <b>${NAMES[worst.k]}</b></div>
    </div>`;
  }

  return `<div class="scene secim-sahne ${e.done && !e.kazandi ? 'kaybettin-gri' : ''}" style="max-width:760px">
    <div class="overline">Seçim Gecesi · Kongre üyeleri oy kullanıyor…</div>
    <h2 style="margin:6px 0">Dönem Karnesi</h2>
    <div class="elect-cards">${cards}</div>
    ${rivalBlock}
    <div class="vote led tnum ${e.counting ? 'sayim' : ''}" style="color:${e.done ? '' : 'var(--club-2)'}">${voteTxt}</div>
    ${adayBar}
    ${result}
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

// Y8: KAYBETME VEDA SAHNESİ — boş makam odası + kurul vedaları (loyalty'e göre) + muhalif gazetecinin adil vedası
function farewell(G) {
  const vedalar = (G.board || []).slice(0, 5).map((m) => {
    const soz = m.loyalty >= 60
      ? `"Başkanım… yolun açık olsun. Bu odada seninle çalışmak şerefti."`
      : m.loyalty < 45
        ? `"Kongre konuştu. Anahtarları masaya bırakın lütfen."`
        : `"Böyle günler de var. Kulüp hepimizden büyük."`;
    return `<div class="l"><span>${esc(m.name)} <span class="muted">(${esc(m.archetype)})</span></span><i style="text-align:right">${soz}</i></div>`;
  }).join('');
  const mj = muhalif((G.data || {}).media);
  const mjBlock = mj ? `<div class="msg" style="margin-top:10px;text-align:left">
      <div class="t">📰 ${esc(mj.name)} — veda yazısı</div>
      <div class="b">"Yıllarca bu köşeden eleştirdim; bugün hakkını teslim edeyim: koltuğa yapışmadı, sandığın önünde eğildi. Kaybetti ama kulübü ayakta bıraktı. Bu şehirde herkes bunu yapamazdı."</div>
    </div>` : '';
  return `<div class="card" style="max-width:560px;margin:14px auto;text-align:left">
    <div class="overline">Boş makam odası — ışıklar tek tek sönüyor</div>
    <div class="muted" style="font-size:12px;margin:6px 0">Kutular toplandı. Duvarda arma, masada devir-teslim dosyası. Kurul üyeleri kapıda…</div>
    <div class="fin-lines">${vedalar}</div>
    ${mjBlock}
  </div>`;
}
