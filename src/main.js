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
import * as mainMenu from './ui/mainMenu.js';
import * as squadView from './ui/squadView.js';
import * as transferView from './ui/transferView.js';
import * as facilitiesView from './ui/facilitiesView.js';
import * as media from './ui/media.js';
import * as congress from './ui/congress.js';
import * as dataHub from './ui/dataHub.js';
import * as clubView from './ui/clubView.js';
import * as ozelHayat from './ui/ozelHayat.js';
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

// ── Global tooltip: data-tip'i SABİT konumlu tek kutuda gösterir → overflow:hidden panelleri AŞAR,
//    viewport dışına taşmaz (yukarıda yer yoksa aşağı açılır). CSS ::after tooltip'in yerini alır. ──
const _tip = document.createElement('div');
_tip.className = 'sb-tip';
_tip.setAttribute('role', 'tooltip');
document.body.appendChild(_tip);
function _showTip(t) {
  const txt = t && t.getAttribute('data-tip');
  if (!txt) { _tip.style.display = 'none'; return; }
  _tip.textContent = txt;
  _tip.style.display = 'block';
  const r = t.getBoundingClientRect();
  const tw = _tip.offsetWidth, th = _tip.offsetHeight, M = 8;
  let left = Math.max(M, Math.min(r.left + r.width / 2 - tw / 2, window.innerWidth - tw - M));
  let top = r.top - th - 8;
  if (top < M) top = r.bottom + 8; // yukarıda yer yoksa aşağı aç
  _tip.style.left = Math.round(left) + 'px';
  _tip.style.top = Math.round(top) + 'px';
}
document.addEventListener('mouseover', (ev) => { const t = ev.target.closest && ev.target.closest('[data-tip]'); _showTip(t); });
document.addEventListener('mouseout', (ev) => { const t = ev.target.closest && ev.target.closest('[data-tip]'); if (t) _tip.style.display = 'none'; });
window.addEventListener('scroll', () => { _tip.style.display = 'none'; }, true);

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
    G.phase = 'MAIN_MENU'; // sinematik ana menü ilk ekran (Yeni Oyun → kulüp seçimi)
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
      const zTop = (z && z.toplam) || KONGRE_UYE;      // toplam delege
      const zEsik = Math.floor(zTop / 2) + 1;           // kazanma çizgisi (%50+1 oy)
      const zaferBlok = z ? `<div class="secim-zafer">
          <div class="overline zg-ust" style="color:var(--pos)">Kongre Seçimi · Oylar Sayılıyor…</div>
          <div class="zg-salon">Kongre salonu · ${zTop} delege · sandıklar açılıyor</div>
          <div class="zg-panel">
            <div class="zg-stat"><div class="zg-stat-k">Sayılan Sandık</div><div class="zg-stat-v tnum zg-sayilan">%0</div></div>
            <div class="zg-stat"><div class="zg-stat-k">Kullanılan Oy</div><div class="zg-stat-v tnum zg-katilan">0</div></div>
            <div class="zg-stat vurgu"><div class="zg-stat-k">Kazanma Çizgisi</div><div class="zg-stat-v tnum">${zEsik}</div></div>
          </div>
          <div class="zafer-baslik led zg-kazandin">KAZANDIN</div>
          <div class="zg-onde"><span class="muted">Şu an önde:</span> <b class="zg-onde-ad">—</b></div>
          <div class="aday-bar zg-bars" style="margin-top:8px">
            <div class="satir">
              <div class="zg-satir-ust"><span class="zg-ad">${escH(z.baskanAd || 'SEN')}</span><span class="zg-lbl-sen">0 oy</span></div>
              <div class="track"><div class="sen" style="width:0%"></div><div class="esik-cizgi" style="left:50%"></div></div>
            </div>
            <div class="satir">
              <div class="zg-satir-ust"><span class="zg-ad muted">${escH(z.rakipAd)}</span><span class="zg-lbl-rakip muted">0 oy</span></div>
              <div class="track"><div class="rakip" style="width:0%"></div><div class="esik-cizgi" style="left:50%"></div></div>
            </div>
            <div class="micro zg-esik-not">kesikli çizgi · kazanma çizgisi ${zEsik} oy</div>
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
    } else if (t.tip === 'kupa') {
      // #1 ŞAMPİYONLUK GECESİ — altın kupa sinematiği: kupa iner, ışık patlar, kariyer yıldızları dizilir
      const yildizlar = Array.from({ length: Math.min(5, t.kupaNo || 1) }, () => '<span class="kupa-yildiz-tek">★</span>').join('');
      icerik = `<div class="scene kupa-sahne" style="max-width:600px">
        <div class="overline kupa-ust">Lig Şampiyonluğu · ${t.sezon || G.worldSeason}. Sezon</div>
        <div class="kupa-svg">${kupaSvg()}</div>
        <div class="kupa-yildizlar" data-tip="Kariyer şampiyonlukların">${yildizlar}</div>
        <div class="zafer-baslik led kupa-baslik">ŞAMPİYON</div>
        <div class="kupa-kulup">${escH((G.club?.name || '').toLocaleUpperCase('tr'))}</div>
        <div class="muted kupa-soz" style="font-style:italic">${escH(t.sub || '')}</div>
      </div>`;
      if (!t._kutlama) { t._kutlama = true; setTimeout(() => { konfetiAt(); FX.zafer(); }, 400); }
    } else {
      icerik = `<div class="scene" style="max-width:560px">
        <div style="font-size:44px">${t.icon || '⚽'}</div>
        <h2 style="margin:10px 0 6px;font-family:var(--serif);letter-spacing:2px">${escH(t.title)}</h2>
        <div class="muted" style="font-style:italic">${escH(t.sub || '')}</div>
      </div>`;
    }
    // sb- cinematic tam-ekran: oyunun geri kalanıyla AYNI topbar (arma+lig+faz çipi+kasa/borç+başkan)
    // ve alt bar. Seçim gecesi/tören artık kokpit-medya-veri ile aynı formatta.
    const chip = t.tip === 'muhur' ? 'KONGRE SEÇİMİ · SANDIK' : t.tip === 'kupa' ? 'ŞAMPİYONLUK GECESİ' : 'SEZON GEÇİŞİ';
    const bbNote = t.tip === 'muhur' ? 'Kongre seçim sonucu · mühür töreni' : t.tip === 'kupa' ? 'Kupa töreni · şehir bayramda' : (t.sub ? escH(t.sub) : 'Devam et');
    html = `<div class="sb-root sb-cinematic secim-toren">
      <div class="sb-atmo"></div><div class="sb-vignette"></div>
      ${cockpit.sbTopbar(G, { phaseChip: chip })}
      <div class="sb-body sb-body-col secim-toren-body">${icerik}</div>
      <footer class="sb-bottombar">
        <div class="sb-bb-l"><span class="sb-bb-k">${t.tip === 'muhur' ? 'KONGRE' : 'GEÇİŞ'}</span><span class="sb-bb-note">${bbNote}</span></div>
        <button class="sb-btn sb-btn-primary" data-act="devam">DEVAM ▸</button>
      </footer>
    </div>`;
    app.innerHTML = html;
    document.body.classList.remove('kriz');
    return;
  }
  switch (G.phase) {
    case 'MAIN_MENU':
      html = mainMenu.render(G); break; // sinematik ana menü — kendi tam-ekran sb- kabuğu
    case 'CLUB_SELECT':
      html = clubSelect.render(G); break; // AÇILIŞ — kendi tam-ekran sb- kabuğu (topbar yok)
    case 'SETUP': // kariyer kuruluşu — kendi tam-ekran sb- kabuğu (topbar yok, kariyer henüz başlamadı)
      html = setupUi.render(G); break;
    case 'TERM_SETUP': {
      // M6: YENİ DÖNEM RİTÜELİ — vaatlerden önce tören: defter kartları + kurul önünde vizyon
      if (G.ritual && !G.ritual.done) { html = shell(G, { content: ritualScene(G), center: true }); break; }
      // v4.3-4: iki adım — 1/2 vaat, 2/2 direktif; buton her adımda sticky (devam-wrap)
      // Her iki adım da (1/2 Sözünü Ver, 2/2 Makam Odası) kendi tam-ekran sb- kabuğunu üretir — shell'siz.
      html = promiseSelect.render(G);
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
        if (G.pendingMatch.phase === 'live' || G.pendingMatch.phase === 'post') {
          // CANLI YAYIN + SONUÇ — kendi tam-ekran kabuğu (shell yok); saat ilk girişte başlar
          if (G.pendingMatch.phase === 'live' && G.pendingMatch._clock === undefined) { G.pendingMatch._clock = 0; G.pendingMatch._playing = false; G.pendingMatch._speed = 1; }
          html = matchday.render(G);
        } else {
          const needsChoice = G.pendingMatch.phase === 'ht' || G.pendingMatch.phase === 'late';
          html = shell(G, { content: matchday.render(G), center: true, devam: needsChoice ? null : { label: 'DEVAM ►', pulse: true } });
        }
      } else {
        const screens = { cockpit, kadro: squadView, transfer: transferView, tesis: facilitiesView, finans: finance, medya: media, kongre: congress, veri: dataHub, kulup: clubView, ozel: ozelHayat, inbox, ayarlar: settings };
        const screen = screens[G.nav] || cockpit;
        if (G.nav === 'ozel' && !G.ozel && G.club) A.initOzel(G); // eski kayıt: özel hayat katmanı tembel kurulur
        // sb- görsel katmana göç etmiş nav ekranları — kendi tam-ekran sbShell kabuğunu üretir
        const SB_NAV = new Set(['cockpit', 'kadro', 'transfer', 'tesis', 'finans', 'medya', 'kongre', 'veri', 'kulup', 'ozel', 'inbox', 'ayarlar']);
        const hazir = (G.hazirlik || 0) > 0;
        if (SB_NAV.has(G.nav)) {
          // sb- göç etmiş nav ekranı — kendi tam-ekran sbShell kabuğunu üretir (shell() ile sarmalanmaz)
          html = screen.render(G);
        } else {
          const devamLbl = hazir ? (G.hazirlik === 1 ? 'Sezonu Başlat ►' : `Hazırlık Haftası ► (lige ${G.hazirlik})`) : 'Sonraki Maç ►';
          html = shell(G, { content: screen.render(G), nav: true, navActive: G.nav, devam: { label: devamLbl, sub: hazir ? 'Transfer dönemi — kadronu kur, maçlar sonra' : nextHint(G), pulse: true } });
        }
      }
      break;
    case 'SEASON_END':
      html = shell(G, { content: seasonEnd.render(G), center: true, devam: { label: 'Yeni Sezona Başla ►', pulse: true } }); break;
    case 'CAMPAIGN':
      html = renderCampaign(G); break;    // sb-cinematic tam-ekran (kendi topbar+bottombar)
    case 'DEBATE':
      html = renderDebate(G); break;      // sb-cinematic; cevap butonları sahnede
    case 'ELECTION_NIGHT': {
      const e = G.election;
      const revealing = (e.revealStep ?? 0) <= 6 && !e.counting && !e.done; // 6 karne kartı (Aile dahil)
      const label = e.done ? (e.kazandi ? 'Yeni Döneme Başla ►' : 'Kariyer Sonu ►')
        : e.counting ? 'Seçimi Sonlandır ►'
          : revealing ? (e.revealStep < 6 ? 'Karneyi Aç ►' : 'Rakibi Dinle ►') : 'Oyları Say ►';
      html = shell(G, { content: electionNight.render(G), center: true, devam: { label, disabled: false, pulse: true } });
      break;
    }
    case 'GAME_OVER':
      html = shell(G, { content: gameOver(G), center: true, devam: { label: 'Yeni Kariyer ►', pulse: true } }); break;
    default:
      html = '<div style="padding:40px" class="muted">Yükleniyor…</div>';
  }
  // OYUNCU KARTI overlay'i — kadrodaki oyuncuya tıklayınca açılır (satılan/giden oyuncuda kendini kapatır)
  if (G._pcard && !playerCard.findAnyPlayer(G, G._pcard)) G._pcard = null; // kadro + teklif + piyasa oyuncusu kartı açık kalsın
  if (G._pcard) html += playerCard.render(G);
  if (G._spCard) html += finance.renderSponsorCard(G); // sponsor detay kartı (modal)
  if (G._achModal) html += clubView.renderAchModal(G); // başarım duvarı (kulüp ekranından "Tümünü Gör")
  app.innerHTML = html;
  document.body.classList.toggle('kontrast', !!G.uiKontrast); // Ayarlar → Yüksek Kontrast
  fitVaat(); // KAYDIRMASIZ GARANTİ: sahne ekrandan uzunsa orantılı küçült — asla taşmaz
  fitSb();   // sb- ekranları (Finans vitrin) için aynı garanti — panel kırpılmaz, ölçeklenir
  typewriterTepki(); // Makam Odası: GM tepkisi harf harf yazılır (toplantı hissi)
  canliSkorSayimi(); // Maç yayını: skor 0-0 başlar, goller ticker'a düştükçe TEK TEK artar
  // GÖRSEL KİMLİK §2: kulüp rengi runtime sızması (kariyer başında bir kez uygular)
  if (G.club && G.club.name) applyClubTheme(G);
  // Y7: kriz kırmızı vinyeti — gece yarısı telefonu ya da kritik gösterge
  const kriz = (G.phone && (G.phone.kind === 'skandal' || G.phone.kind === 'kriz'))
    || (G.gauges && (G.gauges.guven < 25 || G.gauges.mali < 20));
  document.body.classList.toggle('kriz', !!kriz);
  flushToasts(); // RETENTION: yeni açılan başarımlar/olaylar tören toast'ı olarak belirir
  ensureMatchClock(); // CANLI YAYIN: maç saati oynuyorsa dakika dakika ilerlet
}

// Devre arası/son-dakika KARAR ekranlarını atla — maçı nötr çözüp DİREK canlı yayına al.
// (RNG akışı aynı: htDecision('tdguven') + finishWeek + lateDecision('devam') mevcut sırayla çalışır.)
function autoResolveToLive() {
  const pm = G && G.pendingMatch;
  if (!pm || G.phone) return;                 // telefon varsa önce o cevaplanır (pre kalır)
  if (pm.phase === 'pre') { A.htDecision(G, 'tdguven'); const r = A.finishWeek(G); if (r && r.waitLate) A.lateDecision(G, 'devam'); }
  else if (pm.phase === 'ht') { A.htDecision(G, 'tdguven'); const r = A.finishWeek(G); if (r && r.waitLate) A.lateDecision(G, 'devam'); }
  else if (pm.phase === 'late') { A.lateDecision(G, 'devam'); }
}

// ═══ CANLI MAÇ SAATİ — yayın oynatılıyorken dakikaları ilerletir (highlights REVEAL; RNG'ye dokunmaz) ═══
let _matchIv = null;
function ensureMatchClock() {
  const pm = G && G.pendingMatch;
  const canli = pm && pm.phase === 'live' && pm._playing && (pm._clock ?? 0) < 90;
  if (!canli) { if (_matchIv) { clearInterval(_matchIv); _matchIv = null; } return; }
  if (_matchIv) return; // zaten dönüyor
  _matchIv = setInterval(() => {
    const p = G && G.pendingMatch;
    if (!p || p.phase !== 'live' || !p._playing) { clearInterval(_matchIv); _matchIv = null; return; }
    const prev = p._clock ?? 0;
    p._clock = Math.min(90, prev + (p._speed || 1));
    const golAr = (p.highlights || []).some((h) => h.type === 'gol' && h.min > prev && h.min <= p._clock);
    if (p._clock >= 90) { p._clock = 90; p._playing = false; }
    if (golAr) { try { FX.gol(); } catch {} }
    render();
  }, 460);
}

// KAYDIRMASIZ GARANTİ (GLOBAL): HİÇBİR ekranda scroll yok. Sahne içeriği görünür
// alandan uzunsa transform-scale ile orantılı küçültülür — her ekranda, her çözünürlükte
// her şey sığar. (Kullanıcı kuralı: "oyunun hiçbir ekranında scroll istemiyorum.")
function fitVaat() {
  const stage = app.querySelector('.stage');
  if (!stage) return;
  // overflow:hidden çubukları gizler ama ODAK kaydırmasını ENGELLEMEZ — alt kenardaki
  // butona tıklayınca tarayıcı sahneyi kaydırıp sticky panelleri koparıyordu. Sıfırla.
  stage.scrollTop = 0; stage.scrollLeft = 0;
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

// sb- ekranlarında da KAYDIRMASIZ GARANTİ: doğal yükseklikli içerik (ör. Finans .fin-root)
// ayrılan alandan uzunsa fitVaat ile aynı teknikle orantılı küçültülür — kırpılma/taşma yok.
function fitSb() {
  const el = app.querySelector('.fin-root');
  if (!el) return;
  el.style.transform = ''; el.style.width = '';
  const avail = el.clientHeight;           // flex'in bu içeriğe ayırdığı alan
  const need = el.scrollHeight;            // içeriğin doğal boyu (sponsor paneli artık doğal akar)
  if (need > avail + 2 && avail > 160) {
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
  const b = v('su-baskan'), k = v('su-kulup'), s = v('su-sehir'), l = v('su-lakap');
  if (b !== undefined) G._setup.baskanAd = b;
  if (k !== undefined) G._setup.kulupAd = k;
  if (s !== undefined) G._setup.sehir = s;
  if (l !== undefined) G._setup.lakap = l;
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
  // Maç yayını sürerken (canlı, 90'a gelmemiş) HİÇBİR toast patlamasın — sonucu (galibiyet serisi/başarım)
  // sızdırır. Maç bitince (90' / sonuç ekranı) ertelenen toast'lar akar. (_achSeen/_lastStreakToast güncellenmez.)
  if (G.pendingMatch && G.pendingMatch.phase === 'live' && (G.pendingMatch._clock ?? 90) < 90) return;
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
const CALLER_COLOR = { gm: 'var(--info)', gazeteci: 'var(--warn)', kurul: 'var(--club)', menajer: 'var(--neg)', kaptan: 'var(--pos)', aile: '#e88aa8' };
const CALLER_TR = { gm: 'GENEL MENAJER', gazeteci: 'GAZETECİ', kurul: 'KURUL', menajer: 'MENAJER', kaptan: 'KAPTAN', aile: '💗 AİLE' };
// TELEFON KONU OYUNCUSU — kart HER telefonda çıksın: önce açık referans (file.player/playerId),
// yoksa başlık/gövdede ADI GEÇEN kadro/teklif/piyasa oyuncusunu bul (en uzun ad = en spesifik).
// Böylece savas/kaptan/kontrat/sakat/skandal gibi oyuncu konulu tüm telefonlarda kart açılır.
function phoneKonuId(G, ph) {
  if (ph.file?.player?.id != null) return ph.file.player.id;
  if (ph.playerId != null) return ph.playerId;
  const text = `${ph.title || ''} ${ph.body || ''}`;
  const havuz = [
    ...(G.squad || []),
    ...(G.inbox || []).flatMap((m) => (m.file && m.file.player) ? [m.file.player] : []),
    ...(G.market || []),
    ...(G.loanedOut || []),
  ];
  let best = null;
  for (const p of havuz) {
    if (p && p.name && p.name.length >= 4 && text.includes(p.name) && (!best || p.name.length > best.name.length)) best = p;
  }
  return best ? best.id : null;
}
function phoneModal(G) {
  const ph = G.phone;
  const color = CALLER_COLOR[ph.caller] || 'var(--club)';
  const opts = (ph.options || []).map((o, i) => `<span style="display:inline-flex;flex-direction:column;gap:2px;margin-right:6px">
      <button class="btn" data-act="phoneOpt" data-arg="${i}" style="border-color:${color}">${escH(o.label)}</button>
      ${o.whisper ? `<span class="muted" style="font-size:11px;padding-left:2px">${escH(o.whisper)}</span>` : ''}
    </span>`).join('');
  // Konu oyuncusu varsa DOSYAYI AÇ — teklif/panik/kiralık oyuncusunun kartını incele (findAnyPlayer telefonu da tarar)
  const konuId = phoneKonuId(G, ph);
  const kartBtn = konuId != null
    ? `<div style="margin-top:10px"><button class="btn" data-act="pcard" data-arg="${escH(String(konuId))}" style="border-color:${color};font-size:12px;opacity:.92">🔎 Oyuncu kartını aç</button></div>`
    : '';
  return `<div class="scene" style="max-width:520px">
    <div class="card card--phone phone-ring" style="border:2px solid ${color};text-align:left">
      <div class="overline" style="color:${color}">📞 ARIYOR · ${CALLER_TR[ph.caller] || 'ARAYAN'} — ${escH(ph.callerName || '')}</div>
      <h2 style="margin:10px 0 6px">${escH(ph.title)}</h2>
      <div class="muted">${escH(ph.body)}</div>
      ${kartBtn}
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
    case 'setupArma': readSetupInputs(); G._setup.arma = arg; break;             // arma stili (kalkan/daire/klasik)
    case 'setupGecmis': readSetupInputs(); G._setup.baskanGecmisi = arg; break;  // başkan geçmişi (pasif yetenek)
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
    case 'spDetay': { const [slot, id] = arg.split('|'); G._spCard = { slot, id }; render(); return; } // sponsor detay kartı aç
    case 'spCardClose': G._spCard = null; render(); return;
    case 'signSponsor': { const [slot, bid] = arg.split('|'); A.signSponsor(G, slot, bid); G._spCard = null; break; }
    case 'cancelSponsor': A.cancelSponsor(G, arg); G._spCard = null; break;
    case 'rejectSponsor': { const [slot, oid] = arg.split('|'); A.rejectSponsorOffer(G, slot, oid); G._spCard = null; break; } // teklife kapıyı göster
    case 'achModal': G._achModal = !G._achModal; break;                                        // başarım duvarı modalı
    case 'sndTest': FX.devam(); break;                                                         // ayarlar: örnek efekt
    case 'uiKontrast': G.uiKontrast = !G.uiKontrast; break;                                    // ayarlar: yüksek kontrast
    case 'fullscreen': { const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); break; }
    case 'pcard': G._pcard = arg; break;                                                       // oyuncu kartını aç
    case 'pcardClose': G._pcard = null; break;
    case 'kiralikListe': A.toggleKiralikListe(G, arg); break;                                  // kiralık listesine koy/çek
    case 'renewContract': A.renewContract(G, arg); break;                                       // oyuncu kartı: sözleşme yenile
    case 'noop': break;                                                                        // kart içi boş tık (kapatmasın)
    case 'midPromise': A.makeMidPromise(G, arg); break;                                        // oyun-içi yeni söz
    case 'trFiltre': G._trFiltre = arg; G._trSayfa = 0; break;                                 // piyasa filtresi (mevki/kısa liste/hepsi)
    case 'trSayfa': G._trSayfa = Math.max(0, (G._trSayfa || 0) + Number(arg)); break;          // 80+ havuzda sayfalama
    case 'trSirala': G._trSirala = arg; G._trSayfa = 0; break;                                 // masa sıralaması (güç/bedel/yaş)
    case 'shortlist': { const s = new Set(G._shortlist || []); s.has(arg) ? s.delete(arg) : s.add(arg); G._shortlist = [...s]; break; } // ★ kısa liste
    case 'kurulButce': A.kurulButceArtisi(G); break;                                           // dönemde 1 kez tavan artışı iste
    case 'sosyalProje': A.sosyalProje(G); break;                                               // P10: kulüp mahalleye iner
    case 'kadinTakim': A.kadinTakimiKur(G); break;                                             // P11: kadın futbol şubesi
    case 'yurtOfis': A.yurtdisiOfisAc(G); break;                                               // P20: uluslararası ofis
    case 'gmItiraz': A.gmBudgetItiraz(G, arg); break;                                          // bütçe dışı isim → GM görüşü
    case 'sorgula': { const [pid, uc] = arg.split('|'); A.sorgulaPlayer(G, pid, { ucretli: uc === 'ucret' }); break; } // hak ya da 0,2mn
    case 'derinRapor': A.derinRapor(G, arg); break;                                            // 0,8mn: kesin güç + isimli ilgi
    case 'reqOffer': A.requestOffer(G, arg); break;                                            // GM'e dosya iste
    case 'tfile': { const [id, c] = arg.split('|'); A.resolveTransferFile(G, id, c); break; } // §1 onay dosyası
    case 'sfile': { const [id, c] = arg.split('|'); A.resolveSaleFile(G, id, c); break; }     // §1 satış aynası
    case 'kayyum': { const [id, c] = arg.split('|'); A.kayyumPaket(G, id, c); break; }        // #3 kurtuluş paketi
    case 'ultras': { const [id, c] = arg.split('|'); A.resolveUltras(G, id, c); break; }      // 2.6 tribün talebi (karşıla/reddet)
    case 'delegeYemek': A.delegeYemek(G, arg); break;                                         // 2.6 blok sofrası
    case 'megaProje': A.megaProjeBaslat(G); break;                                            // #8 stadyum kompleksi
    case 'spBuyout': { const [id, c] = arg.split('|'); A.resolveSponsorBuyout(G, id, c); break; } // sponsor avı — fesih bedelini rakip öder
    // BUG DERSİ: bu case eskiden 'vitrin' adındaydı ve aşağıdaki satış-listesi 'vitrin' case'ini
    // GÖLGELİYORDU (duplicate case — ilk eşleşen kazanır, oyuncu kartı "Satış listesi" ölmüştü).
    case 'ozVitrin': { const [k, i] = arg.split('|'); G._vitrin = { kat: k, idx: +i || 0 }; break; } // showroom 3D vitrin seçimi (salt UI)
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
    case 'seasonBudget': { const [id, c] = arg.split('|'); A.resolveSeasonBudget(G, id, c); break; } // yeni sezon transfer kesesi onayı
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
    case 'matchPlay': { const p = G.pendingMatch; if (p) { p._playing = !p._playing; } render(); return; }        // canlı yayın: oynat/duraklat
    case 'matchSpeed': { const p = G.pendingMatch; if (p) { p._speed = ((p._speed || 1) % 3) + 1; } render(); return; } // 1x→2x→3x
    case 'matchFinish': { const p = G.pendingMatch; if (p) { p._clock = 90; p._playing = false; } render(); return; } // maçı bitir (90'a atla)
    case 'phoneOpt': { A.answerPhone(G, arg); FX.devam(); render(); return; }                 // Y2 telefon
    case 'phoneDefer': { A.deferPhone(G); render(); return; }
    case 'desk': { A.deskAction(G, arg || 'katil'); FX.tik(); break; }                         // Y6 masa dokunuşu (katil/gec)
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
    // ── İLİŞKİ aksiyonları (2.1) ──
    case 'pJest': A.playerJest(G, arg); break;                                                // kişisel jest (haftada 1)
    case 'pSoz': A.playerSoz(G, arg); break;                                                  // "satmam sözü"
    case 'roportaj': { const r = A.ozelRoportaj(G); if (r && r.ok) FX.devam(); break; }       // basına özel röportaj (2.5)
    // ── ÖZEL HAYAT aksiyonları ──
    case 'ozelTab': G._ozelTab = arg; break;
    case 'ozelProg': A.ozelProg(G, arg); break;                                               // haftalık akşam programı (+/−)
    case 'ozelKarar': { const r = A.ozelKarar(G, Number(arg)); if (r && r.ok) FX.tik(); break; } // özel gündem ikilemi (tok karar sesi)
    case 'ozelVarlik': A.ozelVarlik(G, arg); break;                                           // varlık yükseltme
    case 'ozelDavet': { const r = A.ozelDavet(G, arg); if (r && r.ok) FX.devam(); break; }    // davet düzenle
    case 'ozelBagis': A.ozelBagis(G, parseFloat(arg)); break;                                 // kulübe kişisel destek
    case 'save': doSave(); return;
    case 'load': doLoad(); return;
    case 'devam': onDevam(); autoSave(); return;                                              // her ilerleyişte otokayıt
    case 'contSave': autoContinue(); return;                                                  // açılış: kayıtlı kariyere devam
    // ── ANA MENÜ aksiyonları ──
    case 'menuYeni': G.phase = 'CLUB_SELECT'; break;                                          // Yeni Oyun → kulüp seçimi
    case 'menuDevam': autoContinue(); return;                                                 // Devam Et → kayıtlı kariyer
    case 'menuKariyer': showToast({ icon: '🏆', title: 'Kariyer & Rekorlar', sub: 'Yakında — kariyer defterin buraya açılacak.' }); return;
    case 'menuAyarlar': showToast({ icon: '⚙️', title: 'Ayarlar', sub: 'Yakında — ses, dil ve erişilebilirlik burada.' }); return;
    case 'menuSteam': showToast({ icon: '▸', title: 'Steam İstek Listesi', sub: 'Steam sayfası yakında yayında.' }); return;
    case 'menuCikis': showToast({ icon: '👋', title: 'İyi oyunlar Başkanım', sub: 'Çıkmak için tarayıcı sekmesini kapatabilirsin.' }); return;
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
        // Kullanıcı isteği: devre arası/son-dakika KARAR ekranları kaldırıldı — DİREK canlı yayına.
        // pre → (HT/late nötr auto-çöz) → live → post → kapan
        if (G.pendingMatch.phase === 'pre') { autoResolveToLive(); FX.devam(); render(); break; }
        if (G.pendingMatch.phase === 'ht' || G.pendingMatch.phase === 'late') { autoResolveToLive(); render(); break; }
        if (G.pendingMatch.phase === 'live') {
          // yayın bitmeden DEVAM → önce maçı bitir (90'a atla); ikinci DEVAM sonuç ekranına geçer
          if ((G.pendingMatch._clock ?? 90) < 90) { G.pendingMatch._clock = 90; G.pendingMatch._playing = false; render(); break; }
          G.pendingMatch.phase = 'post';
          if (G.pendingMatch.myRes === 'W') { FX.gol(); konfetiAt(); } // ekran sarsıntısı kaldırıldı (kullanıcı isteği)
          else if (G.pendingMatch.myRes === 'L') FX.yenilgi();
          render(); break;
        }
        G.pendingMatch = null;
        if (G.meta.week > G.SEASON_WEEKS) { A.endSeason(G); }
        render();
      } else if ((G.hazirlik || 0) > 0) { A.preSeasonWeek(G); FX.devam(); render(); } // sezon başı hazırlık dönemi
      else { A.beginWeek(G); autoResolveToLive(); FX.devam(); render(); } // DİREK maça: pre'yi atla (telefon yoksa)
      break;
    case 'SEASON_END':
      A.afterSeasonEnd(G); render(); break;
    case 'CAMPAIGN':
      A.advanceCampaign(G); render(); break;
    case 'ELECTION_NIGHT': {
      const e = G.election;
      if ((e.revealStep ?? 0) <= 6 && !e.counting && !e.done) { e.revealStep = (e.revealStep ?? 0) + 1; render(); break; } // karne kartları tek tek + rakip
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
  const set = (s, v) => { const el = q(s); if (el) el.textContent = v; };
  // TEK ÇİZİM NOKTASI — iki barı da AYNI karede çizer. width = oy/TOPLAM olduğundan
  // oyu ÇOK olanın barı HER ZAMAN daha uzun; transition YOK → ne hesaplanırsa o çizilir
  // (eski hata: CSS width-transition hızlı büyüyen/önde barı geriden takip edip kısa gösteriyordu).
  const ciz = (senV, rakV) => {
    // ÖNEMLİ: bar SADECE .aday-bar içinden seçilir. "Şu an önde" rozeti (.zg-onde-ad) önde
    // olana göre sen/rakip class'ı alır ve DOM'da bardan önce gelir → '.secim-zafer .rakip'
    // o rozeti yakalar, genişlik yanlış elemana yazılır, ÖNDE olanın barı hiç güncellenmezdi.
    const sen = q('.secim-zafer .aday-bar .sen'), rak = q('.secim-zafer .aday-bar .rakip'); if (!sen || !rak) return false;
    // INLINE transition/transform none: eski/önbellekteki CSS'te width-transition kalsa bile
    // inline stil onu EZER → kovalama/lag olmaz, genişlik = oy/TOPLAM birebir çizilir.
    sen.style.transition = 'none'; sen.style.transform = 'none';
    rak.style.transition = 'none'; rak.style.transform = 'none';
    sen.style.width = (senV / TOPLAM * 100) + '%';
    rak.style.width = (rakV / TOPLAM * 100) + '%';
    q('.zg-lbl-sen').textContent = `${senV} oy · %${Math.round(senV / TOPLAM * 100)}`;
    q('.zg-lbl-rakip').textContent = `${rakV} oy · %${Math.round(rakV / TOPLAM * 100)}`;
    const sayilan = senV + rakV;
    set('.zg-sayilan', '%' + Math.round(sayilan / TOPLAM * 100));
    set('.zg-katilan', String(sayilan));
    const ondeEl = q('.zg-onde-ad');
    if (ondeEl) {
      const onde = senV >= rakV;
      ondeEl.textContent = onde ? benAd : z.rakipAd;
      ondeEl.classList.toggle('lead-sen', onde);   // NOT: 'sen'/'rakip' DEĞİL — bar seçicisiyle çakışırdı
      ondeEl.classList.toggle('lead-rakip', !onde);
    }
    return true;
  };
  const bitir = () => {
    if (!q('.secim-zafer')) return; // ekran atlandı
    q('.secim-zafer').classList.add('bitti');
    q('.zg-ust').textContent = 'Kongre Seçimi · Sandık Kapandı';
    set('.zg-salon', `Kongre salonu · ${TOPLAM} delege · tüm sandıklar sayıldı`);
    ciz(senF, rakF);                                  // final: tam değerler tek noktadan
    const onde = q('.zg-onde'); if (onde) onde.style.display = 'none';
    q('.zg-kazandin').classList.add('goster');
    q('.zg-sonuc').classList.add('goster');
    konfetiAt(); FX.zafer();
  };
  if (azalt || !q('.secim-zafer')) { bitir(); return; }
  // rAF: her kare tek p'den çizilir → iki bar TAM senkron; rakip önden dolar (x^0.8),
  // sen sona doğru geçer (x^1.25). İkisi de monoton → donma/zıplama yok.
  const easeGir = (x) => Math.pow(x, 1.25);
  const easeCik = (x) => Math.pow(x, 0.8);
  const sure = 9000;
  let t0 = 0, sonTik = 0;
  const adim = (now) => {
    if (t0 === 0) t0 = now;
    const p = Math.min(1, (now - t0) / sure);
    const senV = p >= 1 ? senF : Math.round(senF * easeGir(p));
    const rakV = p >= 1 ? rakF : Math.round(rakF * easeCik(p));
    if (!ciz(senV, rakV)) return;                     // ekran atlandı → dur
    if (now - sonTik > 1100) { sonTik = now; FX.sayim(); } // sandık tıkırtısı
    if (p >= 1) { bitir(); return; }
    requestAnimationFrame(adim);
  };
  requestAnimationFrame(adim);
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

// #1 ŞAMPİYONLUK KUPASI — prosedürel altın kupa SVG (asset yok; başkanlık altını degrade + ışık huzmesi)
function kupaSvg() {
  return `<svg viewBox="0 0 120 140" width="100%" height="100%" aria-hidden="true">
    <defs>
      <linearGradient id="kupa-au" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f0cd6e"/><stop offset=".5" stop-color="#d4a940"/><stop offset="1" stop-color="#9a7622"/>
      </linearGradient>
      <radialGradient id="kupa-glow" cx="50%" cy="34%" r="62%">
        <stop offset="0" stop-color="rgba(240,205,110,.45)"/><stop offset="1" stop-color="transparent"/>
      </radialGradient>
    </defs>
    <rect width="120" height="140" fill="url(#kupa-glow)"/>
    <path d="M35 18 h50 v26 c0 18 -11 30 -25 30 s-25 -12 -25 -30 Z" fill="url(#kupa-au)"/>
    <path d="M35 24 c-14 0 -20 8 -18 18 c2 9 10 14 20 14 M85 24 c14 0 20 8 18 18 c-2 9 -10 14 -20 14" fill="none" stroke="url(#kupa-au)" stroke-width="6" stroke-linecap="round"/>
    <rect x="54" y="74" width="12" height="16" fill="url(#kupa-au)"/>
    <path d="M42 90 h36 l6 14 h-48 Z" fill="url(#kupa-au)"/>
    <rect x="34" y="104" width="52" height="10" rx="2" fill="#7c5f1d"/>
    <path d="M44 20 v22 c0 10 4 18 8 22" stroke="rgba(255,255,255,.45)" stroke-width="3" fill="none" stroke-linecap="round"/>
  </svg>`;
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
// Esc: açık overlay'i kapat · SPACE: ekrandaki DEVAM butonuna basar (kullanıcı isteği) —
// yazı alanında yazarken ve tuş basılı tutulurken (repeat) ÇALIŞMAZ; ekranda buton yoksa hiçbir şey ilerlemez.
window.addEventListener('keydown', (e) => {
  if (!G) return;
  if (e.key === ' ' || e.code === 'Space') {
    if (e.repeat) return; // basılı tutup hafta makinelemek yok — her ilerleme bilinçli bir dokunuş
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    const btn = document.querySelector('button[data-act="devam"]:not([disabled])');
    if (btn) { e.preventDefault(); btn.click(); } // preventDefault: sayfa kaydırma + odaklı butonda çift tetik engeli
    return;
  }
  if (e.key !== 'Escape') return;
  if (G._pcard) { G._pcard = null; render(); }
  else if (G._achModal) { G._achModal = false; render(); }
});
eventBus.on('TICK_END', () => {}); // ui eventBus dinler (ileride canlı widget'lar buraya bağlanacak)

// AÇILIŞ 1f: kart hover'ında görsel renk parıltısı CSS ile kalır; uğultu sesi kaldırıldı (kullanıcı isteği)
globalThis.SBhover = () => {};

window.addEventListener('resize', () => { fitVaat(); fitSb(); }); // pencere boyu değişse de sahneler sığar
// Fontlar geç gelirse ilk render fitVaat'ı yanlış (küçük) ölçüyle çalıştırır → sahne az ölçeklenip
// alttan taşabilir. Web fontları yerleşince bir kez daha sığdır (sonraki her render zaten çağırır).
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fitVaat(); fitSb(); });

boot();
