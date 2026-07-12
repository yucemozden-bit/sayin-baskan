// src/main.js — Oyun kontrolcüsü: veri yükleme + faz makinesi (V6-§5) + render yönlendirme.
// UI aksiyonları TEK yerden (dispatch) actions.js'e gider. ui/ state okur, motor çağırmaz.

import { TUNING } from './config.js';
import { eventBus } from './core/eventBus.js';
import { serialize, deserialize } from './core/save.js';
import * as A from './actions.js';
import { shell } from './ui/frame.js';
import * as clubSelect from './ui/clubSelect.js';
import * as promiseSelect from './ui/promiseSelect.js';
import * as cockpit from './ui/cockpit.js';
import * as inbox from './ui/inbox.js';
import * as finance from './ui/finance.js';
import * as matchday from './ui/matchday.js';
import * as seasonEnd from './ui/seasonEnd.js';
import * as electionNight from './ui/electionNight.js';
import * as playerCard from './ui/playerCard.js';
import * as setupUi from './ui/setup.js';
import * as squadView from './ui/squadView.js';
import * as transferView from './ui/transferView.js';
import * as facilitiesView from './ui/facilitiesView.js';
import * as media from './ui/media.js';
import * as congress from './ui/congress.js';
import * as dataHub from './ui/dataHub.js';
import * as clubView from './ui/clubView.js';
import { renderCampaign, renderDebate } from './ui/campaignView.js';
import * as opposition from './ui/opposition.js';
import * as careerEnd from './ui/careerEnd.js';
import * as settings from './ui/settings.js';
import { setVolume, setAmbience, ugultu } from './core/sound.js';
import { applyClubTheme } from './ui/theme.js';
import { FX, setEnabled, getSound } from './core/sound.js';
import { esc as escH } from './ui/frame.js';
import { topNudge } from './engines/objectives.js';

const app = document.getElementById('app');
let G = null;

// ── Veri yükle (Live Server üzerinden fetch) ──
async function boot() {
  const load = (f) => fetch(`src/data/${f}`).then((r) => r.json());
  try {
    const [teams, promises, names, mediaData, firms, eventsD, social, boardnames, scenarios, achievements, sponsorsD] = await Promise.all([
      load('teams.json'), load('promises.json'), load('names.json'), load('media.json'), load('firms.json'), load('events.json'), load('social.json'), load('boardnames.json'), load('scenarios.json'), load('achievements.json'), load('sponsors.json')]);
    const data = { teams: teams.teams, promises: promises.promises, names, media: mediaData, firms, events: eventsD, social, boardnames, scenarios, achievements, sponsors: sponsorsD.sponsors };
    G = A.newGame(data, 'normal');
    globalThis.SB = { G, TUNING, A }; // konsol kancası
    autoLoadCheck(); // kayıtlı kariyer varsa açılışta "Devam Et" sunulur
    render();
  } catch (err) {
    app.innerHTML = `<div style="padding:40px;color:#E05252">Veri yüklenemedi. Live Server (http) ile açın.<br><small>${err}</small></div>`;
  }
}

