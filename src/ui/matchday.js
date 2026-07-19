// src/ui/matchday.js — MAÇ GÜNÜ sinematik akış (v3-H / D5):
// pre (tünel/karşılaşma + gerçekçi tahmin) → ht/late (karar) → live (yayın skorbordu) →
// post (dramatik sonuç). Ortak gece stadyumu backdrop'u tüm fazlarda. Faz ilerletme main.js DEVAM'ında.
import { esc } from './frame.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Ortak GECE STADYUMU backdrop — asset yok: çim + projektör huzmeleri + tribün silüeti.
// tone: 'club' (nötr/club rengi), 'w' (yeşil zafer), 'l' (kırmızı), 'd' (nötr).
function stadBg(tone = 'club') {
  const glow = tone === 'w' ? 'rgba(63,191,127,.22)' : tone === 'l' ? 'rgba(224,82,82,.20)' : 'rgba(var(--club-rgb),.20)';
  const heads = Array.from({ length: 22 }, (_, i) => `<circle cx="${18 + i * 40}" cy="${150 + (i % 4) * 4}" r="${10 + (i % 3) * 3}" fill="rgba(4,7,14,.7)"/>`).join('');
  return `<svg class="md-stad-svg" viewBox="0 0 900 180" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs>
      <radialGradient id="md-flood" cx="50%" cy="-10%" r="75%"><stop offset="0" stop-color="${glow}"/><stop offset="1" stop-color="transparent"/></radialGradient>
      <linearGradient id="md-pitch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(30,80,50,.30)"/><stop offset="1" stop-color="rgba(10,25,18,.10)"/></linearGradient>
    </defs>
    <rect width="900" height="180" fill="var(--bg-0)"/>
    <rect width="900" height="180" fill="url(#md-flood)"/>
    <path d="M120 180 L340 120 L560 120 L780 180 Z" fill="url(#md-pitch)"/>
    <line x1="450" y1="120" x2="450" y2="180" stroke="rgba(255,255,255,.06)"/>
    <ellipse cx="450" cy="120" rx="46" ry="12" fill="none" stroke="rgba(255,255,255,.06)"/>
    <g opacity=".85">${heads}</g>
    <path d="M150 -10 L120 90 M300 -14 L290 86 M600 -14 L610 86 M750 -10 L780 90" stroke="rgba(255,255,255,.05)" stroke-width="10"/>
  </svg>`;
}

// Krest (takım arması) — kendi kulüp rengi / rakip nötr
function crest(letter, home) {
  return `<span class="md-crest ${home ? 'home' : 'away'}">${esc((letter || '?')[0])}</span>`;
}

function h32(s) { let h = 0; const t = String(s); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return h; }
// Skorbord takım bloğu (ev solda / konuk sağda) — mine → kulüp rengi rozet, rakip → nötr
function teamBlock(name, sub, mine, side) {
  const badge = `<span class="sb-sb-badge ${mine ? '' : 'sb-sb-badge-2'}">${esc((name || '?')[0])}</span>`;
  const info = `<div><div class="sb-sb-name">${esc(name)}</div><div class="sb-sb-sub">${esc(sub)}</div></div>`;
  return side === 'home' ? `<div class="sb-sb-team sb-sb-home">${info}${badge}</div>` : `<div class="sb-sb-team">${badge}${info}</div>`;
}

// Gerçekçi tahmin barı (G/B/M)
function oddsBar(t) {
  if (!t) return '';
  return `<div class="md-odds" title="G %${t.W} · B %${t.D} · M %${t.L}">
    <div class="md-odds-bar"><span class="g" style="width:${t.W}%"></span><span class="b" style="width:${t.D}%"></span><span class="m" style="width:${t.L}%"></span></div>
    <div class="md-odds-lbl"><span class="pos">Galibiyet %${t.W}</span><span>Berabere %${t.D}</span><span class="neg">Mağlubiyet %${t.L}</span></div>
  </div>`;
}

