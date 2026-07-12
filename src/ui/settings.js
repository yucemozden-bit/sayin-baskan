// src/ui/settings.js — AYARLAR "Kontrol Odası" v2: 2 sütunlu 3B panolar, HER TUŞ İŞLEVSEL
// (ses testi, kontrast modu, tam ekran, kayıt aktar, veda). Boş alan yok, ekrana sığar.
import { getSound } from '../core/sound.js';
import { MODES } from '../engines/meta.js';

export const SURUM = 'v1.0-adayı';

export function render(G) {
  const s = getSound();
  const zorlukTr = { kolay: 'Kolay', normal: 'Normal', zor: 'Zor', efsane: 'Efsane' }[G.difficulty] || G.difficulty;
  const c = G.career || {};
  return `<div class="ayar-wrap">
    <div class="overline">Ayarlar</div>
    <h2 style="margin:4px 0 12px">Kontrol Odası</h2>
    <div class="ayar-grid">
      <div class="tr-panel"><div class="cx-panel-head"><span class="overline">Ses</span><span class="cx-hint">efekt + ambiyans</span></div>
        <div class="btnrow" style="margin-top:6px">
          <button class="cx-btn ${s.enabled ? 'on' : ''}" data-act="sndToggle">${s.enabled ? '🔊 Açık' : '🔇 Kapalı'}</button>
          <button class="cx-btn ${Math.abs(s.volume - 0.3) < 0.01 ? 'on' : ''}" data-act="sndVol" data-arg="0.3">Kısık</button>
          <button class="cx-btn ${Math.abs(s.volume - 0.6) < 0.01 ? 'on' : ''}" data-act="sndVol" data-arg="0.6">Normal</button>
          <button class="cx-btn ${Math.abs(s.volume - 1) < 0.01 ? 'on' : ''}" data-act="sndVol" data-arg="1">Yüksek</button>
          <button class="cx-btn" data-act="sndTest" data-tip="Mevcut ayarla örnek efekt çalar">🔔 Test</button>
        </div>
        <div class="micro" style="margin-top:8px">AMBİYANS KANALI (tribün uğultusu — efektlerden ayrı)</div>
        <div class="btnrow" style="margin-top:4px">
          <button class="cx-btn ${(s.ambience ?? .5) === 0 ? 'on' : ''}" data-act="ambVol" data-arg="0">Kapalı</button>
          <button class="cx-btn ${Math.abs((s.ambience ?? .5) - .5) < .01 ? 'on' : ''}" data-act="ambVol" data-arg="0.5">Normal</button>
          <button class="cx-btn ${Math.abs((s.ambience ?? .5) - .9) < .01 ? 'on' : ''}" data-act="ambVol" data-arg="0.9">Yüksek</button>
        </div>
      </div>
      <div class="tr-panel"><div class="cx-panel-head"><span class="overline">Görünüm</span><span class="cx-hint">okunurluk</span></div>
        <div class="btnrow" style="margin-top:6px">
          <button class="cx-btn ${G.uiKontrast ? 'on' : ''}" data-act="uiKontrast" data-tip="Panelleri aydınlatır, kenarları belirginleştirir — 'çok karanlık' diyenlere">☀ Yüksek Kontrast ${G.uiKontrast ? 'AÇIK' : 'kapalı'}</button>
          <button class="cx-btn" data-act="fullscreen" data-tip="Tam ekran aç/kapat (F11 muadili)">⛶ Tam Ekran</button>
        </div>
        <div class="tr-not">Yüksek kontrast: koyu zeminde kartlar daha açık yüzeyle ayrışır. Tercihin bu kariyerin kaydına yazılır.</div>
      </div>
      <div class="tr-panel"><div class="cx-panel-head"><span class="overline">Kariyer</span><span class="cx-hint">künye</span></div>
        <div class="fin-lines" style="margin-top:6px">
          <div class="l"><span>Zorluk (kariyer başında kilitlendi)</span><b>${zorlukTr}</b></div>
          <div class="l"><span>Koltuk modu</span><b>${(MODES[G.mode] || MODES.klasik).ad}</b></div>
          <div class="l"><span>Dönem / Sezon</span><b class="tnum">${G.meta?.term || 1} / ${c.seasons || 0}</b></div>
          ${G.mode === 'aile' ? `<div class="l"><span>Aile serveti</span><b class="tnum">${Math.round(G.servet ?? 0)}mn</b></div>` : ''}
        </div>
      </div>
      <div class="tr-panel"><div class="cx-panel-head"><span class="overline">Kayıt</span><span class="cx-hint">JSON</span></div>
        <div class="btnrow" style="margin-top:6px">
          ${G.mode === 'ironman'
      ? '<span class="muted" style="font-size:12px">🔒 Geri Adım Yok: manuel kayıt/yükleme kapalı — tek yaşam.</span>'
      : '<button class="cx-btn" data-act="save">Dışa aktar ↓</button><button class="cx-btn" data-act="load">İçe aktar ↑</button>'}
        </div>
        <div class="tr-not">Dışa aktar: kariyeri dosya olarak indir. İçe aktar: kaldığın yerden devam.</div>
      </div>
      <div class="tr-panel ayar-veda" style="grid-column:1/-1"><div class="cx-panel-head"><span class="overline" style="color:var(--neg)">Veda</span><span class="cx-hint">geri dönüşü yok</span></div>
        <div class="klub-veda-in" style="margin-top:6px">
          <span class="muted" style="font-size:12px">${G.retireArm ? 'Emin misin? Kapanış sahnesi seni bekliyor.' : 'Koltuğu kendi kararınla bırakmak da bir final.'}</span>
          <button class="cx-btn" data-act="retire" style="border-color:var(--neg);color:var(--neg)">${G.retireArm ? 'EVET, EMEKLİ OL' : 'Emekli Ol'}</button>
        </div>
      </div>
    </div>
    <div class="muted" style="font-size:11px;margin-top:12px">SAYIN BAŞKAN ${SURUM} · kayıt şeması v${G.stateVersion || 1} · ${(G.meta && G.meta.version) || ''}</div>
  </div>`;
}