// ── Render yönlendirici ──
function render() {
  let html;
  // K6: faz geçiş atmosferi — ölü geçiş yok; tam ekran kart, DEVAM ile kapanır
  if (G.transition) {
    const t = G.transition;
    let icerik;
    if (t.tip === 'muhur') {
      // AÇILIŞ ZAFERİ + MÜHÜR TÖRENİ — ~25sn'lik sahneli akış:
      // 0-10sn oylar GERİLİMLE sayılır (önde giden değişir, sonuç belli olmaz) → KAZANDIN
      // patlar (konfeti+ses) → 13.5sn'den itibaren parşömenler 2.8sn arayla belirir, her
      // damga ~1.2sn sonra tok sesle iner → dönem damgası + Ferda. DEVAM her an atlar.
      const z = t.zafer;
      const azalt = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const zaferBlok = z ? `<div class="secim-zafer">
          <div class="overline zg-ust" style="color:var(--pos)">Kongre Seçimi · Oylar Sayılıyor…</div>
          <div class="zafer-baslik led zg-kazandin">KAZANDIN</div>
          <div class="aday-bar" style="margin-top:8px">
            <div class="satir"><span class="zg-lbl-sen">${escH(z.baskanAd || 'SEN')} · 0</span><div class="track"><div class="sen" style="width:0%"></div></div></div>
            <div class="satir"><span class="muted zg-lbl-rakip">${escH(z.rakipAd)} · 0</span><div class="track"><div class="rakip" style="width:0%"></div></div></div>
          </div>
          <div class="muted zg-sonuc" style="font-size:12px;margin-top:6px">${escH(z.rakipAd)} sandıkta geride kaldı — koltuk senin. Şimdi imza vakti.</div>
        </div>` : '';
      const bazi = z ? (azalt ? 0 : 13500) : 0;   // sayım + zafer bitince tören başlar
      const aralik = z && !azalt ? 2800 : 900;    // parşömenler ağır ağır iner
      // AÇILIŞ 4: MÜHÜR TÖRENİ canlı oynar — parşömen belirir, damga gecikmeli iner
      const adlar = (t.vaatler && t.vaatler.length) ? t.vaatler : ['Laf değil, iş']; // 4b
      const damgaGecik = z && !azalt ? 1200 : 300;
      const parsomenler = adlar.map((ad, i) => `<div class="parsomen" style="animation-delay:${bazi + i * aralik}ms">
          <span class="damga" style="animation-delay:${bazi + i * aralik + damgaGecik}ms">TASDİK</span>
          <div class="micro">Kongre tutanağı · madde ${i + 1}</div>
          <b>${escH(ad)}</b>
        </div>`).join('');
      const son = bazi + (adlar.length - 1) * aralik + damgaGecik + 900; // son damgadan sonra başlık
      icerik = `<div class="scene" style="max-width:560px">
        ${zaferBlok}
        <div class="overline zg-toren-baslik" style="${z ? 'margin-top:16px;' : ''}animation-delay:${Math.max(0, bazi - 900)}ms">Mühür Töreni</div>
        <div style="display:grid;gap:10px;margin:14px 0;text-align:left">${parsomenler}</div>
        <div style="opacity:0;animation:parsomenGel .6s var(--ease) forwards;animation-delay:${son}ms">
          <div class="donem-damga">${escH(t.title)}</div>
          <div class="muted" style="font-style:italic;margin-top:10px">${escH(t.sub || '')}</div>
        </div>
      </div>`;
      if (!t._sesler) { // damga sesleri tek sefer; ekran atlanırsa (parşömen kalmaz) susar
        t._sesler = true;
        adlar.forEach((_, i) => setTimeout(() => { if (document.querySelector('.parsomen')) FX.muhur(); }, bazi + i * aralik + damgaGecik));
      }
      if (z && !t._zafer) { t._zafer = true; setTimeout(() => zaferSayimi(z, azalt), 60); } // konfetiAt() + FX.zafer sayım bitince
    } else {
      icerik = `<div class="scene" style="max-width:560px">
        <div style="font-size:44px">${t.icon || '⚽'}</div>
        <h2 style="margin:10px 0 6px;font-family:var(--serif);letter-spacing:2px">${escH(t.title)}</h2>
        <div class="muted" style="font-style:italic">${escH(t.sub || '')}</div>
      </div>`;
    }
    html = shell(G, {
      center: true, devam: { label: 'DEVAM ►', pulse: true },
      content: icerik,
    });
    app.innerHTML = html;
    document.body.classList.remove('kriz');
    return;
  }
  switch (G.phase) {
    case 'CLUB_SELECT':
      html = shell(G, { content: clubSelect.render(G), center: true, bare: true }); break; // AÇILIŞ 1a: topbar yok
    case 'SETUP': // kariyer kuruluşu: başkan adı + kulüp adı/renk + şehir + zorluk (bare — kariyer henüz yok)
      html = shell(G, { content: setupUi.render(G), center: true, bare: true }); break;
    case 'TERM_SETUP': {
      // M6: YENİ DÖNEM RİTÜELİ — vaatlerden önce tören: defter kartları + kurul önünde vizyon
      if (G.ritual && !G.ritual.done) { html = shell(G, { content: ritualScene(G), center: true }); break; }
      // v4.3-4: iki adım — 1/2 vaat, 2/2 direktif; buton her adımda sticky (devam-wrap)
      const step = G._setupStep || 1;
      // step 2'de alt bar YOK — CTA belgenin üstündeki "● MÜHÜRLE" (tutanak finaldir)
      const label = `Sözleri Mühürle (${(G._sel || []).length}/${TUNING.MAX_PROMISES}) → Direktif ►`;
      html = shell(G, { content: promiseSelect.render(G), devam: step === 1 ? { label, disabled: false, pulse: true } : null });
      break;
    }
    case 'OPPOSITION': {
      const bitti = G.opposition.season >= 3;
      html = shell(G, { content: opposition.render(G), center: true, devam: bitti ? null : { label: 'Sezonu İzle ►', pulse: true } });
      break;
    }
    case 'CAREER_END':
      html = shell(G, { content: careerEnd.render(G), center: true, devam: { label: 'Yeni Kariyer ►', pulse: true } }); break;
    case 'SEASON_LOOP':
      if (G.phone) { // Y2: TELEFON EKRANI KESER — inbox'a düşmez
        html = shell(G, { content: phoneModal(G), center: true });
      } else if (G.pendingMatch) {
        const needsChoice = G.pendingMatch.phase === 'ht' || G.pendingMatch.phase === 'late';
        html = shell(G, { content: matchday.render(G), center: true, devam: needsChoice ? null : { label: 'DEVAM ►', pulse: true } });
      } else {
        const screens = { cockpit, kadro: squadView, transfer: transferView, tesis: facilitiesView, finans: finance, medya: media, kongre: congress, veri: dataHub, kulup: clubView, inbox, ayarlar: settings };
        const screen = screens[G.nav] || cockpit;
        const hazir = (G.hazirlik || 0) > 0;
        const devamLbl = hazir ? (G.hazirlik === 1 ? 'Sezonu Başlat ►' : `Hazırlık Haftası ► (lige ${G.hazirlik})`) : 'Sonraki Maç ►';
        html = shell(G, { content: screen.render(G), nav: true, navActive: G.nav, devam: { label: devamLbl, sub: hazir ? 'Transfer dönemi — kadronu kur, maçlar sonra' : nextHint(G), pulse: true } });
      }
      break;
    case 'SEASON_END':
      html = shell(G, { content: seasonEnd.render(G), center: true, devam: { label: 'Yeni Sezona Başla ►', pulse: true } }); break;
    case 'CAMPAIGN':
      html = shell(G, { content: renderCampaign(G), center: true, devam: { label: `Kampanya haftasını bitir ► (${G.campaign?.tick}/3)`, pulse: true } }); break;
    case 'DEBATE':
      html = shell(G, { content: renderDebate(G), center: true }); break; // cevap butonları sahnede
    case 'ELECTION_NIGHT': {
      const e = G.election;
      const revealing = (e.revealStep ?? 0) <= 5 && !e.counting && !e.done;
      const label = e.done ? (e.kazandi ? 'Yeni Döneme Başla ►' : 'Kariyer Sonu ►')
        : e.counting ? 'Seçimi Sonlandır ►'
          : revealing ? (e.revealStep < 5 ? 'Karneyi Aç ►' : 'Rakibi Dinle ►') : 'Oyları Say ►';
      html = shell(G, { content: electionNight.render(G), center: true, devam: { label, disabled: false, pulse: true } });
      break;
    }
    case 'GAME_OVER':
      html = shell(G, { content: gameOver(G), center: true, devam: { label: 'Yeni Kariyer ►', pulse: true } }); break;
    default:
      html = '<div style="padding:40px" class="muted">Yükleniyor…</div>';
  }
  // OYUNCU KARTI overlay'i — kadrodaki oyuncuya tıklayınca açılır (satılan/giden oyuncuda kendini kapatır)
  if (G._pcard && (!G.squad || !G.squad.some((p) => String(p.id) === String(G._pcard)))) G._pcard = null;
  if (G._pcard) html += playerCard.render(G);
  if (G._achModal) html += clubView.renderAchModal(G); // başarım duvarı (kulüp ekranından "Tümünü Gör")
  app.innerHTML = html;
  document.body.classList.toggle('kontrast', !!G.uiKontrast); // Ayarlar → Yüksek Kontrast
  fitVaat(); // KAYDIRMASIZ GARANTİ: sahne ekrandan uzunsa orantılı küçült — asla taşmaz
  typewriterTepki(); // Makam Odası: GM tepkisi harf harf yazılır (toplantı hissi)
  canliSkorSayimi(); // Maç yayını: skor 0-0 başlar, goller ticker'a düştükçe TEK TEK artar
  // GÖRSEL KİMLİK §2: kulüp rengi runtime sızması (kariyer başında bir kez uygular)
  if (G.club && G.club.name) applyClubTheme(G);
  // Y7: kriz kırmızı vinyeti — gece yarısı telefonu ya da kritik gösterge
  const kriz = (G.phone && (G.phone.kind === 'skandal' || G.phone.kind === 'kriz'))
    || (G.gauges && (G.gauges.guven < 25 || G.gauges.mali < 20));
  document.body.classList.toggle('kriz', !!kriz);
  flushToasts(); // RETENTION: yeni açılan başarımlar/olaylar tören toast'ı olarak belirir
}

