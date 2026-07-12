// src/ui/opposition.js — M1 MUHALEFET DÖNEMİ (Bible-17): tribünden izlersin, müdahale edemezsin.
// Devir raporu + sezon özet kartları (AI başkanın 1 büyük kararı + sonucu) + "Aday ol".
import { TUNING } from '../config.js';
import { esc } from './frame.js';
import { oppTypeTr } from '../engines/legacy.js';

export function render(G) {
  const o = G.opposition, D = G.devirRaporu || {};
  const bitti = o.season >= TUNING.MIRAS.OPP_SEASONS;

  const devir = `<div class="card" style="text-align:left">
    <div class="overline">Devir-Teslim Raporu — ne bıraktın (arşivlendi)</div>
    <div class="fin-lines" style="margin-top:6px">
      <div class="l"><span>Borç / Kasa</span><b class="tnum">${D.borc}mn / ${D.kasa}mn</b></div>
      <div class="l"><span>Kadro değeri</span><b class="tnum">${D.kadroDeger}mn</b></div>
      <div class="l"><span>Son sıra</span><b class="tnum">${D.pos}.</b></div>
      <div class="l"><span>Tutulmayan sözler</span><b>${D.tutulmayan && D.tutulmayan.length ? esc(D.tutulmayan.join(', ')) : 'yok'}</b></div>
    </div>
    <div class="muted" style="font-size:11px;margin-top:6px">Bu rapor saklanır — dönüş seçiminde kozun da yükün de bu.</div>
  </div>`;

  const kartlar = o.cards.map((c) => `<div class="card" style="text-align:left">
    <div class="overline">Muhalefette ${c.sezon}. sezon · lig ${c.pos}.</div>
    <div style="margin-top:6px"><b>${esc(c.karar)}</b></div>
    <div class="muted" style="margin-top:4px">${esc(c.sonuc)}</div>
  </div>`).join('');

  const alt = bitti
    ? `<div class="card" style="border-color:var(--club)">
        <div class="overline" style="color:var(--club)">Kongre takvimi açıklandı</div>
        <div class="muted" style="margin:6px 0">Üç sezon tribünden izledin. ${esc(o.pres.name)}'in karnesi ortada — şimdi söz sende.</div>
        <button class="btn" data-act="adayOl" style="border-color:var(--club);font-size:15px">🗳 ADAY OL</button>
      </div>`
    : `<div class="muted" style="font-size:12px">DEVAM = bir muhalefet sezonu izle (müdahale yok — koltuk onun)</div>`;

  return `<div class="scene" style="max-width:640px">
    <div class="overline">MUHALEFET DÖNEMİ · Başkan: ${esc(o.pres.name)} <span class="badge">${esc(oppTypeTr(o.pres.type))}</span></div>
    <h2 style="margin:6px 0;font-family:var(--serif)">Tribünden İzliyorsun</h2>
    <div style="display:grid;gap:10px;margin-top:10px">${devir}${kartlar}</div>
    <div style="margin-top:12px">${alt}</div>
  </div>`;
}
