// src/ui/squadView.js — KADRO (sb- görsel katman): 4 mevki kolonu, her oyuncu DETAYLI kart —
// güç±, avatar, isim/yaş, DEĞER/MAAŞ, FORM/KND/MRL metreleri + "Detay" butonu (→ 3D oyuncu kartı,
// satış/kiralık/sözleşme orada). Üstte TD şeridi (ilişki + otorite barları + maaş + TD'yi Kov).
import { TUNING } from '../config.js';
import { esc, fmt } from './frame.js';
import { coachDescribe, relWord } from '../actions.js';
import { sbShell } from './cockpit.js';
import { playerAvatar } from './playerCard.js';

const POS_TR = { GK: 'Kaleci', DEF: 'Stoper', MID: 'Orta saha', FWD: 'Forvet' };
const KOLONLAR = [['GK', 'KALECİLER', 'info'], ['DEF', 'DEFANS', 'pos'], ['MID', 'ORTA SAHA', 'warn'], ['FWD', 'HÜCUM', 'neg']];
const ovCls = (o) => (o >= 66 ? 'sb-ov-high' : o >= 57 ? 'sb-ov-mid' : 'sb-ov-low');
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const formWord = (f) => (f >= 62 ? 'formda' : f >= 45 ? 'dalgalı' : 'formsuz');
const kondWord = (k) => (k >= 85 ? 'zinde' : k >= 65 ? 'yorgun' : 'bitkin');
const moralWord = (m) => (m >= 66 ? 'yüksek' : m >= 45 ? 'orta' : 'düşük');
const otoriteWord = (o) => (o >= 72 ? 'otoriter' : o >= 48 ? 'dengeli' : 'yumuşak');
const renk = (v) => (v >= 62 ? 'var(--pos)' : v >= 45 ? 'var(--warn)' : 'var(--neg)');
const meter = (lbl, v, tipLbl, word) => `<span class="kad-m" data-tip="${tipLbl}: ${word} (${Math.round(v)})"><i>${lbl}</i><s><u style="width:${clamp(Math.round(v), 4, 100)}%;background:${renk(v)}"></u></s></span>`;