// KAYDIRMASIZ GARANTİ (GLOBAL): HİÇBİR ekranda scroll yok. Sahne içeriği görünür
// alandan uzunsa transform-scale ile orantılı küçültülür — her ekranda, her çözünürlükte
// her şey sığar. (Kullanıcı kuralı: "oyunun hiçbir ekranında scroll istemiyorum.")
function fitVaat() {
  const stage = app.querySelector('.stage');
  if (!stage) return;
  const el = stage.firstElementChild;
  if (!el) return;
  el.style.transform = ''; el.style.width = '';
  const avail = stage.clientHeight - 8;
  const need = el.scrollHeight;
  if (need > avail && avail > 160) {
    const s = Math.max(0.55, avail / need);
    el.style.transformOrigin = 'top left';
    el.style.transform = `scale(${s})`;
    el.style.width = `${(100 / s).toFixed(2)}%`;
  }
}

// SETUP inputları: re-render öncesi mevcut değerleri yakala (yoksa renk/zorluk tıkı yazılanı siler)
function readSetupInputs() {
  if (!G._setup) G._setup = {};
  const v = (id) => { const el = app.querySelector('#' + id); return el ? el.value : undefined; };
  const b = v('su-baskan'), k = v('su-kulup'), s = v('su-sehir');
  if (b !== undefined) G._setup.baskanAd = b;
  if (k !== undefined) G._setup.kulupAd = k;
  if (s !== undefined) G._setup.sehir = s;
}

// CANLI SKOR SAYIMI (ekrana kitleme): yayın skorbordu 0-0 açılır; her gol, ticker
// satırı belirirken TEK TEK işlenir (bizim goller gol sesiyle). DEVAM her an atlar;
// animasyon sonunda gerçek skor garantiye alınır.
function canliSkorSayimi() {
  const m = G && G.pendingMatch;
  if (!m || m.phase !== 'live' || m._canliOynadi) return;
  const board = app.querySelector('.md-board-score.led');
  if (!board) return;
  m._canliOynadi = true;
  const goller = (m.highlights || []).map((h, i) => ({ h, i })).filter((x) => x.h.type === 'gol');
  let my = 0, opp = 0;
  board.innerHTML = '0<i>-</i>0';
  goller.forEach((g, k) => {
    setTimeout(() => {
      if (!board.isConnected) return;
      if (g.h.side === 'biz') { my++; try { FX.gol(); } catch {} } else { opp++; try { FX.sayim && FX.sayim(); } catch {} }
      board.innerHTML = `${my}<i>-</i>${opp}`;
      board.classList.remove('skor-vurgu'); void board.offsetWidth; board.classList.add('skor-vurgu');
    }, 450 + Math.min(g.i, 8) * 90 + k * 140);
  });
  setTimeout(() => { if (board.isConnected) board.innerHTML = `${m.myGoals ?? 0}<i>-</i>${m.oppGoals ?? 0}`; }, 450 + goller.length * 240 + 900);
}

// Makam Odası: GM'in tepki repliği harf harf yazılır (~16ms/karakter). Aynı metin
// tekrar render edilirse animasyon TEKRARLAMAZ (tık her şeyi anında tamamlar).
function typewriterTepki() {
  const el = app.querySelector('.gm-balon.tepki');
  if (!el) { G._twLast = null; return; }
  const full = el.textContent;
  if (G._twLast === full) return;
  G._twLast = full;
  el.textContent = '';
  let i = 0;
  const id = setInterval(() => {
    if (!el.isConnected) { clearInterval(id); return; } // ekran değişti — söndür
    el.textContent = full.slice(0, ++i);
    if (i >= full.length) clearInterval(id);
  }, 16);
}

// ═══ TOAST KATMANI — render app.innerHTML'i silse de bu katman ayakta kalır ═══
function toastLayer() {
  let el = document.getElementById('sb-toasts');
  if (!el) { el = document.createElement('div'); el.id = 'sb-toasts'; document.body.appendChild(el); }
  return el;
}
function showToast({ icon = '🏅', title = '', sub = '', kind = 'ach', dur = 5200 }) {
  const el = toastLayer();
  const t = document.createElement('div');
  t.className = `sb-toast sb-toast--${kind}`;
  t.innerHTML = `<span class="sb-toast-ic">${escH(icon)}</span>
    <span class="sb-toast-txt"><b>${escH(title)}</b>${sub ? `<i>${escH(sub)}</i>` : ''}</span>`;
  el.appendChild(t);
  requestAnimationFrame(() => t.classList.add('gir'));
  setTimeout(() => { t.classList.remove('gir'); t.classList.add('cik'); setTimeout(() => t.remove(), 400); }, dur);
}
// Açılan başarımları render'dan bağımsız yakala (kaynağı ne olursa olsun tek yerden tören).
function flushToasts() {
  if (!G) return;
  G._achSeen = G._achSeen || {};
  const keys = Object.keys(G.achUnlocked || {});
  if (!G._achSeenInit) { for (const k of keys) G._achSeen[k] = 1; G._achSeenInit = true; return; } // ilk/yükleme: sessiz tohum
  const defs = (G.data.achievements && (G.data.achievements.achievements || G.data.achievements)) || [];
  let gecik = 0;
  for (const k of keys) {
    if (G._achSeen[k]) continue;
    G._achSeen[k] = 1;
    const d = defs.find((x) => x.id === k) || { name: k, category: '' };
    const hc = (G.achUnlocked[k] || {}).hardcore;
    setTimeout(() => {
      showToast({ icon: hc ? '🔥' : '🏅', title: `BAŞARIM: ${d.name}`, sub: `${d.category} rozeti açıldı${hc ? ' · Hardcore' : ''}`, kind: 'ach' });
      try { FX.basari(); } catch {}
      konfetiAt();
    }, gecik);
    gecik += 900; // birden fazla açıldıysa sırayla kutlanır
  }
  G.achToast = null;
  // GALİBİYET SERİSİ — momentum kutlaması ("durma şimdi" itkisi). Milestone: 3,4,5,...
  const rec = G.recent || [];
  let streak = 0;
  for (let i = rec.length - 1; i >= 0; i--) { if (rec[i] === 3) streak++; else break; }
  if (G._lastStreakToast == null) { G._lastStreakToast = streak; return; } // ilk/yükleme: sessiz
  if (streak >= 3 && streak > G._lastStreakToast) {
    const mesaj = streak >= 6 ? 'DURDURULAMAZ!' : streak >= 4 ? 'Alev aldık!' : 'Seri başladı!';
    setTimeout(() => { showToast({ icon: '🔥', title: `${streak} MAÇ GALİBİYET SERİSİ`, sub: mesaj, kind: 'ach' }); try { FX.basari(); } catch {} }, gecik);
  }
  G._lastStreakToast = streak;
}

