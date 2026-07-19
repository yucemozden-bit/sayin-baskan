// src/ui/mainMenu.js — ANA MENÜ / BAŞLIK (sinematik giriş; 2026-07 Design uyarlaması).
// Oyunun ilk ekranı: mühür logosu + dev başlık + menü + günün ipucu. Yeni Oyun → kulüp seçimi.
import { esc } from './frame.js';

// Günün ipucu havuzu (kongre/ekonomi/medya) — kısa, oynanışa dokunan
const IPUCLARI = [
  { metin: "Kongreyi küstürme. Güven oyu %50'nin altına düşerse koltuğun sallanır — zayıf sezonun bedeli medyada patlar.", tags: ['Kongre', 'Medya'] },
  { metin: 'Verdiğin söz laf değil iş. Tutarsan tribün alkışlar, tutmazsan rakip aday sandıkta yüzüne vurur.', tags: ['Kongre', 'Transfer'] },
  { metin: 'Borcu erit, mali disiplin uçar; ama kese ağzını kapatınca tribün "iddiasız mıyız?" diye söylenir.', tags: ['Finans', 'Taraftar'] },
  { metin: 'İyi oyuncu al, güç artsın — ama teklif oyuncusunun gerçek gücü ancak imzadan sonra sahada belli olur.', tags: ['Transfer'] },
];

export function render(G) {
  const dev = G._devamVar;
  const tip = IPUCLARI[(G._menuTip || 0) % IPUCLARI.length];
  const item = (act, ad, hint = '', cls = '', dis = false) => `<button class="sb-menu-item ${cls}" data-act="${act}"${dis ? ' disabled' : ''}>
      <span class="sb-menu-bar"></span><span class="sb-menu-t">${esc(ad)}</span>${hint ? `<span class="sb-menu-hint">${esc(hint)}</span>` : ''}</button>`;
  // CANLI SAHNE: çift projektör süpürmesi + ışık hüzmesinde süzülen toz zerreleri (salt CSS,
  // index-tabanlı varyans — rand YOK; prefers-reduced-motion hepsini kapatır)
  const zerreler = Array.from({ length: 14 }, (_, i) => {
    const left = 34 + ((i * 37) % 60);                    // sağ-orta kuşak (hüzme bölgesi)
    const dur = 11 + (i % 5) * 3.2;                       // 11-24sn süzülme
    const delay = -((i * 2.9) % dur);                     // negatif gecikme: sahne dolu başlar
    const boy = 2 + (i % 3);                              // 2-4px zerre
    return `<span class="sb-mote" style="left:${left}%;width:${boy}px;height:${boy}px;animation-duration:${dur}s;animation-delay:${delay}s;--mo:${0.25 + (i % 4) * 0.12}"></span>`;
  }).join('');
  return `<div class="sb-root sb-menu-screen">
    <div class="sb-atmo"></div><div class="sb-vignette"></div><div class="sb-floodlight"></div><div class="sb-floodlight sb-floodlight-2"></div>
    <div class="sb-motes">${zerreler}</div>
    <header class="sb-menu-top">
      <span class="sb-menu-studio">STÜDYO · KOLTUK OYUNLARI</span>
      <span class="sb-spacer"></span>
      <span class="sb-menu-lang"><b class="is-active">Türkçe</b><span>English</span></span>
      <button class="sb-menu-steam" data-act="menuSteam" data-tip="Steam sayfası yakında">▸ Steam İstek Listesi</button>
    </header>
    <div class="sb-menu-wrap">
      <div class="sb-menu-logo">
        <span class="sb-seal-badge"><span class="sb-seal-ring"></span><span class="sb-seal-ring sb-seal-ring-2"></span><span class="sb-seal-letter">B</span><span class="sb-seal-year">1923</span></span>
        <span class="sb-kicker sb-menu-kicker">FUTBOL KULÜBÜ BAŞKANLIĞI SİMÜLASYONU</span>
      </div>
      <h1 class="sb-hero sb-menu-hero">SAYIN<br><span class="sb-hero-accent">BAŞKAN</span></h1>
      <p class="sb-hero-sub">Bu koltuğa oturan — <span class="sb-club-ink">şehrin kaderine imza atar.</span></p>
      <div class="sb-menu">
        ${item('menuYeni', 'Yeni Oyun', 'SANDIK SÖZÜ', 'is-active')}
        ${dev ? item('menuDevam', 'Devam Et', `${dev.club} · Sezon ${dev.season}`) : item('noop', 'Devam Et', 'kayıt yok', 'is-disabled', true)}
        ${item('menuKariyer', 'Kariyer & Rekorlar')}
        ${item('menuAyarlar', 'Ayarlar')}
        ${item('menuCikis', 'Çıkış', '', 'sb-menu-cikis')}
      </div>
    </div>
    <aside class="sb-tip-card">
      <div class="sb-tip-h"><span class="sb-tick"></span>GÜNÜN İPUCU</div>
      <p>${esc(tip.metin)}</p>
      <div class="sb-tag-row">${tip.tags.map((t) => `<span class="sb-tag">${esc(t)}</span>`).join('')}</div>
    </aside>
    <div class="sb-menu-foot"><span>v0.1 · ERKEN ERİŞİM</span><span>© 2026 Sayın Başkan</span></div>
  </div>`;
}
