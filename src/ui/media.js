// src/ui/media.js — BASIN TOPLANTISI v2: her hafta bağlamsal BİR soru, başkan
// repliğiyle cevap (ton → makeDemec mekaniği: taraftar/PFDK/federasyon hattı).
// Soru seçimi DETERMİNİSTİK (hafta + bağlam; rng tüketilmez). Sağ: hava/akış/arşiv.
import { esc } from './frame.js';
import { isCriticalWeek } from '../actions.js';
import { PRESS_POOL } from '../data/pressPool.js';
import { TUNING } from '../config.js';

const TONE_LABEL = { iddiali: 'İddialı', sakin: 'Sakin', savunmaci: 'Savunmacı', atesli: 'Ateşli' };
// Etkiler TUNING.PRESS ile birebir — her tonun artısı VE eksisi yazar
const TONE_FX = {
  iddiali: '+ Taraftar coşar · − kurul güveni kırpılır',
  sakin: '+ Medya yumuşar, federasyon hattı düzelir · − tribünü coşturmaz',
  savunmaci: '+ Kurul güveni artar · − tribün soğur',
  atesli: '+ Taraftar coşar, kimya yükselir · − itibar düşer, medya sertleşir, PFDK riski',
};

// Haftanın sorusu: bağlam kategorisi > genel havuz (52 soru) — DETERMİNİSTİK, rng tüketmez.
// Öncelik: derbi > mağlubiyet > galibiyet > küme hattı > liderlik > mali kriz > pencere > genel.
// Kariyer+sezon tohumu: aynı hafta FARKLI kariyerde/sezonda farklı soru (tekdüzelik kırılır)
function pressSalt(G) {
  const nm = (G.club && G.club.name) || '';
  let h = 0; for (let i = 0; i < nm.length; i++) h = (h * 31 + nm.charCodeAt(i)) & 0xffff;
  return h + (G.worldSeason || 1) * 7 + (G.meta.term || 1) * 3;
}
// Haftanın sorusu — DETERMİNİSTİK ama gidişata uygun + çeşitli (rng tüketmez).
function soruSec(G) {
  const wk = G.meta.week, P = PRESS_POOL, salt = pressSalt(G);
  const lig = G.lig || 1;
  const rec = G.recent || [];
  const son = rec.slice(-1)[0];
  const oynadi = rec.length > 0;

  // ── 2. LİG — kendi 50'lik havuzu (hepsi 2. lig mantığına uygun; Avrupa/şampiyonluk YOK) ──
  if (lig === 2) {
    // hafif bağlam: son sonuç havuzun farklı bölgesine kaydırır (galibiyet/mağlubiyet hissi)
    const ofs = son === 0 ? 11 : son === 3 ? 23 : son === 1 ? 5 : 0;
    return P.lig2[(wk + salt + ofs) % P.lig2.length];
  }

  // ── SÜPER LİG — bağlamsal kategoriler (200 soru) ──
  const pick = (arr) => arr[(wk + salt) % arr.length];
  const secimSezonu = (G.meta.season || 1) >= (TUNING.SEASONS_PER_TERM || 3); // dönemin son (seçim) sezonu
  let streak = 0; for (let i = rec.length - 1; i >= 0; i--) { if (rec[i] === 3) streak++; else break; }

  if (!oynadi && wk <= 2) { // SEZON AÇILIŞI — bağlama uygun giriş
    if (secimSezonu) return pick(P.secim);
    return pick(P.acilis);
  }
  if (isCriticalWeek(G)) return pick(P.derbi);
  if (oynadi && son === 0) return pick(P.maglubiyet);
  if (streak >= 3) return pick(P.seri);
  if (oynadi && son === 3 && (wk + salt) % 2 === 0) return pick(P.galibiyet);
  if ((G.myPos || 9) >= 16) return pick(P.kume);
  if (secimSezonu && wk >= 8) return pick(P.secim);
  if ((G.myPos || 9) === 1 && wk > 4) return pick(P.lider);
  if (G.economy && G.economy.borc > G.economy.kasa * 1.6) return pick(P.mali);
  if (G.transferWindow && (wk + salt) % 3 === 1) return pick(P.transfer);
  if ((wk + salt) % 5 === 0) return pick(P.vaat);
  return P.genel[(wk + salt) % P.genel.length];
}

