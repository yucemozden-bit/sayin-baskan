// src/ui/campaignView.js — D6: Kampanya fazı + Münazara sahnesi (v5-§5).
import { TUNING } from '../config.js';
import { esc } from './frame.js';
import { CAMPAIGN_ACTIONS } from '../engines/campaign.js';

export function renderCampaign(G) {
  const c = G.campaign || { tick: 1, kp: 0 };
  const proj = G.lastProj;
  const pct = proj ? Math.round(proj.oyOrani * 100) : null;
  const acts = Object.entries(CAMPAIGN_ACTIONS).map(([k, a]) =>
    `<button class="btn" data-act="campaign" data-arg="${k}" ${c.kp < a.kp ? 'disabled' : ''}>${a.label} <span class="muted">(${a.kp} KP)</span></button>`).join('');
  const b = proj ? proj.breakdown : null;
  const bloklar = b ? `<div class="fin-lines" style="margin-top:6px">
    <div class="l"><span>🏟 Tribün delegeleri</span><b class="tnum">${Math.round(b.taraftar)}</b></div>
    <div class="l"><span>💼 İş dünyası</span><b class="tnum">${Math.round((b.mali + b.itibar) / 2)}</b></div>
    <div class="l"><span>🏛 Eski yönetimler</span><b class="tnum">${Math.round((b.soz + b.sportif) / 2)}</b></div>
  </div>` : '<div class="muted">—</div>';
  return `<div class="scene" style="max-width:640px">
    <div class="overline">KAMPANYA · Hafta ${c.tick}/${TUNING.DELUXE.CAMPAIGN_TICKS} · Seçime az kaldı</div>
    <h2 style="margin:6px 0">Bugün seçim olsa: ${pct != null ? `<span style="color:${proj.kazandi ? 'var(--pos)' : 'var(--neg)'}">%${pct}</span>` : '—'}</h2>
    <div class="card" style="text-align:left"><div class="overline">Kampanya Puanı: <b>${c.kp} KP</b></div>
      <div class="btnrow" style="margin-top:8px">${acts}</div>
      <div class="muted" style="font-size:12px;margin-top:6px">3 sezonluk emek &gt; 3 haftalık şov — kampanya karneyi yenemez, kıl payını çevirir.</div>
    </div>
    <div class="card" style="text-align:left;margin-top:12px"><div class="overline">Delege Blokları</div>${bloklar}</div>
  </div>`;
}

export function renderDebate(G) {
  const d = G.debate;
  if (!d) return '<div class="muted">…</div>';
  const q = d.qs[d.idx];
  const done = d.answers.map((a) => `<span class="chip">${a.comp}: ${a.puan > 0 ? '+' : ''}${a.puan}</span>`).join(' ');
  return `<div class="scene" style="max-width:640px">
    <div class="overline">MÜNAZARA · Soru ${d.idx + 1}/4 · canlı yayın</div>
    <h2 style="margin:10px 0">Moderatör: "${esc(q.label)} hakkında ne diyeceksiniz?"</h2>
    <div class="muted" style="margin-bottom:14px">Konudaki gerçek karnen belli — yanlış tonda cevap geri teper.</div>
    <div class="btnrow" style="justify-content:center">
      <button class="btn" data-act="debate" data-arg="veri">📊 Veriyle savun</button>
      <button class="btn" data-act="debate" data-arg="vizyon">🌅 Vizyonla büyüle</button>
      <button class="btn" data-act="debate" data-arg="saldiri">⚔ Rakibe saldır</button>
    </div>
    <div class="btnrow" style="justify-content:center;margin-top:14px">
      <button class="btn" data-act="debateSkip" style="opacity:.6">Münazarayı terk et (−2, "kaçtı" manşeti)</button>
    </div>
    ${done ? `<div class="power-strip" style="justify-content:center;margin-top:14px">${done}</div>` : ''}
  </div>`;
}
