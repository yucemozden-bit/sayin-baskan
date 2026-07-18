// src/ui/media.js — BASIN TOPLANTISI v2: her hafta bağlamsal BİR soru, başkan
// repliğiyle cevap (ton → makeDemec mekaniği: taraftar/PFDK/federasyon hattı).
// Soru seçimi DETERMİNİSTİK (hafta + bağlam; rng tüketilmez). Sağ: hava/akış/arşiv.
import { esc } from './frame.js';
import { isCriticalWeek, promiseStatus } from '../actions.js';
import { PRESS_POOL, MUHABIRLER } from '../data/pressPool.js';
import { TUNING } from '../config.js';
import { sbShell } from './cockpit.js';

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
// SÖZÜN HESABI: aktif mühürlü söz varsa muhabir bazen DOĞRUDAN onu sorar (omurga bağlantısı)
function sozSorusu(G) {
  const st = promiseStatus(G).filter((v) => v.pct < 100 && v.pct > 0);
  if (!st.length) return null;
  const wk = G.meta.week, salt = pressSalt(G);
  if ((wk + salt) % 4 !== 2) return null; // ~4 haftada bir sözün hesabı sorulur
  const v = st[(wk + salt) % st.length];
  return {
    t: 'SÖZÜN HESABI', soz: v.name,
    q: `"${v.name}" sözü verdiniz. Durum: ${v.label}. Kamuoyu takipte — ne diyorsunuz?`,
    c: [
      ['iddiali', 'Söz namustur — takvimin önündeyiz, göreceksiniz.'],
      ['sakin', 'Adım adım ilerliyoruz; işi lafla değil icraatla anlatacağız.'],
      ['savunmaci', 'Şartlar herkes için aynı değil; süreç işliyor.'],
    ],
  };
}

