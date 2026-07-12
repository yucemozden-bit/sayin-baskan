// src/ui/squadView.js — KADRO "formasyon panosu" v2: FIFA tarzı güç kartı +
// etiketli metre barları (FORM/KND/MRL) + etiketli Değer/Maaş. Kaydırma yok.
// Güç kartı kademe renkli (t1 altın / t2 yeşil / t3 mavi / t4 gri) — takımın
// omurgası bir bakışta okunur. Sis (gözlem) büyük sayının yanında ± olarak durur.
import { TUNING } from '../config.js';
import { esc, fmt } from './frame.js';
import { coachDescribe, relWord } from '../actions.js';
import { playerAvatar } from './playerCard.js';

const POS_GRUP = { GK: 'KALECİLER', DEF: 'DEFANS', MID: 'ORTA SAHA', FWD: 'HÜCUM' };
const POS_COL = { GK: 'var(--club)', DEF: 'var(--info)', MID: 'var(--pos)', FWD: 'var(--warn)' };

const formWord = (f) => (f >= 62 ? 'formda' : f >= 45 ? 'dalgalı' : 'formsuz');
const kondWord = (k) => (k >= 85 ? 'zinde' : k >= 65 ? 'yorgun' : 'bitkin');
const moralWord = (m) => (m >= 72 ? 'yüksek' : m >= 55 ? 'iyi' : m >= 40 ? 'düşük' : 'dipte');

// Etiketli mini metre — kısaltma + bar + hover'da tam kelime (belirsiz glif YOK)
function meter(lbl, tip, val, col) {
  return `<span class="kad-m" data-tip="${tip}"><i>${lbl}</i><span class="tr"><b style="width:${Math.max(4, Math.round(val))}%;background:${col}"></b></span></span>`;
}

