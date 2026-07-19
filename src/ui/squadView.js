// src/ui/squadView.js — KADRO (sb- görsel katman): 4 mevki kolonu, her oyuncu DETAYLI kart —
// güç±, avatar, isim/yaş, DEĞER/MAAŞ, FORM/KND/MRL metreleri + "Detay" butonu (→ 3D oyuncu kartı,
// satış/kiralık/sözleşme orada). Üstte TD şeridi (ilişki + otorite barları + maaş + TD'yi Kov).
import { TUNING } from '../config.js';
import { esc, fmt } from './frame.js';
import { coachDescribe, relWord } from '../actions.js';
import { atakSavunma } from '../engines/power.js';
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
      // Katılım kaynağı: ALTYAPI (ocak çocuğu — rozet 23 yaşına kadar; iz p.ocak'ta kalıcı,
      // kullanıcı bulgusu: 28'lik oyuncuda "altyapıdan çıktı" gibi okunuyordu) veya YENİ (taze transfer)
      const kaynak = (p.ocak && p.age <= 23) ? ' <span class="kad-c-ocak" title="Altyapıdan yetişti">ALTYAPI</span>'
        : (p.yeniHafta > 0 ? ' <span class="kad-c-yeni" title="Yeni transfer — 3 hafta sonra kalkar">YENİ</span>' : '');
      const tags = `${p.id === G.captainId ? ' <b class="kad-c-c" title="Kaptan">C</b>' : ''}${p.isStar ? ' <b class="kad-c-star">★</b>' : ''}${kaynak}${p.age <= 21 ? ' <span class="kad-c-genc">GENÇ</span>' : ''}${p.injuryWeeks > 0 ? ' 🩹' : ''}${p.suspensionWeeks > 0 ? ' 🟥' : ''}${p.vitrin ? ' 🏷' : ''}${p.kiralikListe ? ' ↔' : ''}${p.loanIn ? ' 🔒' : ''}`;
      const durum = p.vitrin ? '<b class="kad-c-dur sat">SATIŞTA</b> · ' : p.kiralikListe ? '<b class="kad-c-dur kir">KİRALIK L.</b> · ' : p.loanIn ? '<b class="kad-c-dur loan">KİRALIK</b> · ' : '';
      const durCls = `${p.vitrin ? ' is-vitrin' : ''}${p.kiralikListe ? ' is-kiralik' : ''}${p.loanIn ? ' is-loan' : ''}`;
      return `<div class="kad-c${durCls}" data-act="pcard" data-arg="${p.id}" data-tip="${p.vitrin ? 'SATIŞ LİSTESİNDE — teklifler telefonla gelir · ' : p.kiralikListe ? 'KİRALIK LİSTESİNDE · ' : ''}Detay: güç · form · değer · sözleşme · satış/kiralık/yenile">
        <span class="kad-c-ov ${ovCls(p.overall)}">${p.overall}<i>±${h}</i>${p.okYon ? `<em class="kad-ok ${p.okYon}" data-tip="${p.okYon === 'up' ? 'Güç ARTTI — oynadıkça/kazandıkça sezon içi gelişim' : 'Güç DÜŞTÜ — yaş ve kötü gidişatın faturası'}">${p.okYon === 'up' ? '▲' : '▼'}</em>` : ''}</span>
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

  // ── TAKIM NABZI: kadronun genel morali/formu/kondisyonu tek şeritte (kullanıcı isteği) ──
  const ort = (f) => (G.squad.length ? G.squad.reduce((a, p) => a + (f(p) ?? 50), 0) / G.squad.length : 50);
  const nMoral = Math.round(ort((p) => p.morale));
  const nForm = Math.round(ort((p) => p.form));
  const nKond = Math.round(ort((p) => p.fitness));
  const nGuven = Math.round(ort((p) => p.baskanaGuven));
  const nKimya = Math.round(G.kimya?.kimya ?? 50);
  const sakatlar = G.squad.filter((p) => (p.injuryWeeks || 0) > 0).length;
  const kelime = (v, iyi, orta, kotu) => (v >= 66 ? iyi : v >= 45 ? orta : kotu);
  const renk = (v) => (v >= 66 ? 'var(--pos)' : v >= 45 ? 'var(--club-2)' : 'var(--neg)');
  const nb = (ad, v, soz, tip) => `<div class="kad-nb" data-tip="${tip}">
      <i>${ad}</i><span class="kad-td-bar"><u style="width:${Math.max(3, v)}%;background:${renk(v)}"></u></span><b style="color:${renk(v)}">${soz} · ${v}</b>
    </div>`;
  const nabiz = `<div class="sb-panel kad-nabiz">
    ${nb('GENEL MORAL', nMoral, kelime(nMoral, 'COŞKULU', 'DALGALI', 'DİPTE'), 'Kadro moral ortalaması — sonuçlar, primler ve jestlerle oynar; maç gücüne işler')}
    ${nb('GENEL FORM', nForm, kelime(nForm, 'FORMDA', 'DALGALI', 'DÜŞÜK'), 'Kadro form ortalaması — oynadıkça ve kazandıkça açılır')}
    ${nb('KONDİSYON', nKond, kelime(nKond, 'ZİNDE', 'NORMAL', 'YORGUN'), 'Fiziksel hazırlık — tam kadro baskısı yorar, rotasyon dinlendirir')}
    ${nb('KİMYA', nKimya, kelime(nKimya, 'OTURMUŞ', 'KARIŞIK', 'DAĞINIK'), `Takım uyumu — her transfer sarsar (${TUNING.KIMYA_TRANSFER}); birlikte oynadıkça oturur (+0.1/maç), galibiyet hızlandırır (+0.5); prim izli galibiyet +1`)}
    ${nb('BAŞKANA GÜVEN', nGuven, kelime(nGuven, 'ARKANDA', 'KARARSIZ', 'SOĞUK'), 'Soyunma odasının sana bakışı — jestler, sözler ve kriz sofraları yazar')}
    ${yonHucre(G)}
    <div class="kad-nb kad-nb-revir" data-tip="${sakatlar ? 'Revirdeki oyuncu sayısı — tıbbi merkez süreleri kısaltır' : 'Revir boş — kadro tam'}">
      <i>REVİR</i><b style="color:${sakatlar ? 'var(--warn)' : 'var(--pos)'}">${sakatlar ? sakatlar + ' sakat' : 'boş ✓'}</b>
    </div>
    ${(G.magSeri || 0) >= 2 ? '<button class="kad-nb-moral" data-act="nav" data-arg="ozel" data-tip="Üst üste mağlubiyet — Takım Moral Gecesi düzenlenebilir (Özel Hayat · ₺2mn kişisel)">🍖 Moral Gecesi açık ▸</button>' : ''}
  </div>`;

  return sonuc(G, tdBand, nabiz, cols, h);
}

// KADRO YÖNÜ hücresi: hücum/savunma hat dengesi maçların açıklığını belirler (power.atakSavunma
// ile AYNI kaynak) — transferin BÖLGESİ burada anlam kazanır: forvet alırsan gol patlar,
// stoper/kaleci alırsan kapanırsın.
function yonHucre(G) {
  const y = atakSavunma(G.squad);
  const fark = y.atak - y.savunma;
  const soz = fark >= 2.5 ? 'HÜCUMA DÖNÜK' : fark <= -2.5 ? 'SAVUNMACI' : 'DENGELİ';
  const renk = fark >= 2.5 ? 'var(--neg)' : fark <= -2.5 ? 'var(--info)' : 'var(--pos)';
  return `<div class="kad-nb" data-tip="Hücum hattı ${Math.round(y.atak)} (OS+FV) · Savunma hattı ${Math.round(y.savunma)} (KL+DF) — savunmacı kadro KAPALI maç oynar (az gol yer, az atar), hücumcu kadro AÇIK maç (çok atar, biraz açık verir). Transferin bölgesi bunu şekillendirir.">
    <i>KADRO YÖNÜ</i><b style="color:${renk}">${soz} · H${Math.round(y.atak)}/S${Math.round(y.savunma)}</b>
  </div>`;
}

function sonuc(G, tdBand, nabiz, cols, h) {
  const yasOrt = (G.squad.reduce((a, p) => a + p.age, 0) / Math.max(G.squad.length, 1)).toFixed(1).replace('.', ',');
  const toplamDeger = fmt(Math.round(G.squad.reduce((a, p) => a + (p.marketValue || 0), 0)));
  return sbShell(G, {
    crumb: `KADRO · ${G.squad.length} OYUNCU · TOPLAM DEĞER ${toplamDeger}MN · YAŞ ORT. ${yasOrt} · GÖZLEM ±${h}`,
    title: 'Takım Kadrosu',
    body: `${tdBand}${nabiz}<div class="sb-kad-grid kad-grid-cards">${cols}</div>`,
  });
}
