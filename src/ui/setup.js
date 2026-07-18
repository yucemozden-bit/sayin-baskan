// src/ui/setup.js — KARİYER KURULUŞU ("Masaya Otur") — sb- görsel katman (2026-07 Design uyarlaması).
// başkan adı · zorluk (+etkileri) · BAŞKAN GEÇMİŞİ (pasif) · kulüp adı/şehir/renk · ARMA STİLİ · LAKAP.
// Kulüp seçiminden sonra, mühür masaya inmeden önceki son adım. Kariyer henüz başlamadı (topbar yok).
import { esc } from './frame.js';
import { clubPalette } from './theme.js';
import { crestSvg } from './cockpit.js';

export const RENKLER = ['#D4A940', '#C0392B', '#2E86C1', '#27AE60', '#8E44AD', '#E67E22', '#16A085', '#AD1457'];
const ZORLUK = [
  { k: 'kolay', ad: 'Kolay', tip: 'Şans senden yana, sis az, kongre eşiği %50. İlk kariyere uygun.' },
  { k: 'normal', ad: 'Normal', tip: 'Tasarlanan deneyim — dengeli şans, eşik %55.' },
  { k: 'zor', ad: 'Zor', tip: 'Faiz ağır, sis kalın, kongre eşiği %58. Rakipler agresif.' },
  { k: 'efsane', ad: 'Efsane', tip: 'Her şey sana karşı. Eşik %60 — efsaneler burada yazılır.' },
];
// Zorluk etkileri — oyuncu "ne değişiyor?" sorusunu bakar bakmaz anlar (gösterim; değerler DIFFICULTY'den doğar)
const ZOR_ETKI = {
  kolay: { butce: 'Bol', rakip: 'Zayıf', sabir: 'Yüksek' },
  normal: { butce: 'Normal', rakip: 'Standart', sabir: 'Dengeli' },
  zor: { butce: 'Kısıtlı', rakip: 'Güçlü', sabir: 'Az' },
  efsane: { butce: 'Dar', rakip: 'Acımasız', sabir: 'İnce' },
};
// BAŞKAN GEÇMİŞİ — pasif yetenek (kuralları applySetup'ta bağlanır)
export const BASKAN_GECMIS = [
  { k: 'isadami', ad: 'İş İnsanı', ikon: '💼', pasif: '+ Başlangıç bütçesi', tip: 'Kasaya %20 ek sermaye ile başlarsın — ilk pencerede elin rahat.' },
  { k: 'efsane', ad: 'Efsane Futbolcu', ikon: '⚽', pasif: '+ Soyunma odası uyumu', tip: 'TD ilişkisi ve kadro morali yüksek başlar — soyunma odası sana açık.' },
  { k: 'halk', ad: 'Halk Adamı', ikon: '🎤', pasif: '+ Taraftar sabrı', tip: 'Taraftar desteği yüksek başlar — kötü sonuçlara daha sabırlı.' },
];
const ARMA_STILI = [{ k: 'kalkan', ad: 'Kalkan' }, { k: 'daire', ad: 'Daire' }, { k: 'klasik', ad: 'Klasik' }];