export function render(G) {
  const m = G.pendingMatch;
  // SAVUNMA: maçsız hafta (router normalde engeller ama render tek başına da ayakta kalmalı)
  if (!m) {
    return `<div class="md-scene md-pre">
      <div class="md-stad">${stadBg('club')}<span class="md-canli">STAT SESSİZ</span></div>
      <div class="md-head"><span class="overline">Maç günü değil</span></div>
      <p class="lore" style="text-align:center">Fikstürde bu hafta karşılaşma yok — projektörler kapalı, çimler dinleniyor.</p>
    </div>`;
  }
  if (m.phase === 'pre') return pre(G, m);
  if (m.phase === 'ht') return ht(G, m);
  if (m.phase === 'late') return late(G, m);
  if (m.phase === 'live') return live(G, m);
  return post(G, m);
}

// KADRO YÖNÜ eğilim notu (maçın açıklığı) — matchCtx.yonT'den okunur, belirgin sapmada görünür
function yonNotu(G) {
  const yt = G.matchCtx?.yonT || 1;
  if (yt >= 1.03) return '<div class="muted" style="text-align:center;font-size:11px;margin-top:4px">⚔ Kadro hücuma dönük — açık maç eğilimi (çok gol atarsın, biraz açık verirsin)</div>';
  if (yt <= 0.97) return '<div class="muted" style="text-align:center;font-size:11px;margin-top:4px">🛡 Kadro savunmacı — kapalı maç eğilimi (az gol yersin, gol de zor gelir)</div>';
  return '';
}

// ── PRE: tünel/karşılaşma — krestler yüz yüze, güç, gerçekçi tahmin, TD planı ──
function pre(G, m) {
  return `<div class="md-scene md-pre ${m.isDerby ? 'derbi' : ''}">
    <div class="md-stad">${stadBg('club')}<span class="md-canli">MAÇ GÜNÜ</span></div>
    <div class="md-head"><span class="overline">Karşılaşma · ${m.isHome ? '🏟 ' + esc(G.club.stadName || 'Ev sahası') : '✈ Deplasman'}</span>${m.isDerby ? '<span class="md-derby-badge">DERBİ</span>' : ''}</div>
    <div class="md-vs">
      <div class="md-team">${crest(G.club.name, true)}<b>${esc(G.club.name)}</b><i>güç <span class="tnum">${m.guc.biz}</span></i></div>
      <div class="md-vs-mid"><span class="md-vs-x">VS</span></div>
      <div class="md-team">${crest(m.oppName, false)}<b>${esc(m.oppName)}</b><i>güç <span class="tnum">${m.guc.onlar}</span></i></div>
    </div>
    ${oddsBar(m.tahmin)}
    <div class="md-plan">🎙 ${esc(m.plan)} <span class="muted">— ${esc(G.coach.name)}</span></div>
    ${yonNotu(G)}
    ${m.protokol && !m.protokol.done ? `<div class="md-protokol">
      <div class="overline">Protokol tüneli · ${esc(m.protokol.baskan)} elini uzattı</div>
      <div class="btnrow" style="margin-top:6px;justify-content:center">
        <button class="btn" data-act="protokol" data-arg="soguk">🧊 Soğuk geç</button>
        <button class="btn" data-act="protokol" data-arg="diplomatik">🤝 Diplomatik</button>
        <button class="btn" data-act="protokol" data-arg="samimi">😄 Samimi kucakla</button>
      </div>
      <div class="muted" style="font-size:11px;margin-top:4px;text-align:center">radikaller soğuğu sever · samimiyet ılımlıları ısıtır · tipine göre cevap verir</div>
    </div>` : m.protokol && m.protokol.done ? `<div class="muted" style="margin-top:8px;font-size:12px;text-align:center">Protokolde hava: ${esc(m.protokol.cevap || '')}</div>` : ''}
    ${m.isDerby ? '<div class="md-uğultu">Tribün uğultusu şimdiden duyuluyor…</div>' : ''}
  </div>`;
}