// Haftanın sorusu — DETERMİNİSTİK ama gidişata uygun + çeşitli (rng tüketmez).
function soruSec(G) {
  const sozQ = sozSorusu(G);
  if (sozQ) return sozQ;
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

// Cevabın SOMUT yankısı — OK + SAYI formatı: "Taraftar 60 → 64 ▲(+4)" (önce→sonra okunur)
function etkiPanel(fx) {
  if (!fx) return '';
  const s = fx.snap || {};
  const satir = (ad, once, delta, birim = '') => {
    if (Math.abs(delta) < 0.05) return '';
    const sonra = Math.round((once + delta) * 10) / 10;
    const arti = delta > 0;
    return `<div class="med-fx ${arti ? 'arti' : 'eksi'}"><span>${ad}</span><b class="tnum">${Math.round(once)}${birim} → ${Math.round(sonra)}${birim} ${arti ? '▲' : '▼'}(${arti ? '+' : ''}${Math.round(delta)})</b></div>`;
  };
  const rows = [
    satir('Taraftar', s.taraftar ?? 0, fx.taraftar),
    satir('Kurul güveni', s.guven ?? 0, fx.guven),
    satir('İtibar', s.itibar ?? 0, fx.itibar),
    satir('Takım kimyası', s.kimya ?? 0, fx.kimya),
    Math.abs(fx.medya) >= 0.05 ? `<div class="med-fx ${fx.medya > 0 ? 'arti' : 'eksi'}"><span>Basın havası</span><b>${havaAd(s.medya ?? 0)} → ${havaAd((s.medya ?? 0) + fx.medya)} ${fx.medya > 0 ? '▲' : '▼'}</b></div>` : '',
    fx.hedef ? `<div class="med-fx eksi" data-tip="İddia beklenti doğurur — kongrede sportif ölçüm bu hedefe göre"><span>Kurul hedefi</span><b class="tnum">${s.hedef}. → ${s.hedef + fx.hedef}. sıra ⚠ ÇITA YÜKSELDİ</b></div>` : '',
    fx.ceza > 0 ? `<div class="med-fx eksi"><span>PFDK cezası</span><b>−${(Math.round(fx.ceza * 10) / 10)}mn kasadan</b></div>` : '',
  ].filter(Boolean);
  if (!rows.length) return '<div class="med-fx-bos">Ölçülebilir bir dalga yaratmadı — sakin geçti.</div>';
  return `<div class="med-fx-liste">${rows.join('')}</div>`;
}

// Basın havası: 5 kademe (mediaTone → kelime)
function havaAd(t) { return t <= -1 ? 'Düşman' : t <= -0.35 ? 'Soğuk' : t < 0.35 ? 'Nötr' : t < 1 ? 'Ilık' : 'Dost'; }
function havaSerit(tone) {
  const kademeler = ['Düşman', 'Soğuk', 'Nötr', 'Ilık', 'Dost'];
  const aktif = havaAd(tone);
  return `<div class="med-hava" data-tip="Basın havası manşet tonunu, kriz haberi sıklığını ve federasyon hattını etkiler — sakin cevaplar ısıtır, ateşli çıkışlar soğutur">
    ${kademeler.map((k) => `<span class="med-hava-k ${k === aktif ? 'on' : ''} ${k === 'Düşman' || k === 'Soğuk' ? 'neg' : k === 'Nötr' ? '' : 'pos'}">${k}</span>`).join('<i>─</i>')}
  </div>`;
}

// Boşken bile yaşayan sosyal akış — nötr taraftar gönderileri (deterministik rotasyon)
const AKIS_FALLBACK = [
  '🐦 Yeni başkan bugün basın karşısına çıkıyor. Hayırlısı. — YıldızlıYıllar34',
  '🐦 Kombine yenileme kuyruğu vardı bugün, fena değil. — TribünSesi',
  '🐦 Rakip forum bizi konuşuyor yine 👀 — GüneyYakası',
  '🐦 Hocanın hafta içi idman fotoğrafları düşmüş, yüzler gülüyor. — KapalıTribün',
];

export function render(G) {
  const wk = G.meta.week;
  const tone = G.mediaTone || 0;
  const muhabir = MUHABIRLER[wk % MUHABIRLER.length];
  const soru = soruSec(G);

  const cevaplar = soru.c.map(([ton, replik]) => `<button class="med-cevap" data-act="demec" data-arg="${ton}">
      <span class="med-ton">${TONE_LABEL[ton]}</span>
      <b>«${replik}»</b>
      <i>${TONE_FX[ton]}${soru.soz && ton === 'iddiali' ? ' · ⚠ tutmazsan kongrede karşına çıkar' : ''}</i>
    </button>`).join('');
  const soruHead = `<div class="med-muhabir">
    <span class="med-ava" data-tip="${esc(muhabir.kimlik)}">${esc(muhabir.ad[0])}</span>
    <span class="med-muhabir-yazi"><b>${esc(muhabir.ad)}</b><em>${esc(muhabir.kimlik.toUpperCase())} · ${esc(soru.t)}</em></span>
  </div>`;
  // KAPANIŞ SAHNESİ: cevap verildiyse YARININ MANŞETİ kupürü + sayısal etki
  const kupur = (G.mansetArsiv || [])[0];
  const govde = G.demecUsed
    ? `${soruHead}
      <div class="med-soru">“${esc(soru.q)}”</div>
      <div class="med-cevaplandi">🎙 Kürsüde <b>${TONE_LABEL[G.lastDemecTone] || ''}</b> tonda konuştun — işte yarının gazetesi:</div>
      ${kupur ? `<div class="med-kupur"><div class="med-kupur-ust">SPOR SAYFASI</div>
        <div class="med-kupur-manset">"${esc(kupur.t)}"</div>
        <div class="med-kupur-alt">${esc(kupur.kim)} · ${esc(kupur.kimlik)} · Sezon ${kupur.sezon}, Hafta ${kupur.hafta}</div>
      </div>` : ''}
      ${etkiPanel(G.lastDemecFx)}
      <div class="tr-not">Bu haftanın toplantısı: <b>KULLANILDI</b> · yenisi: Hafta ${Math.min(wk + 1, G.SEASON_WEEKS || 34)}. Kupür arşive işlendi.</div>`
    : `${soruHead}
      <div class="med-soru">“${esc(soru.q)}”</div>
      <div class="med-kursu-not">🎤 Kürsü senin, Başkanım — nasıl cevaplarsın?</div>
      <div class="med-cevaplar">${cevaplar}</div>
      <div class="tr-not">Bu haftanın toplantısı: <b>KULLANILMADI</b> — haftada TEK hak; cevabın tonu manşeti, taraftarı ve federasyon hattını oynatır.</div>`;

  // MANŞET ARŞİVİ: her toplantının kupürü kronolojik birikir (medya hikâyen)
  const arsivRows = (G.mansetArsiv || []).slice(0, 6)
    .map((k) => `<div class="med-arsiv-kupur"><b>"${esc(k.t)}"</b><i>${esc(k.kim)} · S${k.sezon} H${k.hafta}</i></div>`).join('');
  const eskiMansetler = !arsivRows ? (G.inbox || []).filter((m) => m.cat === 'manset').slice(0, 4)
    .map((m) => `<div class="med-arsiv-kupur"><b>${esc(m.t)}</b><i>${esc(m.b)}</i></div>`).join('') : '';

  // SOSYAL AKIŞ: boşken bile yaşar (nötr taraftar gönderileri rotasyonu)
  const feed = (G.socialFeed || []).slice(0, 3);
  const akis = feed.length
    ? feed.map((p) => `<div class="balon ${p.viral ? 'viral' : ''}">${p.viral ? '🔥 ' : ''}${esc(p.text)}</div>`).join('')
    : [AKIS_FALLBACK[wk % AKIS_FALLBACK.length], AKIS_FALLBACK[(wk + 2) % AKIS_FALLBACK.length]]
      .map((t) => `<div class="balon" style="opacity:.75">${esc(t)}</div>`).join('');

  const body = `<div style="flex:1;min-height:0;display:flex;flex-direction:column;gap:.7em;overflow:hidden">
    ${havaSerit(tone)}
    <div class="med-grid">
      <div class="tr-panel med-salon">
        ${pressStage(G, tone)}
        <div class="med-govde">${govde}</div>
      </div>
      <div class="tr-sol">
        <div class="tr-panel">
          <div class="cx-panel-head"><span class="overline">Sosyal Akış ${(G.socialFeed || []).some((p) => p.viral) ? '🔥' : ''}</span></div>
          ${akis}
        </div>
        ${(G.promises || []).some((p) => p.kept === null) ? `<div class="tr-panel"><div class="cx-panel-head"><span class="overline">Mühürlü Sözler</span><span class="cx-hint">basın bunların hesabını sorar</span></div>
          ${promiseStatus(G).filter((v) => v.pct < 100).slice(0, 3).map((v) => `<div class="med-soz-mini"><span>▸ ${esc(v.name)}</span><em>${esc(v.label)}</em></div>`).join('')}
        </div>` : ''}
        <div class="tr-panel med-arsiv">
          <div class="cx-panel-head"><span class="overline">Manşet Arşivi</span><span class="cx-hint">${(G.mansetArsiv || []).length} kupür</span></div>
          <div class="med-arsiv-list">${arsivRows || eskiMansetler || '<div class="muted" style="font-size:12px">İlk toplantının kupürü buraya düşecek.</div>'}</div>
        </div>
      </div>
    </div>
  </div>`;
  const crumb = `MEDYA · BASIN HAVASI ${havaAd(tone).toUpperCase()} · SOSYAL AKIŞ ${feed.length ? 'CANLI' : 'SAKİN'}`;
  return sbShell(G, { crumb, title: 'Basın Toplantısı', body });
}