// Y2: Telefon modalı — arayan kimliği renkli çerçeveyle EKRANI KESER
const CALLER_COLOR = { gm: 'var(--info)', gazeteci: 'var(--warn)', kurul: 'var(--club)', menajer: 'var(--neg)', kaptan: 'var(--pos)' };
const CALLER_TR = { gm: 'GENEL MENAJER', gazeteci: 'GAZETECİ', kurul: 'KURUL', menajer: 'MENAJER', kaptan: 'KAPTAN' };
function phoneModal(G) {
  const ph = G.phone;
  const color = CALLER_COLOR[ph.caller] || 'var(--club)';
  const opts = (ph.options || []).map((o, i) => `<span style="display:inline-flex;flex-direction:column;gap:2px;margin-right:6px">
      <button class="btn" data-act="phoneOpt" data-arg="${i}" style="border-color:${color}">${escH(o.label)}</button>
      ${o.whisper ? `<span class="muted" style="font-size:11px;padding-left:2px">${escH(o.whisper)}</span>` : ''}
    </span>`).join('');
  return `<div class="scene" style="max-width:520px">
    <div class="card card--phone phone-ring" style="border:2px solid ${color};text-align:left">
      <div class="overline" style="color:${color}">📞 ARIYOR · ${CALLER_TR[ph.caller] || 'ARAYAN'} — ${escH(ph.callerName || '')}</div>
      <h2 style="margin:10px 0 6px">${escH(ph.title)}</h2>
      <div class="muted">${escH(ph.body)}</div>
      ${ph.deferred ? '<div class="muted" style="font-size:11px;margin-top:6px;color:var(--warn)">İkinci arayış — daha fazla bekletme.</div>' : ''}
      <div class="btnrow" style="margin-top:14px">${opts}</div>
      <div class="btnrow" style="margin-top:8px"><button class="btn" data-act="phoneDefer" style="opacity:.6">⏳ Ertele (arayan hatırlar: ilişki −, fırsat pahalanır)</button></div>
      <div class="muted" style="font-size:11px;margin-top:8px">Bu tur cevaplanmalı — dünya beklemiyor.</div>
    </div>
  </div>`;
}

// M6: Yeni dönem ritüeli — geçen dönemin defter kartları + tek cümle vizyon
function ritualScene(G) {
  const cards = (G.ritual.cards || []).map((a) => `<div class="msg" style="text-align:left">
    <div class="t">${a.etki > 0 ? '✦' : '✧'} ${escH(a.t)}</div><div class="b">${escH(a.b)}</div>
  </div>`).join('') || '<div class="muted">Geçen dönemin defteri sade kaldı.</div>';
  const v = (key, ikon, label, sub) => `<span style="display:inline-flex;flex-direction:column;gap:2px;margin:0 6px">
    <button class="btn" data-act="vision" data-arg="${key}">${ikon} ${label}</button>
    <span class="muted" style="font-size:11px">${sub}</span></span>`;
  return `<div class="scene" style="max-width:620px">
    <div class="overline">${escH(G.ritual.title)} · kurul huzurunda</div>
    <h2 style="margin:8px 0;font-family:var(--serif)">Rozet Tazelendi</h2>
    <div class="overline" style="margin-top:10px">Geçen dönemin defterinden</div>
    <div class="inbox-list" style="margin:8px 0">${cards}</div>
    <div class="overline" style="margin-top:12px">Tek cümle vizyon — kurul not alacak</div>
    <div class="btnrow" style="justify-content:center;margin-top:8px">
      ${v('sportif', '⚽', 'Sportif zafer', 'Eski Futbolcu coşar · Hesap Adamı kaşını kaldırır')}
      ${v('mali', '🏦', 'Mali disiplin', 'Hesap Adamı + Sponsor Kralı yanında')}
      ${v('altyapi', '🌱', 'Altyapı devrimi', 'Nostaljik duygulanır')}
    </div>
  </div>`;
}

// B6a: ONBOARDING — her yeni ekranın ilk açılışında TEK cümle ipucu balonu (bir daha çıkmaz)
// Y8: DEVAM fısıltısı — sonraki durağın habercisi
function nextHint(G) {
  const wk = G.meta.week;
  if (wk > G.SEASON_WEEKS) return '► Sezon kapanışı';
  const round = G.league.fixtures[wk - 1] || [];
  const my = round.find((x) => x.home === 'ME' || x.away === 'ME');
  const oppId = my ? (my.home === 'ME' ? my.away : my.home) : null;
  // RETENTION: kriz varsa her şeyin önünde uyar — "topla" itkisi zamanla yarışır
  let nudge = null;
  try { nudge = topNudge(G); } catch {}
  if (nudge && nudge.kind === 'kriz') return `${nudge.icon} ${nudge.text}`;
  // Zaman-hassas takvim olayları (kaçırılırsa fırsat gider)
  if (oppId === 'o0') return '► Derbi haftası';
  if ([1, 17].some((s) => wk === s + 3)) return '► Pencere kapanıyor (deadline!)';
  if (G.transferWindow) return '► Pencere açık';
  if ([7, 13, 27].includes(wk)) return '► Milli ara';
  if ([6, 11, 15, 22, 26, 31].includes(wk) && G.cup && G.cup.alive) return '► Kupa turu';
  if ([12, 30].includes(wk)) return '► Kurul sunumu haftası';
  if (wk >= 31) return '► Sezon finali yaklaşıyor';
  // Takvim boşsa: oyuncuyu ileri çeken hedef (rozet/spor/vaat) — "bir hafta daha" kancası
  if (nudge) return `${nudge.icon} ${nudge.text}`;
  return null;
}