export function render(G) {
  const fog = Math.max(1, TUNING.FOG_BASE - G.facilities.scout * TUNING.FOG_PER_SCOUT);
  const h = Math.max(1, Math.ceil(fog / 3));

  const cols = KOLONLAR.map(([pos, ad, c]) => {
    const list = G.squad.filter((p) => p.pos === pos).sort((a, b) => b.overall - a.overall);
    const cards = list.map((p) => {
      const tags = `${p.id === G.captainId ? ' <b class="kad-c-c" title="Kaptan">C</b>' : ''}${p.isStar ? ' <b class="kad-c-star">★</b>' : ''}${p.age <= 21 ? ' <span class="kad-c-genc">GENÇ</span>' : ''}${p.injuryWeeks > 0 ? ' 🩹' : ''}${p.suspensionWeeks > 0 ? ' 🟥' : ''}${p.vitrin ? ' 🏷' : ''}${p.kiralikListe ? ' ↔' : ''}${p.loanIn ? ' 🔒' : ''}`;
      const durum = p.vitrin ? '<b class="kad-c-dur sat">SATIŞTA</b> · ' : p.kiralikListe ? '<b class="kad-c-dur kir">KİRALIK L.</b> · ' : p.loanIn ? '<b class="kad-c-dur loan">KİRALIK</b> · ' : '';
      const durCls = `${p.vitrin ? ' is-vitrin' : ''}${p.kiralikListe ? ' is-kiralik' : ''}${p.loanIn ? ' is-loan' : ''}`;
      return `<div class="kad-c${durCls}" data-act="pcard" data-arg="${p.id}" data-tip="${p.vitrin ? 'SATIŞ LİSTESİNDE — teklifler telefonla gelir · ' : p.kiralikListe ? 'KİRALIK LİSTESİNDE · ' : ''}Detay: güç · form · değer · sözleşme · satış/kiralık/yenile">
        <span class="kad-c-ov ${ovCls(p.overall)}">${p.overall}<i>±${h}</i></span>
        <span class="kad-c-av">${playerAvatar(p, 34)}</span>
        <div class="kad-c-mid">
          <div class="kad-c-nm">${esc(p.name || '—')}${tags}</div>
          <div class="kad-c-meta" data-tip="Form: ${formWord(p.form)} · Kondisyon: ${kondWord(p.fitness)} · Moral: ${moralWord(p.morale)}">${durum}${p.age} yaş · ${formWord(p.form)} · ${kondWord(p.fitness)}</div>
        </div>
        <div class="kad-c-money">
          <span class="kad-c-deger" data-tip="Piyasa değeri"><i>DEĞER</i><b>${fmt(p.marketValue)}<em>mn</em></b></span>
          <span class="kad-c-maas" data-tip="Yıllık maaş"><i>MAAŞ</i><b>${fmt(p.wage)}<em>mn</em></b></span>
        </div>
        <span class="kad-c-btn" data-act="pcard" data-arg="${p.id}">Detay ›</span>
      </div>`;
    }).join('');
    return `<div class="sb-kad-col"><div class="sb-kad-h" data-c="${c}"><span class="sb-tick"></span>${ad}<span class="sb-panel-r">${list.length} oyuncu</span></div><div class="kad-col-list">${cards}</div></div>`;
  }).join('');

  // ── TD şeridi: profil + ilişki barı + otorite barı + maaş + Kov ──
  const rel = clamp(G.tdRelation ?? 70, 0, 100);
  const oto = clamp(G.coach.otorite ?? 60, 0, 100);
  const tdBand = `<div class="sb-panel kad-td-band">
    <span class="kad-td-av">${esc((G.coach.name || 'T')[0])}</span>
    <div class="kad-td-id"><div class="kad-td-nm">${esc(G.coach.name)} <span>· TEKNİK DİREKTÖR</span></div><div class="kad-td-desc">${esc(coachDescribe(G.coach))} — takımı sahada o yönetir; sen telkin verirsin, o tartar.</div></div>
    <div class="kad-td-stat"><i>SENİNLE İLİŞKİSİ</i><span class="kad-td-bar"><u style="width:${rel}%;background:var(--pos)"></u></span><b>${relWord(G.tdRelation)}</b></div>
    <div class="kad-td-stat"><i>OTORİTE</i><span class="kad-td-bar"><u style="width:${oto}%;background:var(--info)"></u></span><b>${otoriteWord(oto)}</b></div>
    <div class="kad-td-stat maas"><i>MAAŞ</i><b>${fmt(G.coach.wage || 0)}mn<em>/sezon</em></b></div>
    ${G.coachSearch
    ? '<span class="sb-tag">aday süreci inbox\'ta</span>'
    : `<button class="sb-btn sb-btn-neg sb-btn-sm" data-act="fireCoach" data-tip="Bedeli: tazminat + medya fırtınası + taraftar tepkisi">TD'yi Kov</button>`}
  </div>`;

  const yasOrt = (G.squad.reduce((a, p) => a + p.age, 0) / Math.max(G.squad.length, 1)).toFixed(1).replace('.', ',');
  const toplamDeger = fmt(Math.round(G.squad.reduce((a, p) => a + (p.marketValue || 0), 0)));
  return sbShell(G, {
    crumb: `KADRO · ${G.squad.length} OYUNCU · TOPLAM DEĞER ${toplamDeger}MN · YAŞ ORT. ${yasOrt} · GÖZLEM ±${h}`,
    title: 'Takım Kadrosu',
    body: `${tdBand}<div class="sb-kad-grid kad-grid-cards">${cols}</div>`,
  });
}