// ── DEVRE ARASI — büyük skor + tespit + başkan hamlesi ──
function ht(G, m) {
  const h = m.ht || { my: 0, opp: 0, tespit: '' };
  const cls = h.my > h.opp ? 'w' : h.my < h.opp ? 'l' : 'd';
  return `<div class="md-scene md-decision ${cls}">
    <div class="md-stad">${stadBg(cls)}<span class="md-canli">DEVRE ARASI · 45'</span></div>
    <div class="md-head"><span class="overline">Soyunma Odası</span>${m.isDerby ? '<span class="md-derby-badge">DERBİ</span>' : ''}</div>
    <div class="md-mini-vs">${esc(G.club.name)} <span class="md-score ${cls}">${h.my}<i>-</i>${h.opp}</span> ${esc(m.oppName)}</div>
    <div class="md-tespit">“${esc(h.tespit)}”</div>
    <div class="overline" style="margin-top:14px">Başkan hamlesi</div>
    <div class="btnrow" style="justify-content:center;margin-top:8px">
      <button class="btn" data-act="htMove" data-arg="soyunma">🚪 Soyunma odasına in <span class="muted">(risk/ödül)</span></button>
      <button class="btn" data-act="htMove" data-arg="tdguven">🤝 TD'ye güven</button>
      ${m.isHome ? '<button class="btn" data-act="htMove" data-arg="tribun">📣 Tribünü ateşle</button>' : ''}
    </div>
  </div>`;
}

// ── SON 10 DK — kritik an ──
function late(G, m) {
  const l = m.late || { my: 0, opp: 0, trigger: '' };
  const cls = l.my > l.opp ? 'w' : l.my < l.opp ? 'l' : 'd';
  return `<div class="md-scene md-decision ${cls}">
    <div class="md-stad">${stadBg(cls)}<span class="md-canli" style="color:#ff9a9a">SON 10 DAKİKA · KRİTİK AN</span></div>
    <div class="md-mini-vs">${esc(G.club.name)} <span class="md-score ${cls}">${l.my}<i>-</i>${l.opp}</span> ${esc(m.oppName)}</div>
    <div class="md-tespit">${l.trigger === 'kaybediyor' ? 'Tabela aleyhine — kenardan işaret bekliyorlar.' : 'Puan elde — koruyacak mısın, üstüne mi gideceksin?'}</div>
    <div class="btnrow" style="justify-content:center;margin-top:12px">
      ${l.trigger === 'kaybediyor' ? '<button class="btn" data-act="lateMove" data-arg="dok">⚔ Her şeyi öne dök</button>' : '<button class="btn" data-act="lateMove" data-arg="koru">🛡 Koru</button>'}
      <button class="btn" data-act="lateMove" data-arg="devam">TD bilir (karışma)</button>
    </div>
  </div>`;
}

