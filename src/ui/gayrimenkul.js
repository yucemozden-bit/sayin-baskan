// ── GAYRİMENKUL OFİSİ — kendi nav ekranı (sol menüden açılır). Ayrı ofis cüzdanı + portföy + CANLI GÖMÜLÜ 3D portal. ──
import { fmt } from './frame.js';
import { TUNING } from '../config.js';
import { sbShell } from './cockpit.js';

// Portal takvimi = mutlak oyun haftası (hazırlık DAHİL) — main.js gmGameHafta ile aynı formül (modüller arası çoğaltma).
function gameHafta(G) {
  const spt = TUNING.SEASONS_PER_TERM || 3, sw = TUNING.SEASON_WEEKS || 34, pw = TUNING.PRESEASON_WEEKS || 0;
  const absSezon = ((G.meta?.term || 1) - 1) * spt + (G.meta?.season || 1);
  const haz = G.hazirlik || 0;
  const icHafta = haz > 0 ? (pw - haz) : (pw + ((G.meta?.week || 1) - 1));
  return (absSezon - 1) * (pw + sw) + icHafta + 1;
}

export function render(G) {
  const gm = G.gayrimenkul || { deger: 0, kira: 0, adet: 0, nakit: 0 };
  const nakit = Math.round(gm.nakit || 0);
  const kasa = Math.round(G.economy.kasa || 0);
  const pct0 = 0.5;
  const varTransfer = kasa > 0.5 || nakit > 0;
  const isk = Math.round((TUNING.ECONOMY.GAYRIMENKUL?.SATIS_ISKONTO ?? 0.05) * 100);
  const ih = TUNING.ECONOMY.GAYRIMENKUL?.INSAAT_HAFTA ?? 12;
  const src = `assets/arsa_yatirimi_7.html?kasa=${nakit}&ih=${ih}&hafta=${gameHafta(G)}`;

  const kart = (k, v, n, pos, id) => `<div class="tr-panel gms-card">
    <span class="gms-k">${k}</span><b class="gms-v${pos ? ' pos' : ''}"${id ? ` id="${id}"` : ''}>${fmt(v)}mn</b><span class="gms-n">${n}</span>
  </div>`;

  const transfer = varTransfer ? `<div class="gm-slider-mod" data-kasa="${kasa}" data-nakit="${nakit}">
    <div class="gm-slider-head"><span class="gm-slider-t">Aktarım oranı</span><span class="gm-slider-pct"><b id="gm-pct-lbl">50</b><span class="gm-pctu">%</span></span></div>
    <div class="gm-slider-row">
      <button class="gm-step" type="button" onclick="SBgmStep(-5)" data-tip="−%5" aria-label="azalt">−</button>
      <input id="gm-pct" class="gm-range" type="range" min="0" max="100" step="1" value="50" style="--gm-fill:50%" data-kasa="${kasa}" data-nakit="${nakit}" oninput="SBgmPrev()" aria-label="aktarım yüzdesi">
      <button class="gm-step" type="button" onclick="SBgmStep(5)" data-tip="+%5" aria-label="artır">+</button>
    </div>
    <div class="gm-slider-btns">
      <button class="cx-btn gm-yat${kasa > 0.5 ? '' : ' gm-off'}" data-act="gmYatir"${kasa > 0.5 ? '' : ' disabled'} data-tip="Slider'daki yüzde kadar kulüp kasasından ofise aktar">▲ Yatır <b id="gm-yat-p">${fmt(Math.round(kasa * pct0))}</b>mn</button>
      <button class="cx-btn gm-cek${nakit > 0 ? '' : ' gm-off'}" data-act="gmCek"${nakit > 0 ? '' : ' disabled'} data-tip="Slider'daki yüzde kadar ofis nakitini kulübe çek">▼ Çek <b id="gm-cek-p">${fmt(Math.round(nakit * pct0))}</b>mn</button>
    </div>
  </div>` : '<p class="gms-uyari">Kasan boş — para gelince buradan ofise aktarabilirsin.</p>';

  // Sağ sütun: CANLI 3D portal (tam ekran overlay açıkken çakışmasın diye yer tutucu gösterilir).
  const sahne = G._gayrimenkul
    ? '<div class="gms-3d gms-3d-ph"><span>🖥️ Ofis tam ekranda açık</span></div>'
    : `<div class="gms-3d"><iframe class="gms-3d-frame" src="${src}" title="Gayrimenkul 3D" scrolling="no"></iframe>
        <button class="gms-tamekran" data-act="gayrimenkulAc" data-tip="Tam ekran aç (döndür, yakınlaş, al-sat)">⛶ Tam Ekran</button></div>`;

  const body = `<div class="gms-root">
    <div class="gms-cards">
      ${kart('Kulüp Kasası', kasa, 'Yatır ile ofise aktarabilirsin', false, 'gms-kasa')}
      ${kart('Ofis Nakiti', nakit, 'Çek ile kulübe geri alabilirsin', nakit > 0, 'gms-nakit')}
      ${kart('Portföy Değeri', gm.deger, gm.adet ? `${gm.adet} mülk · kira ${fmt(gm.kira)}mn/hafta · vergiden MUAF` : 'Henüz mülkün yok · vergiden MUAF', true, 'gms-deger')}
    </div>
    <div class="gms-main">
      <div class="gms-left">
        <div class="tr-panel gms-islem">
          <div class="cx-panel-head"><span class="overline">Ofis · Para Aktarımı</span><span class="cx-hint" data-tip="Ofis, kulüp kasasından AYRI bir cüzdanla çalışır.">ayrı cüzdan</span></div>
          ${transfer}
          ${gm.deger > 0 ? `<button class="cx-btn gms-sat" data-act="gayrimenkulSat" data-tip="Tüm portföyü + ofis nakitini nakde çevir, kulübe aktar — %${isk} likidite iskontosu">Portföyü Sat → Kulübe</button>` : ''}
        </div>
        <div class="tr-panel gms-bilgi">
          <ul class="gms-list">
            <li><b>Ayrı cüzdan:</b> ofis nakiti maç sonucundan/kulüp kasasından bağımsız; alım, satım, kira ve aktarımla değişir.</li>
            <li><b>Arsa</b> değerlenir (kirasız) · <b>bina</b> kiraya verilir/satılır.</li>
            <li><b>Kira HER HAFTA</b> ofis nakitine akar; emlak vergisi sezon sonunda kesilir. <b>Mülk</b> servet vergisinden muaftır.</li>
          </ul>
        </div>
      </div>
      ${sahne}
    </div>
  </div>`;

  const crumb = `GAYRİMENKUL · KASA ${fmt(kasa)}MN · OFİS ${fmt(nakit)}MN · PORTFÖY ${fmt(gm.deger)}MN`;
  return sbShell(G, { crumb, title: 'Gayrimenkul Ofisi', body });
}