function gameOver(G) {
  return `<div class="scene"><div class="overline">Kariyer</div>
    <div class="vote result-lost">Görev Sona Erdi</div>
    <p class="muted">${G.meta.term}. dönemde koltuğu kaybettin. ${G.club.name} başka bir başkana emanet.</p></div>`;
}

// ── Aksiyon yönlendirici (tek giriş) ──
function dispatch(act, arg) {
  switch (act) {
    case 'selectClub': { // B4b/B4c → önce SETUP ekranı (başkan adı/kulüp adı/renk/şehir/zorluk), mühür sonra
      G._setup = { tier: arg, identity: (G._identities || {})[arg] || null, mode: G._modeSel || 'klasik', zorluk: G.difficulty || 'normal' };
      G.phase = 'SETUP';
      break;
    }
    case 'setupRenk': readSetupInputs(); G._setup.renk = arg; break;
    case 'setupZorluk': readSetupInputs(); G._setup.zorluk = arg; break;
    case 'setupGeri': G.phase = 'CLUB_SELECT'; break;
    case 'setupStart': { // kuruluş imzası: girilenleri uygula, kariyer başlasın
      readSetupInputs();
      A.applySetup(G, { ...(G._setup || {}) });
      break;
    }
    case 'setMode': G._modeSel = arg; break;                                                 // B4c mod seçimi
    case 'selTab': G._selTab = arg; break;
    case 'reroll': {                                                                          // B4b + AÇILIŞ 1g: SINIRSIZ çevirme
      G._identities = {};
      for (const t of ['kucuk', 'orta', 'buyuk']) G._identities[t] = A.rollIdentity(G, t);
      // 2. lig kartı da kimlik alsın — ama diğer üç kartla AYNI isme düşmesin
      const kullanilan = new Set(['kucuk', 'orta', 'buyuk'].map((t) => G._identities[t] && G._identities[t].name));
      let l2, deneme = 0;
      do { l2 = A.rollIdentity(G, 'kucuk'); deneme++; } while (l2 && kullanilan.has(l2.name) && deneme < 8);
      G._identities.lig2 = l2;
      break;
    }
    case 'selectScenario': { G.mode = G._modeSel || 'klasik'; A.startScenario(G, arg); break; } // B4a
    case 'togglePromise': toggleSel(arg); break;
    case 'nav': G.nav = arg; break;
    case 'setTicket': A.setTicketPrice(G, parseFloat(arg)); break;
    case 'ticket': { const [id, price] = arg.split('|'); A.resolveTicket(G, id, parseFloat(price)); break; }
    case 'payDebt': A.payDebtAmount(G, arg === 'all' ? G.economy.kasa : parseFloat(arg)); break;
    case 'restructure': A.restructureDebt(G); break;
    case 'takeLoan': A.takeLoan(G, parseFloat(arg)); break;
    case 'bankLoan': { const [id, c] = arg.split('|'); A.resolveBankLoan(G, id, c); break; }
    case 'signSponsor': { const [slot, bid] = arg.split('|'); A.signSponsor(G, slot, bid); break; }
    case 'cancelSponsor': A.cancelSponsor(G, arg); break;
    case 'rejectSponsor': { const [slot, oid] = arg.split('|'); A.rejectSponsorOffer(G, slot, oid); break; } // teklife kapıyı göster
    case 'achModal': G._achModal = !G._achModal; break;                                        // başarım duvarı modalı
    case 'sndTest': FX.devam(); break;                                                         // ayarlar: örnek efekt
    case 'uiKontrast': G.uiKontrast = !G.uiKontrast; break;                                    // ayarlar: yüksek kontrast
    case 'fullscreen': { const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); break; }
    case 'pcard': G._pcard = arg; break;                                                       // oyuncu kartını aç
    case 'pcardClose': G._pcard = null; break;
    case 'kiralikListe': A.toggleKiralikListe(G, arg); break;                                  // kiralık listesine koy/çek
    case 'noop': break;                                                                        // kart içi boş tık (kapatmasın)
    case 'midPromise': A.makeMidPromise(G, arg); break;                                        // oyun-içi yeni söz
    case 'trFiltre': G._trFiltre = arg; G._trSayfa = 0; break;                                 // piyasa filtresi (bütçe/mevki/hepsi)
    case 'trSayfa': G._trSayfa = Math.max(0, (G._trSayfa || 0) + Number(arg)); break;          // 80+ havuzda sayfalama
    case 'trTab': G._trTab = arg; break;                                                       // PİYASA/SATIŞ/TEKLİFLER sekmeleri
    case 'kurulButce': A.kurulButceArtisi(G); break;                                           // dönemde 1 kez tavan artışı iste
    case 'sosyalProje': A.sosyalProje(G); break;                                               // P10: kulüp mahalleye iner
    case 'kadinTakim': A.kadinTakimiKur(G); break;                                             // P11: kadın futbol şubesi
    case 'yurtOfis': A.yurtdisiOfisAc(G); break;                                               // P20: uluslararası ofis
    case 'gmItiraz': A.gmBudgetItiraz(G, arg); break;                                          // bütçe dışı isim → GM görüşü
    case 'sorgula': A.sorgulaPlayer(G, arg); break;                                            // teklif öncesi şart öğren
    case 'reqOffer': A.requestOffer(G, arg); break;                                            // GM'e dosya iste
    case 'tfile': { const [id, c] = arg.split('|'); A.resolveTransferFile(G, id, c); break; } // §1 onay dosyası
    case 'sfile': { const [id, c] = arg.split('|'); A.resolveSaleFile(G, id, c); break; }     // §1 satış aynası
    case 'cfile': { const [id, i] = arg.split('|'); A.hireCoachFile(G, id, i); break; }       // §2 TD imza
    case 'fireCoach': A.fireCoach(G); break;                                                   // §2 kovma
    case 'dirBudget': G._dir = { ...(G._dir || { line: 'hazir' }), budgetKey: arg }; break;    // §1 direktif
    case 'dirLine': G._dir = { ...(G._dir || { budgetKey: 'orta' }), line: arg }; break;
    case 'dirPress': G._dir = { ...(G._dir || { budgetKey: 'orta', line: 'hazir' }), press: arg }; break; // 3. karar: basın hattı
    case 'muhurBas': { // BELGE MÜHÜRLE: damga otursun ('tak'), sonra dönem başlasın
      const belge = app.querySelector('.tutanak-belge-tam');
      if (belge && !belge.querySelector('.belge-damga')) {
        belge.insertAdjacentHTML('beforeend', '<span class="belge-damga">MÜHÜR</span>');
        try { FX.muhur(); } catch {}
        setTimeout(() => { onDevam(); autoSave(); }, 520);
      } else { onDevam(); autoSave(); }
      return;
    }
    case 'setupBack': G._setupStep = 1; break;                                                 // v4.3-4: adım 2→1
    case 'setupToClub': G.phase = 'CLUB_SELECT'; G._sel = []; G._dir = null; G._setupStep = 1; break; // adım 1 → kulüp seçimi
    case 'upgrade': A.upgradeFacility(G, arg); break;
    case 'demec': { const r = A.makeDemec(G, arg); if (r && r.ok) { try { ugultu(0.14); } catch {} } break; } // cevap → salon mırıltısı
    // NOT: 'hireCoach' (hireCoachAction/coachCandidates) ve 'toggleReport' (showReport) eski
    // ölü yollardı — hiçbir buton emit etmiyordu (TD'ler cfile/inbox ile alınır, rapor hep açık).
    case 'ligDetay': G.ligDetay = !G.ligDetay; break;                                        // detaylı puan tablosu (modal)
    case 'telkin': A.setTelkin(G, arg === 'off' ? null : arg); break;
    case 'prim': A.setMatchPrim(G, arg); break;
    case 'ozelPrim': A.armOzelPrim(G); break;
    case 'seriPrim': A.toggleSeriPrim(G); break;
    case 'sezonPrim': A.declareSeasonPrim(G); break;
    case 'tender': A.chooseTender(G, arg); break;
    case 'tenderCancel': A.cancelTender(G); break;
    case 'event': { const [id, i] = arg.split('|'); A.resolveEvent(G, id, i); break; }      // D3 olay kartı
    case 'captain': { const [id, c] = arg.split('|'); A.resolveCaptain(G, id, c); break; }  // K2 kaptan onay/veto
    case 'adayOl': A.startComeback(G); break;                                               // M1 dönüş kampanyası
    case 'vision': A.chooseVision(G, arg); break;                                           // M6 dönem vizyonu
    case 'retire': { if (G.retireArm) A.retire(G); else { G.retireArm = true; } break; }    // M4 emeklilik (iki tık)
    case 'staffFile': A.requestStaffFile(G, arg); break;                                      // A1 aday iste
    case 'stfile': { const [id, i] = arg.split('|'); A.hireStaffFile(G, id, i); break; }      // A1 imza
    case 'lfile': { const [id, c] = arg.split('|'); A.resolveLoanFile(G, id, c); break; }     // A3 kiralık gönder
    case 'douse': A.dousePress(G, arg); break;                                                // A1 manşet söndür
    case 'ffpLobi': A.ffpLobi(G); break;                                                      // A2 lobi
    case 'htMove': { A.htDecision(G, arg); const r = A.finishWeek(G); if (!(r && r.waitLate)) FX.devam(); render(); return; } // Y3 devre arası
    case 'lateMove': { A.lateDecision(G, arg); render(); return; }                            // Y3 son 10 dk
    case 'phoneOpt': { A.answerPhone(G, arg); FX.devam(); render(); return; }                 // Y2 telefon
    case 'phoneDefer': { A.deferPhone(G); render(); return; }
    case 'desk': { A.deskAction(G); FX.tik(); break; }                                        // Y6 masa dokunuşu
    case 'sndToggle': { setEnabled(!getSound().enabled); break; }                             // Y7 ses
    case 'sndVol': setVolume(parseFloat(arg)); break;                                        // B6b
    case 'ambVol': setAmbience(parseFloat(arg)); break;                                       // ÇELİK 5d ambiyans kanalı
    case 'ayarlar': G.nav = 'ayarlar'; break;                                                // B6b
    case 'board': { const [id, k] = arg.split('|'); A.resolveBoard(G, id, k); break; }      // D2 kurul sunumu
    case 'agenda': { const [id, t] = arg.split('|'); A.resolveAgenda(G, id, t); break; }    // B1a gündem cevabı
    case 'protokol': A.protokolTon(G, arg); break;                                          // B1b derbi el sıkışma
    case 'tisBulusma': A.tisBulusma(G, arg); break;                                         // B2b taraftar buluşması
    case 'ilan': { const [p, y, t] = arg.split('|'); A.ilanVer(G, { pos: p, yasMax: +y, tavan: +t }); break; } // B3a
    case 'vitrin': A.vitrinToggle(G, arg); break;                                           // B3b satış vitrini
    case 'campaign': A.campaignDo(G, arg); break;                                            // D6 KP aksiyonu
    case 'debate': A.answerDebate(G, arg); break;                                            // D6 münazara cevabı
    case 'debateSkip': A.skipDebate(G); break;
    case 'save': doSave(); return;
    case 'load': doLoad(); return;
    case 'devam': onDevam(); autoSave(); return;                                              // her ilerleyişte otokayıt
    case 'contSave': autoContinue(); return;                                                  // açılış: kayıtlı kariyere devam
    case 'contSil': { try { localStorage.removeItem(AUTO_KEY); } catch {} G._devamVar = null; break; }
    default: return;
  }
  render();
}