// ── LIVE: CANLI YAYIN — saat-güdümlü oynatma (skorbord + akan anlatım + istatistik + telkin + kontroller).
//   Maç TAM hesaplı (highlights 0-90); UI dakika dakika REVEAL eder (RNG'ye dokunmaz). Saat main.js timer'ında.
function live(G, m) {
  const clock = Math.max(0, Math.min(90, m._clock ?? 0));
  const playing = !!m._playing;
  const speed = m._speed || 1;
  const bitti = clock >= 90;
  const shown = (m.highlights || []).filter((h) => h.min <= clock);
  const myG = shown.filter((h) => h.type === 'gol' && h.side === 'biz').length;
  const oppG = shown.filter((h) => h.type === 'gol' && h.side === 'onlar').length;
  const cls = myG > oppG ? 'w' : myG < oppG ? 'l' : 'd';
  const dk = bitti ? 'MAÇ SONU' : clock === 0 ? "0'" : clock >= 45 && clock < 46 ? "İY" : clock + "'";
  const frac = clock / 90;
  const isHome = m.isHome;
  const mySira = m.myPos ? ' · ' + m.myPos + '. sıra' : '';
  const mineBlock = (side) => teamBlock(G.club.name, (isHome ? 'Ev sahibi' : 'Konuk') + mySira, true, side);
  const oppBlock = (side) => teamBlock(m.oppName, isHome ? 'Konuk' : 'Ev sahibi', false, side);
  const homeBlock = isHome ? mineBlock('home') : oppBlock('home');
  const awayBlock = isHome ? oppBlock('away') : mineBlock('away');
  const homeG = isHome ? myG : oppG, awayG = isHome ? oppG : myG;
  // Akan anlatım (yeni üstte)
  const icon = (h) => (h.type === 'gol' ? '⚽' : h.type === 'kacan' ? '◦' : /kart|sarı|kırmızı/.test(h.text) ? '▮' : '•');
  const feed = shown.slice().reverse().map((h) => `<div class="sb-feed-i ${h.type === 'gol' ? 'is-goal' : ''}"><span class="sb-feed-m">${h.min}'</span><span class="sb-feed-ic">${icon(h)}</span><span class="sb-feed-t">${esc(h.text)}</span></div>`).join('')
    || `<div class="sb-feed-i"><span class="sb-feed-ic">🏟</span><span class="sb-feed-t">${clock === 0 ? 'Takımlar sahada — düdük bekleniyor. Başlatmak için ▷ Oynat.' : 'Henüz kayda değer bir an yok…'}</span></div>`;
  // İstatistik (deterministik, saatle dolar)
  const mom = Math.round(m.momentum ?? 50);
  const homePoss = isHome ? mom : 100 - mom;
  const sut = (xg, g) => Math.max(g, Math.round(xg * frac * 6.5));
  const mySut = sut(m.xgFor, myG), oppSut = sut(m.xgAgn, oppG);
  const xgTxt = (v) => (v * frac).toFixed(1).replace('.', ',');
  const kor = (salt) => Math.round(frac * (2 + (h32(m.oppName + salt) % 6)));
  const myKor = kor('b'), oppKor = kor('o');
  const bar = (lPct) => `<div class="sb-bar sb-bar-split"><span class="sb-bar-fill" style="width:${clamp(lPct, 2, 98)}%"></span></div>`;
  const stat = (l, lbl, r) => `<div class="sb-mrow"><span>${l}</span><span class="sb-muted">${lbl}</span><span>${r}</span></div>`;
  const xgL = isHome ? m.xgFor : m.xgAgn, xgR = isHome ? m.xgAgn : m.xgFor;
  const korL = isHome ? myKor : oppKor, korR = isHome ? oppKor : myKor;
  // TD'ye telkin — maç durumunu yansıtan yayın çipi (kenar tonu)
  const tone = bitti ? -1 : (myG < oppG ? 1 : (myG > oppG && clock > 65 ? 2 : 0));
  const telkin = [['🧊', 'Sakin ol · kontrolü koru'], ['🔥', 'Baskı yap · gol ara'], ['🛡', 'Kaleyi koru · sonucu tut']]
    .map(([ik, tx], i) => `<div class="sb-tel ${tone === i ? 'sb-tel-active' : ''}">${ik} ${tx}</div>`).join('');
  const lig = (G.hazirlik || 0) > 0 ? 'HAZIRLIK MAÇI' : 'LİG MAÇI';
  const venue = `${esc(G.club.stadName || 'Stadyum')}${m.isDerby ? ' · DERBİ' : ''}`;
  // AİLE LOCASI (Özel Hayat köprüsü) — ev sıcaksa aile tribünde; iç saha + salt görsel doku
  const oz = G.ozel;
  const loca = oz && isHome
    ? (oz.g.ev >= 60
      ? `<div class="md-loca" data-tip="Ev huzuru yüksek — ailen bu akşam locada">💗 LOCADA: ${esc(oz.aile?.es || '')}${m.isDerby ? `, ${esc(oz.aile?.c2 || '')}` : ''} · el sallıyorlar</div>`
      : oz.g.ev < 40
        ? '<div class="md-loca soguk" data-tip="Ev huzuru düşük — loca bu akşam boş">🪑 Aile locası boş bu akşam</div>'
        : '')
    : '';
  return `<div class="sb-root sb-cinematic md-bc md-bc-${cls}">
    <div class="sb-atmo sb-atmo-pitch"></div><div class="sb-vignette"></div><div class="sb-pitch-lines"></div>
    <div class="sb-mac-top">
      <span class="sb-mac-venue">${(G.hazirlik || 0) > 0 ? 'HAZIRLIK · LİGE ' + G.hazirlik + ' HAFTA' : 'HAFTA ' + Math.min(G.meta.week, G.SEASON_WEEKS)}</span>
      <span class="sb-chip sb-chip-live"><i class="sb-dot-live"></i>${bitti ? 'MAÇ BİTTİ' : 'CANLI'} · ${lig}</span>
      <span class="sb-mac-venue">${venue}</span>
    </div>
    ${loca}
    <div class="sb-scoreboard">
      ${homeBlock}
      <div class="sb-sb-center"><div class="sb-sb-score"><span class="sb-sb-num ${isHome ? 'sb-club-ink' : ''}">${homeG}</span><span class="sb-sb-dash">-</span><span class="sb-sb-num ${!isHome ? 'sb-club-ink' : ''}">${awayG}</span></div><div class="sb-sb-clock">${dk}</div></div>
      ${awayBlock}
    </div>
    <div class="sb-mac-body">
      <div class="sb-panel sb-feed"><div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">CANLI ANLATIM</span></div><div class="sb-feed-list">${feed}</div></div>
      <div class="sb-side">
        <div class="sb-panel">
          <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">MAÇ İSTATİSTİĞİ</span></div>
          <div class="sb-mstat"><b class="${isHome ? 'sb-club-ink' : ''}">${isHome ? mySut : oppSut}</b><span>ŞUT</span><b class="${!isHome ? 'sb-club-ink' : ''}">${isHome ? oppSut : mySut}</b></div>
          ${stat('%' + homePoss, 'TOPLA OYNAMA', '%' + (100 - homePoss))}${bar(homePoss)}
          ${stat(xgTxt(xgL), 'BEKLENEN GOL (xG)', xgTxt(xgR))}${bar(Math.round(xgL / Math.max(m.xgFor + m.xgAgn, 0.01) * 100))}
          ${stat(korL, 'KORNER', korR)}${bar(Math.round(korL / Math.max(myKor + oppKor, 1) * 100))}
        </div>
        <div class="sb-panel sb-panel-grow">
          <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">TD'YE TELKİN</span></div>
          <div class="sb-tel-note">${esc(m.plan || 'Sahada karar TD\'nin — kenardan tonu sen belirlersin, Başkanım.')}</div>
          ${telkin}
        </div>
      </div>
    </div>
    <footer class="sb-bottombar">
      <div class="sb-bb-l"><span class="sb-bb-k">${bitti ? 'MAÇ BİTTİ' : 'CANLI'}</span><span class="sb-bb-note">${bitti ? esc(sentence(m)) : 'Maçı izle, kenardan tonu belirle — sonuç kasaya ve güvene yansır.'}</span></div>
      <div class="sb-mac-ctrls">
        ${bitti
    ? '<button class="sb-btn sb-btn-primary" data-act="devam">Sonuç ekranı ►</button>'
    : `<button class="sb-btn" data-act="matchSpeed" data-tip="Oynatma hızı">⏩ ${speed}x</button><button class="sb-btn" data-act="matchFinish" data-tip="Kalanını atla, sonuca git">⏭ Maçı Bitir</button><button class="sb-btn sb-btn-primary" data-act="matchPlay">${playing ? '❚❚ Duraklat' : '▷ Oynat'}</button>`}
      </div>
    </footer>
  </div>`;
}

