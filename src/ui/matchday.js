// src/ui/matchday.js — MAÇ GÜNÜ sinematik akış (v3-H / D5):
// pre (tünel/karşılaşma + gerçekçi tahmin) → ht/late (karar) → live (yayın skorbordu) →
// post (dramatik sonuç). Ortak gece stadyumu backdrop'u tüm fazlarda. Faz ilerletme main.js DEVAM'ında.
import { esc } from './frame.js';

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
  if (m.phase === 'pre') return pre(G, m);
  if (m.phase === 'ht') return ht(G, m);
  if (m.phase === 'late') return late(G, m);
  if (m.phase === 'live') return live(G, m);
  return post(G, m);
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

// ── LIVE: yayın skorbordu + momentum + akan ticker ──
function live(G, m) {
  const cls = (m.myGoals ?? 0) > (m.oppGoals ?? 0) ? 'w' : (m.myGoals ?? 0) < (m.oppGoals ?? 0) ? 'l' : 'd';
  const rows = (m.highlights || []).map((h, i) => `<div class="md-tick ${h.type === 'gol' ? (h.side === 'biz' ? 'gol-biz' : 'gol-onlar') : ''}" style="animation-delay:${Math.min(i, 8) * 90}ms">
    <span class="md-tick-b">${esc(h.text)}${h.type === 'gol' ? ` <b>${h.side === 'biz' ? '⚽ ' + esc(G.club.name) : '⚽ ' + esc(m.oppName)}</b>` : ''}</span>
  </div>`).join('');
  const trib = (m.tribun || []).map((t) => `<div class="md-trib ${t.mood || ''}">📣 <b>${esc(t.who)}:</b> ${esc(t.text)}</div>`).join('');
  return `<div class="md-scene md-live ${m.isDerby ? 'derbi' : ''}">
    <div class="md-stad tall">${stadBg(cls)}<span class="md-canli live">● CANLI</span>
      <div class="md-board">
        <span class="md-board-team home">${esc(G.club.name)}</span>
        <span class="md-board-score led">${m.myGoals ?? '·'}<i>-</i>${m.oppGoals ?? '·'}</span>
        <span class="md-board-team away">${esc(m.oppName)}</span>
      </div>
      <div class="md-board-dk">90'${m.htScore ? ` · İY ${m.htScore.my}-${m.htScore.opp}` : ''}</div>
    </div>
    <div class="md-momentum"><div class="biz" style="width:${m.momentum}%"></div><span class="md-mom-lbl">momentum — baskı payımız</span></div>
    <div class="md-ticker">${rows}</div>
    ${trib ? `<div class="md-trib-box"><div class="overline">Tribün akışı</div>${trib}</div>` : ''}
  </div>`;
}

// ── POST: dramatik sonuç — bant + büyük skor + xG + gecenin adamı ──
function post(G, m) {
  const cls = m.myRes === 'W' ? 'w' : m.myRes === 'L' ? 'l' : 'd';
  const label = m.myRes === 'W' ? 'GALİBİYET' : m.myRes === 'L' ? 'MAĞLUBİYET' : 'BERABERLİK';
  const ikon = m.myRes === 'W' ? '🎉' : m.myRes === 'L' ? '💔' : '🤝';
  const notlar = (m.notlar || []).map((n) => `<span class="md-not ${n.gecninAdami ? 'yildiz' : ''}">${n.gecninAdami ? '⭐ ' : ''}${esc(n.name)} <b>${n.not.toFixed(1)}</b></span>`).join('');
  const xgT = Math.max(m.xgFor + m.xgAgn, 0.01);
  return `<div class="md-scene md-post ${cls}">
    <div class="md-stad">${stadBg(cls)}<span class="md-result-banner ${cls}">${ikon} ${label}</span></div>
    <div class="md-final">
      <span class="md-final-team">${esc(G.club.name)}</span>
      <span class="md-final-score led ${cls}">${m.myGoals}<i>-</i>${m.oppGoals}</span>
      <span class="md-final-team muted">${esc(m.oppName)}</span>
    </div>
    <div class="md-final-sub tnum">Lig ${m.myPos}. sıra${m.htScore ? ` · İY ${m.htScore.my}-${m.htScore.opp}` : ''}</div>
    <div class="md-xg">
      <div class="micro">xG karşılaştırma</div>
      <div class="md-xg-row"><span>biz</span><div class="md-xg-bar"><i class="club" style="width:${(m.xgFor / xgT) * 100}%"></i></div><b class="tnum">${m.xgFor.toFixed(1)}</b></div>
      <div class="md-xg-row"><span>onlar</span><div class="md-xg-bar"><i class="opp" style="width:${(m.xgAgn / xgT) * 100}%"></i></div><b class="tnum">${m.xgAgn.toFixed(1)}</b></div>
    </div>
    <div class="md-sentence">${sentence(m)}</div>
    ${m.karakter ? `<div class="muted" style="margin-top:6px;font-style:italic;text-align:center">📰 "${esc(m.karakter)}"</div>` : ''}
    ${m.htNote ? `<div class="muted" style="margin-top:4px;font-size:12px;text-align:center">${esc(m.htNote)}</div>` : ''}
    <div class="md-notlar">${notlar}</div>
    <div class="micro" style="text-align:center;margin-top:2px">⭐ gecenin adamı</div>
  </div>`;
}

function sentence(m) {
  if (m.myRes === 'W' && m.xgFor < m.xgAgn) return '“Kazandık ama oyun rakibindi — şanslıydık, xG yalan söylemez.”';
  if (m.myRes === 'W') return '“Sahada üstün taraf bizdik, hak edilmiş galibiyet.”';
  if (m.myRes === 'L' && m.xgFor > m.xgAgn) return '“Üretime rağmen kaybettik; skor yalan söyledi.”';
  if (m.myRes === 'L') return '“Rakip daha istekliydi.”';
  return '“Dengeli mücadele, adil sonuç.”';
}