function toggleSel(id) {
  G._sel = G._sel || [];
  const i = G._sel.indexOf(id);
  if (i >= 0) G._sel.splice(i, 1);
  else if (G._sel.length < TUNING.MAX_PROMISES) G._sel.push(id);
}

// ── DEVAM: fazın ileri eylemi ──
function onDevam() {
  if (G.transition) { G.transition = null; FX.devam(); render(); return; } // K6: atmosfer kartı kapanır
  switch (G.phase) {
    case 'TERM_SETUP': {
      if ((G._setupStep || 1) === 1) { G._setupStep = 2; render(); break; } // 1/2 → 2/2
      const d = G._dir || { budgetKey: 'orta', line: 'hazir' }; // 'tak' sesi muhurBas'ta çaldı
      const budget = Math.round(G.economy.kasa * (TUNING.APPROVAL.BUDGET_PRESET[d.budgetKey] ?? 0.5));
      A.startTerm(G, G._sel || [], { budget, line: d.line, budgetKey: d.budgetKey, press: d.press });
      G._sel = []; G._dir = null; G._setupStep = 1; render(); break;
    }
    case 'SEASON_LOOP':
      if (G.phone) break; // telefon açıkken DEVAM çalışmaz — cevap şart
      if (G.pendingMatch) {
        // Y3: pre → HT (karar) → [late karar] → live → post → kapan
        if (G.pendingMatch.phase === 'pre') { G.pendingMatch.phase = 'ht'; FX.devam(); render(); break; }
        if (G.pendingMatch.phase === 'ht' || G.pendingMatch.phase === 'late') break; // seçim butonları sahnede
        if (G.pendingMatch.phase === 'live') {
          G.pendingMatch.phase = 'post';
          if (G.pendingMatch.myRes === 'W') { FX.gol(); konfetiAt(); } // ekran sarsıntısı kaldırıldı (kullanıcı isteği)
          else if (G.pendingMatch.myRes === 'L') FX.yenilgi();
          render(); break;
        }
        G.pendingMatch = null;
        if (G.meta.week > G.SEASON_WEEKS) { A.endSeason(G); }
        render();
      } else if ((G.hazirlik || 0) > 0) { A.preSeasonWeek(G); FX.devam(); render(); } // sezon başı hazırlık dönemi
      else { A.beginWeek(G); FX.devam(); render(); }
      break;
    case 'SEASON_END':
      A.afterSeasonEnd(G); render(); break;
    case 'CAMPAIGN':
      A.advanceCampaign(G); render(); break;
    case 'ELECTION_NIGHT': {
      const e = G.election;
      if ((e.revealStep ?? 0) <= 5 && !e.counting && !e.done) { e.revealStep = (e.revealStep ?? 0) + 1; render(); break; } // karne kartları tek tek + rakip
      if (e.counting) { finalizeVoteCount(); break; } // "Seçimi Sonlandır" → animasyonu atla, sonucu hemen göster
      if (!e.counting && !e.done) runVoteCount();
      else if (e.done) {
        if (e.kazandi) { if (e.comeback) A.applyComebackWin(G); A.startNewTerm(G); } // M1: dönüş zaferi → enkaz + yeni dönem
        else A.afterElectionLoss(G); // M1: kayıp artık kariyer sonu DEĞİL — muhalefet (2. kayıpsa kapanış)
        render();
      }
      break;
    }
    case 'OPPOSITION': { // M1: bir muhalefet sezonu izle
      A.oppositionNext(G); FX.devam(); render(); break;
    }
    case 'CAREER_END':
    case 'GAME_OVER':
      { const data = G.data; G = A.newGame(data, 'normal'); globalThis.SB.G = G; render(); }
      break;
  }
}