// Basın odası sahnesi — asset yok: sponsor duvarı (kulüp monogramı) + spot + podyum +
// mikrofonlar + kamera flaşları + gazeteci silüetleri. Havaya (mediaTone) göre renklenir.
function pressStage(G, tone) {
  const mono = esc((G.club && G.club.name || 'S')[0]);
  const havaRenk = tone > 0.5 ? 'rgba(63,191,127,.10)' : tone < -0.5 ? 'rgba(224,82,82,.12)' : 'rgba(var(--club-rgb),.10)';
  const mic = (x) => `<g transform="translate(${x} 118)"><rect x="-2" y="0" width="4" height="34" rx="2" fill="rgba(210,220,235,.35)"/><ellipse cx="0" cy="-4" rx="7" ry="11" fill="rgba(230,238,250,.55)"/><ellipse cx="0" cy="-4" rx="4" ry="7" fill="rgba(120,135,160,.5)"/></g>`;
  const heads = Array.from({ length: 9 }, (_, i) => `<circle cx="${44 + i * 100}" cy="176" r="${26 + (i % 3) * 5}" fill="rgba(4,7,14,.82)"/>`).join('');
  const flashes = [130, 300, 470, 640, 810].map((x, i) => `<circle class="med-flash f${i % 3}" cx="${x}" cy="${44 + (i % 2) * 26}" r="3.4" fill="#fff"/>`).join('');
  return `<div class="med-stage">
    <svg viewBox="0 0 900 168" preserveAspectRatio="xMidYMax slice" class="med-stage-svg">
      <defs>
        <pattern id="med-wall" width="118" height="70" patternUnits="userSpaceOnUse" patternTransform="rotate(-4)">
          <text x="30" y="44" font-family="var(--font-display)" font-weight="800" font-size="30" fill="rgba(255,255,255,.035)">${mono}</text>
          <circle cx="92" cy="20" r="3" fill="rgba(var(--club-rgb),.10)"/>
        </pattern>
        <radialGradient id="med-spot" cx="50%" cy="-8%" r="70%"><stop offset="0" stop-color="${havaRenk}"/><stop offset="1" stop-color="transparent"/></radialGradient>
      </defs>
      <rect width="900" height="168" fill="var(--bg-0)"/>
      <rect width="900" height="168" fill="url(#med-wall)"/>
      <rect width="900" height="168" fill="url(#med-spot)"/>
      <path d="M450 -20 L340 150 L560 150 Z" fill="rgba(255,255,255,.03)"/>
      <rect x="360" y="120" width="180" height="48" rx="6" fill="rgba(10,15,26,.85)" stroke="rgba(var(--club-rgb),.3)"/>
      <text x="450" y="150" text-anchor="middle" font-family="var(--font-display)" font-weight="800" font-size="16" fill="rgba(var(--club-rgb),.55)">${mono}</text>
      ${mic(420)}${mic(450)}${mic(480)}
      ${heads}
      ${flashes}
    </svg>
    <span class="med-canli">● CANLI YAYIN</span>
  </div>`;
}

// Cevabın SOMUT +/- yankısı — hangi gösterge nasıl etkilendi (olumlu yeşil ▲ / olumsuz kırmızı ▼)
function etkiPanel(fx) {
  if (!fx) return '';
  const kalem = [
    { ad: 'Taraftar coşkusu', d: fx.taraftar },
    { ad: 'Kurul güveni', d: fx.guven },
    { ad: 'İtibar', d: fx.itibar },
    { ad: 'Takım kimyası', d: fx.kimya },
    { ad: 'Medya havası', d: fx.medya, medya: true },
  ];
  const siddet = (d) => (Math.abs(d) >= 3 ? 'çok' : Math.abs(d) >= 1 ? '' : 'hafif');
  const rows = kalem.filter((k) => Math.abs(k.d) >= 0.05).map((k) => {
    const arti = k.d > 0;
    const s = siddet(k.d);
    const not = k.medya ? (arti ? 'yumuşadı' : 'sertleşti') : (arti ? 'yükseldi' : 'düştü');
    return `<div class="med-fx ${arti ? 'arti' : 'eksi'}"><span>${arti ? '▲' : '▼'} ${k.ad}</span><b>${s ? s + ' ' : ''}${not}</b></div>`;
  });
  if (fx.ceza > 0) rows.push(`<div class="med-fx eksi"><span>▼ PFDK cezası</span><b>−${(Math.round(fx.ceza * 10) / 10)}mn kasadan</b></div>`);
  if (!rows.length) return '<div class="med-fx-bos">Ölçülebilir bir dalga yaratmadı — sakin geçti.</div>';
  return `<div class="med-fx-liste">${rows.join('')}</div>`;
}