export function render(G) {
  const s = G._setup || {};
  const id = s.identity || {};
  const varsayilanAd = id.name || { kucuk: 'Gölköy SK', orta: 'Yıldızspor', buyuk: 'Ezeli FK', lig2: 'Demiryolu SK' }[s.tier] || 'Kulübüm';
  const kulupAd = s.kulupAd || varsayilanAd;
  const seciliRenk = s.renk || (id.renk ? clubPalette(id.renk).club : RENKLER[0]);
  const renkP = clubPalette(seciliRenk).club;
  const zorluk = s.zorluk || 'normal';
  const gecmis = s.baskanGecmisi || 'isadami';
  const arma = s.arma || 'kalkan';
  const et = ZOR_ETKI[zorluk] || ZOR_ETKI.normal;
  const geriAlma = s.mode === 'ironman' ? 'Kapalı (tek yaşam)' : 'Açık';
  const lig = s.tier === 'lig2' ? '2. Lig' : '1. Lig';

  const zBtns = ZORLUK.map((z) => `<button class="sb-seg ${zorluk === z.k ? 'is-active' : ''}" data-act="setupZorluk" data-arg="${z.k}" data-tip="${esc(z.tip)}">${z.ad}</button>`).join('');
  const swatches = [...new Set([id.renk, ...RENKLER].filter(Boolean))].slice(0, 9).map((r) => {
    const p = clubPalette(r).club;
    return `<button class="sb-swatch-pick ${seciliRenk === r || seciliRenk === p ? 'is-active' : ''}" data-act="setupRenk" data-arg="${r}" style="--sw:${p}" aria-label="Renk ${r}"></button>`;
  }).join('');
  const armaBtns = ARMA_STILI.map((a) => `<button class="sb-seg ${arma === a.k ? 'is-active' : ''}" data-act="setupArma" data-arg="${a.k}">${crestSvg(a.k, 'mini', renkP, esc(kulupAd[0] || 'K'))} ${a.ad}</button>`).join('');
  const gecmisCards = BASKAN_GECMIS.map((b) => `<button class="sb-gecmis ${gecmis === b.k ? 'is-active' : ''}" data-act="setupGecmis" data-arg="${b.k}" data-tip="${esc(b.tip)}">
      <span class="sb-gecmis-ik">${b.ikon}</span>
      <span class="sb-gecmis-ad">${b.ad}</span>
      <span class="sb-gecmis-pasif">${b.pasif}</span>
    </button>`).join('');
  const fx = (ad, v, cls = '') => `<div class="sb-diff-fx-row"><span>${ad}</span><b class="${cls}">${v}</b></div>`;

  return `<div class="sb-root sb-setup">
    <div class="sb-atmo"></div><div class="sb-vignette"></div>
    <div class="sb-setup-wrap">
      <div class="sb-kicker">DEVİR TESLİM · KURULUŞ</div>
      <h1 class="sb-setup-h1">Masaya Otur</h1>
      <p class="sb-setup-sub">Tabelaya adın yazılmadan mühür basılmaz.</p>
      <div class="sb-setup-grid">
        <div class="sb-panel">
          <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">BAŞKAN</span></div>
          <label class="sb-field"><span>Adın</span><input id="su-baskan" class="sb-input" type="text" maxlength="26" placeholder="örn. Yücem Özden" value="${esc(s.baskanAd || '')}"></label>
          <div class="sb-field-lbl">ZORLUK <span class="sb-muted">(kariyer boyunca kilitli)</span></div>
          <div class="sb-seg-row">${zBtns}</div>
          <div class="sb-diff-fx">
            ${fx('Başlangıç bütçesi', et.butce, 'sb-pos-ink')}${fx('Kurul sabrı', et.sabir, 'sb-pos-ink')}
            ${fx('Rakip gücü', et.rakip)}${fx('Kaydı geri alma', geriAlma, geriAlma[0] === 'A' ? 'sb-pos-ink' : 'sb-neg-ink')}
          </div>
          <div class="sb-field-lbl" style="margin-top:.9em">BAŞKAN GEÇMİŞİ <span class="sb-muted">(pasif yetenek)</span></div>
          <div class="sb-gecmis-grid">${gecmisCards}</div>
          <div class="sb-setup-note">ⓘ Zorluk sadece rakamları değil, kongrenin sabrını da belirler. Efsane'de tek kötü sezon koltuğu sallar.</div>
        </div>
        <div class="sb-panel">
          <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">KULÜP</span></div>
          <label class="sb-field"><span>Kulüp adı</span><input id="su-kulup" class="sb-input" type="text" maxlength="28" placeholder="${esc(varsayilanAd)}" value="${esc(s.kulupAd || '')}"></label>
          <label class="sb-field"><span>Şehir</span><input id="su-sehir" class="sb-input" type="text" maxlength="24" placeholder="örn. İzmir" value="${esc(s.sehir || '')}"></label>
          <div class="sb-field-lbl">KULÜP RENGİ</div>
          <div class="sb-swatch-row">${swatches}</div>
          <div class="sb-field-lbl">ARMA STİLİ</div>
          <div class="sb-seg-row sb-arma-row">${armaBtns}</div>
          <label class="sb-field"><span>LAKAP</span><input id="su-lakap" class="sb-input" type="text" maxlength="20" placeholder="örn. Yıldızlar" value="${esc(s.lakap || '')}"></label>
          <div class="sb-club-preview" style="--sw:${renkP}">
            ${crestSvg(arma, 'lg', renkP, esc(kulupAd[0] || 'K'))}
            <div><b>${esc(kulupAd)}</b><i>${lig}${s.lakap ? ' · ' + esc(s.lakap) : ''}${id.stadName ? ' · ' + esc(id.stadName) : ''}</i></div>
          </div>
        </div>
      </div>
      <div class="sb-setup-actions">
        <button class="sb-back" data-act="setupGeri">← Kulüp seçimine dön</button>
        <button class="sb-btn sb-btn-primary" data-act="setupStart">Kariyeri Başlat ▸</button>
      </div>
      <div class="sb-setup-foot">Boş bıraktığını varsayılanlar doldurur — isim şart değil, mühür şart.</div>
    </div>
  </div>`;
}