// D7: Oy sayımı — %35-65 bandında YAVAŞLAR, ±4 sahte salınım (dramatik belirsizlik, v3-I).
function runVoteCount() {
  const e = G.election;
  e.counting = true; e.displayVote = 0;
  document.body.classList.add('ugultu'); setTimeout(() => document.body.classList.remove('ugultu'), 1000); // T2-2g kongre uğultusu
  const target = e.oyOrani * 100;
  let t = 0;
  render();
  const step = () => {
    if (!e.counting) return; // "Seçimi Sonlandır" ile dışarıdan bitirildiyse döngü sönsün
    t++;
    const inTension = e.displayVote > 35 && e.displayVote < 65;
    const speed = inTension ? 0.05 : 0.14;                       // gerilim bandında yavaşla
    const wobble = inTension ? Math.sin(t / 2.5) * 4 * Math.max(0, 1 - t / 60) : 0; // ±4 sahte salınım (sönümlü)
    e.displayVote += Math.max(inTension ? 0.25 : 0.7, (target - e.displayVote) * speed);
    e.displayVoteShown = e.displayVote + wobble;
    if (e.displayVote >= target - 0.3 && t > 25) {
      e.displayVote = target; e.displayVoteShown = target; e.counting = false; e.done = true;
      render();
      const fl = e.kazandi ? 'flash-club' : 'flash-soguk'; // T2-2g: sonuç flaşı
      document.body.classList.add(fl); setTimeout(() => document.body.classList.remove(fl), 350);
      if (e.kazandi) konfetiAt(); // GÖRSEL 5f: club rengi konfeti (hafif, 2sn)
      return;
    }
    render();
    setTimeout(step, inTension ? 90 : 45);
  };
  setTimeout(step, 300);
}

// "Seçimi Sonlandır" — sayım animasyonunu atla, sonucu anında göster (sonra DEVAM ile devam edilir)
function finalizeVoteCount() {
  const e = G.election;
  const target = e.oyOrani * 100;
  e.displayVote = target; e.displayVoteShown = target; e.counting = false; e.done = true;
  render();
  const fl = e.kazandi ? 'flash-club' : 'flash-soguk';
  document.body.classList.add(fl); setTimeout(() => document.body.classList.remove(fl), 350);
  if (e.kazandi) konfetiAt();
}

