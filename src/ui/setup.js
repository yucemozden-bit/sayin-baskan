// src/ui/setup.js — KARİYER KURULUŞU (yol haritasındaki "setup" ekranı):
// başkan adı · kulüp adı · kulüp rengi · şehir · zorluk. Kulüp seçiminden sonra,
// mühür masaya inmeden önceki son adım. Bare sahne (topbar yok — kariyer henüz başlamadı).
import { esc } from './frame.js';
import { clubPalette } from './theme.js';

export const RENKLER = ['#D4A940', '#C0392B', '#2E86C1', '#27AE60', '#8E44AD', '#E67E22', '#16A085', '#AD1457'];
const ZORLUK = [
  { k: 'kolay', ad: 'Kolay', tip: 'Şans senden yana, sis az, kongre eşiği %50. İlk kariyere uygun.' },
  { k: 'normal', ad: 'Normal', tip: 'Tasarlanan deneyim — dengeli şans, eşik %55.' },
  { k: 'zor', ad: 'Zor', tip: 'Faiz ağır, sis kalın, kongre eşiği %58. Rakipler agresif.' },
  { k: 'efsane', ad: 'Efsane', tip: 'Her şey sana karşı. Eşik %60 — efsaneler burada yazılır.' },
];

export function render(G) {
  const s = G._setup || {};
  const id = s.identity || {};
  const varsayilanAd = id.name || { kucuk: 'Gölköy SK', orta: 'Yıldızspor', buyuk: 'Ezeli FK', lig2: 'Demiryolu SK' }[s.tier] || 'Kulübüm';
  const seciliRenk = s.renk || (id.renk ? clubPalette(id.renk).club : RENKLER[0]);
  const zorluk = s.zorluk || 'normal';
  const swatches = [...new Set([id.renk, ...RENKLER].filter(Boolean))].slice(0, 9).map((r) => {
    const p = clubPalette(r).club;
    return `<button class="setup-renk ${seciliRenk === r || seciliRenk === p ? 'on' : ''}" data-act="setupRenk" data-arg="${r}" style="--sw:${p}" aria-label="Renk ${r}"></button>`;
  }).join('');
  const zBtns = ZORLUK.map((z) => `<button class="cx-btn ${zorluk === z.k ? 'on' : ''}" data-act="setupZorluk" data-arg="${z.k}" data-tip="${esc(z.tip)}">${z.ad}</button>`).join('');
  return `<div class="scene setup-sahne">
    <div class="overline">Devir Teslim · Kuruluş</div>
    <h1 style="margin:6px 0 2px">Masaya Otur</h1>
    <p class="muted" style="margin:0 0 14px;font-style:italic">Tabelaya adın yazılmadan mühür basılmaz.</p>
    <div class="setup-grid">
      <div class="card setup-card">
        <div class="overline">Başkan</div>
        <label class="setup-lbl">Adın <input id="su-baskan" class="setup-inp" type="text" maxlength="26" placeholder="örn. Yücem Özden" value="${esc(s.baskanAd || '')}"></label>
        <div class="overline" style="margin-top:12px">Zorluk <span class="muted" style="font-size:10px">(kariyer boyunca kilitli)</span></div>
        <div class="btnrow" style="margin-top:6px">${zBtns}</div>
      </div>
      <div class="card setup-card">
        <div class="overline">Kulüp</div>
        <label class="setup-lbl">Kulüp adı <input id="su-kulup" class="setup-inp" type="text" maxlength="28" placeholder="${esc(varsayilanAd)}" value="${esc(s.kulupAd || '')}"></label>
        <label class="setup-lbl">Şehir <input id="su-sehir" class="setup-inp" type="text" maxlength="24" placeholder="örn. İzmir" value="${esc(s.sehir || '')}"></label>
        <div class="overline" style="margin-top:12px">Kulüp rengi</div>
        <div class="setup-renkler">${swatches}</div>
        <div class="setup-onizle" style="--sw:${clubPalette(seciliRenk).club}">
          <span class="setup-arma">${esc((s.kulupAd || varsayilanAd)[0] || 'K')}</span>
          <b>${esc(s.kulupAd || varsayilanAd)}</b>
          ${id.stadName ? `<i class="muted">${esc(id.stadName)} · ${id.founded || ''}</i>` : ''}
        </div>
      </div>
    </div>
    <div class="btnrow" style="justify-content:center;margin-top:16px;gap:10px">
      <button class="btn" data-act="setupGeri">← Kulüp seçimine dön</button>
      <button class="devam pulse" data-act="setupStart" style="padding:12px 34px">Kariyeri Başlat ►</button>
    </div>
    <div class="muted" style="font-size:11px;margin-top:8px;text-align:center">Boş bıraktığını varsayılanlar doldurur — isim şart değil, mühür şart.</div>
  </div>`;
}