// ── POST: dramatik sonuç — bant + büyük skor + xG + gecenin adamı ──
// ── POST: MAÇ SONUCU — canlı yayın diliyle sonuç ekranı (banner + skorbord + xG + gecenin adamı) ──
function post(G, m) {
  const cls = m.myRes === 'W' ? 'w' : m.myRes === 'L' ? 'l' : 'd';
  const label = m.myRes === 'W' ? 'GALİBİYET' : m.myRes === 'L' ? 'MAĞLUBİYET' : 'BERABERLİK';
  const ikon = m.myRes === 'W' ? '🎉' : m.myRes === 'L' ? '💔' : '🤝';
  const isHome = m.isHome;
  const mySira = m.myPos ? ' · ' + m.myPos + '. sıra' : '';
  const mineBlock = (side) => teamBlock(G.club.name, (isHome ? 'Ev sahibi' : 'Konuk') + mySira, true, side);
  const oppBlock = (side) => teamBlock(m.oppName, isHome ? 'Konuk' : 'Ev sahibi', false, side);
  const homeBlock = isHome ? mineBlock('home') : oppBlock('home');
  const awayBlock = isHome ? oppBlock('away') : mineBlock('away');
  const homeG = isHome ? m.myGoals : m.oppGoals, awayG = isHome ? m.oppGoals : m.myGoals;
  const xgT = Math.max(m.xgFor + m.xgAgn, 0.01);
  const notlar = (m.notlar || []).map((n) => `<div class="sb-not ${n.gecninAdami ? 'yildiz' : ''}"><span>${n.gecninAdami ? '⭐ ' : ''}${esc(n.name)}</span><b>${n.not.toFixed(1)}</b></div>`).join('');
  const lig = (G.hazirlik || 0) > 0 ? 'HAZIRLIK MAÇI' : 'LİG MAÇI';
  const bbNote = m.myRes === 'W' ? 'Hak edilmiş üç puan — kasaya ve güvene yansır.' : m.myRes === 'L' ? 'Bu hafta olmadı; kongre izliyor.' : 'Dengeli bir mücadele, adil sonuç.';
  return `<div class="sb-root sb-cinematic md-bc md-bc-${cls} md-result">
    <div class="sb-atmo sb-atmo-pitch"></div><div class="sb-vignette"></div><div class="sb-pitch-lines"></div>
    <div class="sb-mac-top">
      <span class="sb-mac-venue">${(G.hazirlik || 0) > 0 ? 'HAZIRLIK' : 'HAFTA ' + Math.min(G.meta.week, G.SEASON_WEEKS)}</span>
      <span class="sb-chip sb-chip-live sb-chip-${cls}"><i class="sb-dot-live"></i>MAÇ SONUCU · ${lig}</span>
      <span class="sb-mac-venue">${esc(G.club.stadName || 'Stadyum')}${m.isDerby ? ' · DERBİ' : ''}</span>
    </div>
    <div class="sb-result-banner ${cls}">${ikon} ${label}</div>
    <div class="sb-scoreboard">
      ${homeBlock}
      <div class="sb-sb-center"><div class="sb-sb-score"><span class="sb-sb-num ${isHome ? 'sb-club-ink' : ''}">${homeG}</span><span class="sb-sb-dash">-</span><span class="sb-sb-num ${!isHome ? 'sb-club-ink' : ''}">${awayG}</span></div><div class="sb-sb-clock">Lig ${m.myPos}.${m.htScore ? ` · İY ${m.htScore.my}-${m.htScore.opp}` : ''}</div></div>
      ${awayBlock}
    </div>
    <div class="sb-mac-body sb-result-body">
      <div class="sb-panel">
        <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">MAÇ ÖZETİ · xG</span></div>
        <div class="sb-xg2"><span>biz</span><div class="sb-bar sb-bar-split"><span class="sb-bar-fill" style="width:${Math.round(m.xgFor / xgT * 100)}%"></span></div><b>${m.xgFor.toFixed(1)}</b></div>
        <div class="sb-xg2"><span>onlar</span><div class="sb-bar sb-bar-split"><span class="sb-bar-fill" style="width:${Math.round(m.xgAgn / xgT * 100)}%;background:var(--ink-3)"></span></div><b>${m.xgAgn.toFixed(1)}</b></div>
        <div class="sb-sentence">${sentence(m)}</div>
        ${m.karakter ? `<div class="sb-result-note">📰 "${esc(m.karakter)}"</div>` : ''}
        ${m.htNote ? `<div class="sb-result-note">${esc(m.htNote)}</div>` : ''}
      </div>
      <div class="sb-panel sb-result-side">
        <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">⭐ GECENİN ADAMI</span></div>
        <div class="sb-notlar">${notlar || '<div class="sb-tel-note">Puanlar hazırlanıyor…</div>'}</div>
      </div>
    </div>
    <footer class="sb-bottombar">
      <div class="sb-bb-l"><span class="sb-bb-k">MAÇ SONU</span><span class="sb-bb-note">${bbNote}</span></div>
      <button class="sb-btn sb-btn-primary" data-act="devam">Devam ►</button>
    </footer>
  </div>`;
}

function sentence(m) {
  if (m.myRes === 'W' && m.xgFor < m.xgAgn) return '“Kazandık ama oyun rakibindi — şanslıydık, xG yalan söylemez.”';
  if (m.myRes === 'W') return '“Sahada üstün taraf bizdik, hak edilmiş galibiyet.”';
  if (m.myRes === 'L' && m.xgFor > m.xgAgn) return '“Üretime rağmen kaybettik; skor yalan söyledi.”';
  if (m.myRes === 'L') return '“Rakip daha istekliydi.”';
  return '“Dengeli mücadele, adil sonuç.”';
}