export function render(G) {
  const fog = Math.max(1, TUNING.FOG_BASE - G.facilities.scout * TUNING.FOG_PER_SCOUT);
  const h = Math.max(1, Math.ceil(fog / 3));

  const tile = (p) => {
    // Kalite kademesi SABİT skala (kulüp renginden bağımsız — her kariyerde aynı dil):
    // 75+ altın (elit) · 60+ yeşil (iyi) · 45+ mavi (orta) · altı gri (zayıf)
    const tier = p.overall >= 75 ? 't1' : p.overall >= 60 ? 't2' : p.overall >= 45 ? 't3' : 't4';
    const fCol = p.form >= 62 ? 'var(--pos)' : p.form >= 45 ? 'var(--warn)' : 'var(--neg)';
    const kCol = p.fitness >= 85 ? 'var(--pos)' : p.fitness >= 65 ? 'var(--warn)' : 'var(--neg)';
    const mCol = p.morale >= 55 ? 'var(--pos)' : p.morale >= 40 ? 'var(--warn)' : 'var(--neg)';
    const tags = [
      p.id === G.captainId ? '<span class="kad-tag c" data-tip="Kaptan">C</span>' : '',
      p.isStar ? '<span class="kad-tag s" data-tip="Takımın yıldızı">★ YILDIZ</span>' : '',
      p.age <= 21 ? '<span class="kad-tag g" data-tip="21 yaş altı — gelişime açık">GENÇ</span>' : '',
      p.injuryWeeks > 0 ? `<span class="kad-tag i" data-tip="Sakat — ${p.injuryWeeks} hafta yok">🩹 ${p.injuryWeeks} HAFTA</span>` : '',
      p.suspensionWeeks > 0 ? `<span class="kad-tag i" data-tip="Cezalı">🟥 ${p.suspensionWeeks} HAFTA</span>` : '',
    ].filter(Boolean).join('');
    return `<div class="kad-tile kad-click ${tier} ${p.injuryWeeks > 0 ? 'sakat' : ''} ${p.vitrin ? 'vitrinli' : ''}" style="--pc:${POS_COL[p.pos]}" data-act="pcard" data-arg="${p.id}" data-tip="Oyuncu kartını aç">
      <div class="kad-rate" data-tip="Güç ${p.overall - h}–${p.overall + h} (gözlem netliği ±${h})"><b>${p.overall}</b><i>±${h}</i></div>
      <span class="kad-ava">${playerAvatar(p, 34)}</span>
      <div class="kad-mid">
        <div class="kad-nm">${esc(p.name || '—')}</div>
        <div class="kad-tags"><span class="kad-age">${p.age} yaş</span>${tags}</div>
        <div class="kad-meters">
          ${meter('FORM', `Form: ${formWord(p.form)}`, p.form, fCol)}
          ${meter('KND', `Kondisyon: ${kondWord(p.fitness)}`, p.fitness, kCol)}
          ${meter('MRL', `Moral: ${moralWord(p.morale)}`, p.morale, mCol)}
        </div>
      </div>
      <div class="kad-side">
        <span class="f"><i>DEĞER</i><b>${fmt(p.marketValue)}mn</b></span>
        <span class="f"><i>MAAŞ</i><b>${fmt(p.wage)}mn</b></span>
        ${p.loanIn
      ? '<span class="kad-vit" style="opacity:.55;cursor:default;text-align:center" data-tip="Kiralık oyuncu — sezon sonu asıl kulübüne döner, satılamaz">🔒 KİRALIK</span>'
      : `<button class="kad-vit ${p.vitrin ? 'on' : ''}" data-act="vitrin" data-arg="${p.id}" data-tip="${p.vitrin ? 'Satış listesinden geri çek' : 'Satış listesine çıkar — kulüpler teklifle gelir'}">${p.vitrin ? '🏷 SATIŞTA ↩' : 'SATIŞA ÇIKAR'}</button>`}
      </div>
    </div>`;
  };

  const groups = ['GK', 'DEF', 'MID', 'FWD'].map((pos) => {
    const list = G.squad.filter((p) => p.pos === pos).sort((a, b) => b.overall - a.overall);
    if (!list.length) return '';
    return `<section class="kad-grp" style="--pc:${POS_COL[pos]}">
      <header class="kad-grp-head"><span class="kad-grp-nm">${POS_GRUP[pos]}</span><span class="kad-grp-n">${list.length} oyuncu</span></header>
      <div class="kad-tiles">${list.map(tile).join('')}</div>
    </section>`;
  }).join('');

  // TD BANDI — tam genişlik FM tarzı staff şeridi: kim olduğu, profili (TAM cümle),
  // seninle ilişkisi + otoritesi (geniş metre + kelime), maaşı, kovma bedeli.
  // Hücreler etiketli — hiçbir bilgi kırpılmaz, sayı sızmaz (bar+kelime).
  const rel = G.tdRelation ?? 70;
  const relCol = rel >= 65 ? 'var(--pos)' : rel >= 40 ? 'var(--warn)' : 'var(--neg)';
  const oto = G.coach.otorite;
  const otoWord = oto == null ? null : oto >= 74 ? 'sözü geçer' : oto >= 56 ? 'dengeli' : 'tartışılır';
  const tdCard = `<div class="kad-td">
    <div class="kad-td-kim">
      <div class="kad-td-ava">${esc((G.coach.name || 'T')[0])}</div>
      <div class="kad-td-kim-yazi">
        <b>${esc(G.coach.name)}</b>
        <span class="kad-td-rol">TEKNİK DİREKTÖR</span>
      </div>
    </div>
    <div class="kad-td-cell kad-td-profil">
      <i>PROFİL</i>
      <span>${esc(coachDescribe(G.coach))}. Takımı sahada o yönetir — maç planı ve kadro onun işi; sen telkin verirsin, o tartar.</span>
    </div>
    <div class="kad-td-cell" data-tip="Bozulursa telkinlerini geri çevirir, ipler gerilir">
      <i>SENİNLE İLİŞKİSİ</i>
      <span class="kad-td-mtr"><span class="tr"><b style="width:${Math.round(rel)}%;background:${relCol}"></b></span><b class="kad-td-word" style="color:${relCol}">${relWord(G.tdRelation)}</b></span>
    </div>
    ${oto != null ? `<div class="kad-td-cell" data-tip="Otoritesi yüksekse soyunma odası onu dinler; mantıksız telkini reddedebilir">
      <i>OTORİTE</i>
      <span class="kad-td-mtr"><span class="tr"><b style="width:${Math.round(oto)}%;background:var(--info)"></b></span><b class="kad-td-word" style="color:var(--info)">${otoWord}</b></span>
    </div>` : ''}
    ${G.coach.wage ? `<div class="kad-td-cell"><i>MAAŞ</i><span class="kad-td-maas"><b>${fmt(G.coach.wage)}mn</b>/sezon</span></div>` : ''}
    <div class="kad-td-act">
      ${G.coachSearch
    ? '<span class="badge">aday süreci inbox\'ta</span>'
    : `<button class="cx-btn kad-kov" data-act="fireCoach">TD'yi Kov</button>
       <span class="kad-td-uyari">bedeli: tazminat + medya fırtınası + taraftar tepkisi</span>`}
    </div>
  </div>`;

  return `<div class="kadro-wrap">
    <div class="kad-head">
      <div class="kad-title">
        <div class="overline">Kadro · ${G.squad.length} oyuncu · Toplam değer ${fmt(G.club.kadroDeger)}mn · <span data-tip="Gözlemci ağın güçlendikçe oyuncu güçleri netleşir">gözlem ±${h}</span></div>
        <h2>Takım</h2>
      </div>
    </div>
    ${tdCard}
    <div class="kad-board">${groups}</div>
  </div>`;
}