// AÇILIŞ ZAFERİ: OY OY sayım — 550 delegelik kongre; iki aday 0'dan başlar, oylar
// tek tek/öbek öbek düşer. Başta baş a baş gider, öne geçen birkaç kez değişir; sona
// doğru sayım yavaşlar ve SEN ayrışıp kazanırsın. Bitişte KAZANDIN + konfeti + zafer.
// DEVAM ile atlanırsa (eleman kaybolur) sayaç kendini söndürür.
const KONGRE_UYE = 550;
function zaferSayimi(z, azalt) {
  const q = (s) => document.querySelector(s);
  const TOPLAM = z.toplam || KONGRE_UYE;
  const senF = z.senOy ?? Math.round(TOPLAM * z.sen / 100), rakF = TOPLAM - senF;
  const benAd = z.baskanAd || 'SEN';
  const bitir = () => {
    if (!q('.secim-zafer')) return; // ekran atlandı
    q('.secim-zafer').classList.add('bitti'); // huzme dur, kazanan bar nabız atar
    q('.zg-ust').textContent = 'Kongre Seçimi · Sandık Kapandı';
    q('.secim-zafer .sen').style.width = (senF / TOPLAM * 100) + '%';
    q('.secim-zafer .rakip').style.width = (rakF / TOPLAM * 100) + '%';
    q('.zg-lbl-sen').textContent = `${benAd} · ${senF} oy`;
    q('.zg-lbl-rakip').textContent = `${z.rakipAd} · ${rakF} oy`;
    q('.zg-kazandin').classList.add('goster');
    q('.zg-sonuc').classList.add('goster');
    konfetiAt(); FX.zafer();
  };
  if (azalt || !q('.secim-zafer')) { bitir(); return; }
  // Fark SENARYOLU: ilk sandıklar rakibe gider (önde o), ~%42'de SEN geçersin,
  // küçük dalgalanmayla ayrışıp kazanırsın. Sayaçlar asla geri düşmez, final TAM tutar.
  const D = senF - rakF;
  const farkOf = (p) => Math.round(D * (
    Math.pow(p, 2.4)                                                       // sona doğru açılan gerçek fark
    - 0.35 * Math.sin(Math.min(p, .6) / .6 * Math.PI) * Math.pow(1 - p, 1.5) // erken dönem: rakip önde
    + 0.06 * Math.sin(p * 22) * (1 - p)                                    // salinim: geçiş anı gerilir
  ));
  const sure = 10000, t0 = performance.now();
  let senCur = 0, rakCur = 0, sonTik = 0;
  const iv = setInterval(() => {
    const sen = q('.secim-zafer .sen');
    if (!sen) { clearInterval(iv); return; }
    const p = Math.min(1, (performance.now() - t0) / sure);
    const toplam = Math.round(TOPLAM * (1 - Math.pow(1 - p, 1.35))); // sayım sona doğru yavaşlar
    let ns = Math.round((toplam + farkOf(p)) / 2);
    ns = Math.max(senCur, Math.min(ns, senF));            // monoton + final kelepçesi
    let nr = Math.max(rakCur, Math.min(toplam - ns, rakF));
    if (p >= 1) { ns = senF; nr = rakF; }
    senCur = ns; rakCur = nr;
    sen.style.width = (senCur / TOPLAM * 100) + '%';
    q('.secim-zafer .rakip').style.width = (rakCur / TOPLAM * 100) + '%';
    q('.zg-lbl-sen').textContent = `${benAd} · ${senCur}`;
    q('.zg-lbl-rakip').textContent = `${z.rakipAd} · ${rakCur}`;
    if (performance.now() - sonTik > 1100) { sonTik = performance.now(); FX.sayim(); } // sandık tıkırtısı
    if (p >= 1) { clearInterval(iv); bitir(); }
  }, 120);
}

// GÖRSEL 5f: hafif konfeti — 14 parça, 2sn, kendini temizler (reduced-motion'da CSS kapatır)
function konfetiAt() {
  for (let i = 0; i < 14; i++) {
    const k = document.createElement('div');
    k.className = 'konfeti';
    k.style.left = (8 + Math.random() * 84) + 'vw';
    k.style.animationDelay = (Math.random() * .5) + 's';
    k.style.background = i % 3 === 0 ? 'var(--club-2)' : i % 3 === 1 ? 'var(--club)' : 'var(--ink-1)';
    document.body.appendChild(k);
    setTimeout(() => k.remove(), 2600);
  }
}

// ── OTOKAYIT (localStorage): her hafta ilerleyişinde sessizce yazılır; açılışta "Devam Et" sunar ──
const AUTO_KEY = 'sayin-baskan-auto';
function autoSave() {
  try {
    if (!G || !G.club || !G.club.name || G.phase === 'CLUB_SELECT' || G.phase === 'SETUP') return;
    localStorage.setItem(AUTO_KEY, serialize({ ...G, data: undefined }));
  } catch { /* kota/gizli mod — otokayıt sessizce atlanır */ }
}
function autoLoadCheck() {
  try {
    const raw = localStorage.getItem(AUTO_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (p && p.meta && p.club) G._devamVar = { season: p.meta.season, week: p.meta.week, club: p.club.name };
  } catch { /* bozuk kayıt — banner gösterme */ }
}
function autoContinue() {
  try {
    const parsed = deserialize(localStorage.getItem(AUTO_KEY));
    if (!parsed) return;
    const data = G.data;
    G = A.migrateLoaded(Object.assign(parsed, { data }));
    globalThis.SB.G = G;
    render();
  } catch { /* yüklenemedi — mevcut akış sürer */ }
}
window.addEventListener('beforeunload', autoSave); // pencere kapanırken son durum yazılır

// ── Kayıt/Yükleme (JSON dosya — dışa/içe aktarma) ──
function doSave() {
  const snap = { ...G, data: undefined };
  const blob = new Blob([serialize(snap)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sayin-baskan-s${G.meta.season}-h${G.meta.week}.json`;
  a.click(); URL.revokeObjectURL(a.href);
}
function doLoad() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/json';
  inp.onchange = () => {
    const file = inp.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      const parsed = deserialize(rd.result);
      if (!parsed) return;
      const data = G.data;
      G = A.migrateLoaded(Object.assign(parsed, { data })); // B6h: eski kayıt güvenli göç
      globalThis.SB.G = G;
      render();
    };
    rd.readAsText(file);
  };
  inp.click();
}

// ── Olay delegasyonu + eventBus dinleme ──
app.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  dispatch(el.dataset.act, el.dataset.arg);
  // Odak butonda KALMASIN — yoksa Enter/Space son butonu (özellikle DEVAM'ı) tekrar tetikler
  // ve "tuşa basınca ekran yenileniyor" hissi doğar.
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
});
// Esc: açık overlay'i kapat — oyuncu kartı / başarım duvarı (başka tuşlar oyunu İLERLETMEZ)
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !G) return;
  if (G._pcard) { G._pcard = null; render(); }
  else if (G._achModal) { G._achModal = false; render(); }
});
eventBus.on('TICK_END', () => {}); // ui eventBus dinler (ileride canlı widget'lar buraya bağlanacak)

// AÇILIŞ 1f: kart hover'ında görsel renk parıltısı CSS ile kalır; uğultu sesi kaldırıldı (kullanıcı isteği)
globalThis.SBhover = () => {};

window.addEventListener('resize', () => fitVaat()); // pencere boyu değişse de vaat sahnesi sığar

boot();
