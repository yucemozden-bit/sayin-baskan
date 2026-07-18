// src/ui/campaignView.js — D6: Kampanya fazı + Münazara sahnesi (sb- cinematic görsel katman).
import { TUNING } from '../config.js';
import { esc } from './frame.js';
import { CAMPAIGN_ACTIONS } from '../engines/campaign.js';
import { sbTopbar } from './cockpit.js';

export function renderCampaign(G) {
  const c = G.campaign || { tick: 1, kp: 0 };
  const TICKS = TUNING.DELUXE.CAMPAIGN_TICKS;
  const proj = G.lastProj;
  const pct = proj ? Math.round(proj.oyOrani * 100) : null;
  const kazandi = !!(proj && proj.kazandi);
  const esikPct = Math.round(TUNING.WIN_LINE * 100);
  const b = proj ? proj.breakdown : null;
  const acts = Object.entries(CAMPAIGN_ACTIONS).map(([k, a]) =>
    `<button class="kmp-act ${a.kp >= 2 ? 'big' : ''}" data-act="campaign" data-arg="${k}" ${c.kp < a.kp ? 'disabled' : ''} data-tip="${a.kp} kampanya puanı harcar">
      <span class="kmp-act-l">${esc(a.label)}</span><span class="kmp-act-kp">${a.kp} KP</span></button>`).join('');
  const blok = (ik, ad, val) => {
    const v = Math.round(val);
    const cls = v >= 55 ? 'pos' : v < 45 ? 'neg' : '';
    return `<div class="kmp-blok"><span>${ik} ${ad}</span><span class="kmp-blok-r"><span class="kmp-blok-bar"><i class="${cls}" style="width:${Math.max(4, Math.min(100, v))}%"></i></span><b class="${cls}">${v}</b></span></div>`;
  };
  const bloklar = b
    ? blok('🏟', 'Tribün delegeleri', b.taraftar) + blok('💼', 'İş dünyası', (b.mali + b.itibar) / 2) + blok('🏛', 'Eski yönetimler', (b.soz + b.sportif) / 2)
    : '<div class="sb-muted">Projeksiyon birikmedi — ilk kampanya haftasından sonra bloklar netleşir.</div>';
  return `<div class="sb-root sb-cinematic kmp-root">
    <div class="sb-atmo"></div><div class="sb-vignette"></div>
    ${sbTopbar(G, { phaseChip: `KAMPANYA · HAFTA ${c.tick}/${TICKS}` })}
    <div class="sb-body sb-body-col kmp-body">
      <div class="kmp-head">
        <div class="sb-crumb">KAMPANYA · HAFTA ${c.tick}/${TICKS} · SEÇİME AZ KALDI</div>
        <div class="kmp-proj">Bugün seçim olsa: <b class="${kazandi ? 'pos' : 'neg'}">${pct != null ? '%' + pct : '—'}</b></div>
        <div class="kmp-bar"><span class="kmp-bar-fill ${kazandi ? 'pos' : 'neg'}" style="width:${pct || 0}%"></span><span class="kmp-esik" style="left:${esikPct}%"></span></div>
        <div class="kmp-esik-lbl">kazanma eşiği %${esikPct}</div>
      </div>
      <div class="kmp-grid">
        <div class="sb-panel">
          <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">KAMPANYA PUANI</span><span class="sb-panel-r"><b class="sb-club-ink">${c.kp}</b> KP</span></div>
          <div class="kmp-acts">${acts}</div>
          <div class="kmp-note">3 sezonluk emek &gt; 3 haftalık şov — kampanya karneyi yenemez, kıl payını çevirir.</div>
        </div>
        <div class="sb-panel">
          <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">DELEGE BLOKLARI</span><span class="sb-panel-r">%50 = kararsız</span></div>
          <div class="kmp-bloklar">${bloklar}</div>
        </div>
      </div>
    </div>
    <footer class="sb-bottombar">
      <div class="sb-bb-l"><span class="sb-bb-k">KAMPANYA</span><span class="sb-bb-note">Hafta ${c.tick}/${TICKS} · ${c.kp} kampanya puanı elde</span></div>
      <button class="sb-btn sb-btn-primary" data-act="devam">Kampanya haftasını bitir ▸ (${c.tick}/${TICKS})</button>
    </footer>
  </div>`;
}

export function renderDebate(G) {
  const d = G.debate;
  const empty = '<div class="sb-root sb-cinematic"><div class="sb-atmo"></div><div class="sb-body sb-body-col" style="justify-content:center;align-items:center"><div class="sb-muted">Münazara hazırlanıyor…</div></div></div>';
  if (!d) return empty;
  const q = d.qs[d.idx];
  if (!q) return empty;
  const done = d.answers.map((a) => `<span class="mnz-chip ${a.puan > 0 ? 'pos' : a.puan < 0 ? 'neg' : ''}">${esc(a.comp)} ${a.puan > 0 ? '+' : ''}${a.puan}</span>`).join('');
  return `<div class="sb-root sb-cinematic mnz-root">
    <div class="sb-atmo sb-atmo-pitch"></div><div class="sb-vignette"></div><div class="sb-pitch-lines"></div>
    ${sbTopbar(G, { phaseChip: `MÜNAZARA · SORU ${d.idx + 1}/4` })}
    <div class="sb-body sb-body-col mnz-body">
      <span class="sb-chip sb-chip-live mnz-live"><i class="sb-dot-live"></i>CANLI YAYIN · MÜNAZARA</span>
      <div class="mnz-q"><span class="mnz-mod">🎙 Moderatör</span>"${esc(q.label)} hakkında ne diyeceksiniz?"</div>
      <div class="mnz-note">Konudaki gerçek karnen belli — yanlış tonda cevap geri teper.</div>
      <div class="mnz-acts">
        <button class="mnz-act veri" data-act="debate" data-arg="veri"><b>📊 Veriyle savun</b><i>karnen sağlamsa işler, çürükse geri teper</i></button>
        <button class="mnz-act vizyon" data-act="debate" data-arg="vizyon"><b>🌅 Vizyonla büyüle</b><i>güvenli, küçük ama garanti etki</i></button>
        <button class="mnz-act saldiri" data-act="debate" data-arg="saldiri"><b>⚔ Rakibe saldır</b><i>yüksek risk — tutarsa çok, tutmazsa ters</i></button>
      </div>
      ${done ? `<div class="mnz-prog"><span class="mnz-prog-l">CEVAPLAR</span>${done}</div>` : ''}
    </div>
    <footer class="sb-bottombar">
      <div class="sb-bb-l"><span class="sb-bb-k">MÜNAZARA</span><span class="sb-bb-note">Soru ${d.idx + 1}/4 · doğru tonu bul</span></div>
      <button class="sb-btn" data-act="debateSkip" data-tip="Terk et: −2 kampanya puanı + 'kaçtı' manşeti">Münazarayı terk et</button>
    </footer>
  </div>`;
}