export function render(G) {
  const wk = G.meta.week;
  const tone = G.mediaTone || 0;
  const toneTxt = tone > 0.5 ? 'Dostane 🟢' : tone < -0.5 ? 'Düşmanca 🔴' : 'Nötr ⚪';
  const js = ((G.data || {}).media || {}).journalists || [];
  const gazeteci = js.length ? js[wk % js.length].name : 'Salondan bir muhabir';
  const soru = soruSec(G);

  const cevaplar = soru.c.map(([ton, replik]) => `<button class="med-cevap" data-act="demec" data-arg="${ton}">
      <span class="med-ton">${TONE_LABEL[ton]}</span>
      <b>«${replik}»</b>
      <i>${TONE_FX[ton]}</i>
    </button>`).join('');
  const soruHead = `<div class="med-muhabir">
    <span class="med-ava">${esc((gazeteci || '?')[0])}</span>
    <span class="med-muhabir-yazi"><b>${esc(gazeteci)}</b><em>MUHABİR · ${esc(soru.t)}</em></span>
  </div>`;
  const govde = G.demecUsed
    ? `${soruHead}
      <div class="med-soru">“${esc(soru.q)}”</div>
      <div class="med-cevaplandi">🎙 Kürsüde <b>${TONE_LABEL[G.lastDemecTone] || ''}</b> tonda konuştun — işte yankısı:</div>
      ${etkiPanel(G.lastDemecFx)}
      <div class="tr-not">Manşetler yola çıktı; etki göstergelere işledi. Salon gelecek hafta yeniden toplanır.</div>`
    : `${soruHead}
      <div class="med-soru">“${esc(soru.q)}”</div>
      <div class="med-kursu-not">🎤 Kürsü senin, Başkanım — nasıl cevaplarsın?</div>
      <div class="med-cevaplar">${cevaplar}</div>
      <div class="tr-not">Haftada TEK basın toplantısı — cevabın tonu medya havasını, taraftarı ve federasyon hattını oynatır.</div>`;

  const headlines = (G.inbox || []).filter((m) => m.cat === 'manset' || m.cat === 'demec').slice(0, 6)
    .map((m) => `<div class="msg"><div class="t">${esc(m.t)}</div><div class="b">${esc(m.b)}</div></div>`).join('');

  return `<div class="tr-wrap">
    <div class="tr-head">
      <div><div class="overline">Medya Merkezi</div><h2>Basın Toplantısı</h2></div>
      <span class="tesis-kasa" style="border-color:var(--line)"><i>BASIN HAVASI</i><b style="color:var(--ink-1);font-size:15px">${toneTxt}</b></span>
    </div>
    <div class="med-grid">
      <div class="tr-panel med-salon">
        ${pressStage(G, tone)}
        <div class="med-govde">${govde}</div>
      </div>
      <div class="tr-sol">
        <div class="tr-panel">
          <div class="cx-panel-head"><span class="overline">Sosyal Akış ${(G.socialFeed || []).some((p) => p.viral) ? '🔥' : ''}</span></div>
          ${(G.socialFeed || []).slice(0, 3).map((p) => `<div class="balon ${p.viral ? 'viral' : ''}">${p.viral ? '🔥 ' : ''}${esc(p.text)}</div>`).join('') || '<div class="muted" style="font-size:12px">Akış sakin.</div>'}
        </div>
        <div class="tr-panel med-arsiv">
          <div class="cx-panel-head"><span class="overline">Manşet Arşivi</span></div>
          <div class="med-arsiv-list">${headlines || '<div class="muted" style="font-size:12px">Henüz manşet yok.</div>'}</div>
        </div>
      </div>
    </div>
  </div>`;
}
