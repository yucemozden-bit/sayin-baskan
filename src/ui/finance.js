// src/ui/finance.js — MALİ MERKEZ v2: tam ekran 3 kolonlu pano, kaydırma yok.
// Nakit akışı BARLI grafik (gelir yeşil / gider kırmızı / NET LED), FFP şeridi,
// primler, borç masası. Panel dili tr-panel (3B yüzey) ile ortak.
import { fmt, esc } from './frame.js';
import { sponsorOffers } from '../actions.js';

export function render(G) {
  const e = G.economy;
  const led = G.lastLedger;
  // A1: CFO projeksiyon SİSİ — rakamlar CFO kalitesine göre ±sapmalı (oyuncu sisli veriyle karar verir)
  const w = G.cfoWobble || 0;
  const cfo = G.staff && G.staff.cfo;
  const guvenilirlik = !cfo ? 'CFO yok — projeksiyon GÜVENİLMEZ (±%15\'e kadar)' : cfo.skill >= 72 ? `${cfo.name}: projeksiyon sağlam` : `${cfo.name}: projeksiyonda sapma payı var`;
  const g = led ? { ...led.gelir, bilet: led.gelir.bilet * (1 + w), yayin: led.gelir.yayin * (1 + w), sponsor: led.gelir.sponsor * (1 + w), forma: led.gelir.forma * (1 + w), uyelik: led.gelir.uyelik * (1 + w), toplam: led.gelir.toplam * (1 + w) } : null;
  const gi = led ? { ...led.gider, toplam: led.gider.toplam * (1 - w * 0.5) } : null;

  // ── Bilet fiyatı ──
  const price = e.ticketPrice;
  const priceBtns = [0.6, 0.8, 1.0, 1.2, 1.6].map((p) =>
    `<button class="cx-btn ${Math.abs(price - p) < 0.001 ? 'on' : ''}" data-act="setTicket" data-arg="${p}">${p.toFixed(1)}×</button>`).join('');
  const biletPanel = `<div class="tr-panel">
    <div class="cx-panel-head"><span class="overline">Bilet Fiyatı</span><span class="cx-hint">çarpan</span></div>
    <div class="cx-seg" style="margin-top:2px">${priceBtns}</div>
    <div class="tr-not">Ucuz = dolu tribün, az gelir · Pahalı = boş koltuk, çok gelir. Taraftar algısı sosyal nabza yansır.</div>
  </div>`;

  // ── Nakit akışı: BARLI grafik ──
  let akisPanel;
  if (led) {
    const rows = [
      ['Bilet', g.bilet, 1], ['Yayın', g.yayin, 1], ['Sponsor', g.sponsor, 1], ['Forma + Üyelik', g.forma + g.uyelik, 1],
      ['Maaş', gi.maas, 0], ['Faiz', gi.faiz, 0], ['Bakım + İdari + Teknik', gi.bakim + gi.idari + gi.teknik, 0],
    ];
    const maxV = Math.max(...rows.map((r) => r[1]), 0.1);
    const satir = (ad, v, gelir) => `<div class="fin-satir">
      <span class="fin-ad">${ad}</span>
      <span class="fin-bar"><i style="width:${Math.max(3, Math.round((v / maxV) * 100))}%;background:${gelir ? 'var(--pos)' : 'var(--neg)'}"></i></span>
      <b class="tnum">${fmt(v)}</b>
    </div>`;
    const net = g.toplam - gi.toplam;
    akisPanel = `<div class="tr-panel fin-akis">
      <div class="cx-panel-head"><span class="overline">Haftalık Nakit Akışı</span><span class="cx-hint">CFO projeksiyonu</span></div>
      <div class="fin-grup pos-c">GELİR · ${fmt(g.toplam)}mn</div>
      ${rows.slice(0, 4).map((r) => satir(r[0], r[1], 1)).join('')}
      <div class="fin-grup neg-c">GİDER · ${fmt(gi.toplam)}mn</div>
      ${rows.slice(4).map((r) => satir(r[0], r[1], 0)).join('')}
      <div class="fin-net"><i>NET / HAFTA</i><b class="led" style="color:${net >= 0 ? 'var(--pos)' : 'var(--neg)'}">${net >= 0 ? '+' : ''}${fmt(net)}<span>mn</span></b></div>
      <div class="tr-not">⚠ ${guvenilirlik}</div>
    </div>`;
  } else {
    akisPanel = `<div class="tr-panel fin-akis">
      <div class="cx-panel-head"><span class="overline">Haftalık Nakit Akışı</span><span class="cx-hint">CFO projeksiyonu</span></div>
      <div class="bos-durum"><div class="iko">📊</div><div class="cml">İlk maçtan sonra rakamlar burada barlarla akacak.</div></div>
    </div>`;
  }

  // ── FFP ──
  const ffp = G.ffp || { limit: 0, spent: 0 };
  const fPct = ffp.limit ? Math.min(120, Math.round((ffp.spent / ffp.limit) * 100)) : 0;
  const fColor = fPct >= 100 ? 'var(--neg)' : fPct >= 90 ? 'var(--warn)' : 'var(--pos)';
  const ffpPanel = `<div class="tr-panel">
    <div class="cx-panel-head"><span class="overline">Harcama Limiti · FFP</span>${ffp.taahhut ? '<span class="badge" style="background:var(--neg);color:#fff">TAAHHÜTNAME</span>' : ''}</div>
    <div class="tr-cells" style="margin-top:0">
      <span class="tr-cell"><i>FEDERASYON TAVANI</i><b>${fmt(ffp.limit)}mn</b></span>
      <span class="tr-cell"><i>HARCANAN</i><b>${fmt(ffp.spent)}mn</b></span>
    </div>
    <div class="tr-butce-bar" style="margin-top:10px"><div style="width:${Math.min(100, fPct)}%;background:${fColor}"></div></div>
    ${ffp.cutActive ? '<div class="tr-not" style="color:var(--warn);border:0;padding-top:6px">Bu sezon gelirlerden taahhüt kesintisi düşülüyor (−%5).</div>' : ''}
    <div class="cx-seg"><button class="cx-btn" data-act="ffpLobi" ${ffp.lobiUsed || (G.club.reputation <= 60) ? 'disabled' : ''} data-tip="İtibar>60 gerekir · %40 şans · başarıda tavan +%10">Federasyona lobi yap</button></div>
  </div>`;

  // ── Primler ──
  const pl = G.primLedger || {};
  const primPanel = `<div class="tr-panel">
    <div class="cx-panel-head"><span class="overline">Prim Defteri</span><span class="cx-hint">bu sezon</span></div>
    <div class="tr-cells" style="margin-top:0">
      <span class="tr-cell"><i>MAÇ PRİMLERİ</i><b>${fmt(pl.mac || 0)}mn</b></span>
      <span class="tr-cell"><i>SERİ PRİMLERİ</i><b>${fmt(pl.seri || 0)}mn</b></span>
      <span class="tr-cell"><i>ÖZEL MAÇ</i><b>${fmt(pl.ozel || 0)}mn</b></span>
      <span class="tr-cell"><i>SEZON HEDEFİ</i><b>${fmt(pl.sezon || 0)}mn</b></span>
    </div>
    <div class="cx-seg">
      <button class="cx-btn ${G.seriPrim ? 'on' : ''}" data-act="seriPrim">Seri Primi ${G.seriPrim ? 'AÇIK' : 'kapalı'}</button>
      <button class="cx-btn ${G.sezonHedefDeclared ? 'on' : ''}" data-act="sezonPrim" ${G.sezonHedefDeclared || G.meta.week > 2 ? 'disabled' : ''}>${G.sezonHedefDeclared ? 'Sezon Hedefi İLAN EDİLDİ' : 'Sezon Hedefi ilan et (hafta 1-2)'}</button>
    </div>
    <div class="tr-not">Seri: 3 galibiyet üstüne ekstra. Sezon hedefi: tüm sezona moral tabanı; tutmazsa küçük ceza.</div>
  </div>`;

  // ── Borç masası ──
  const aile = G.mode === 'aile';
  const borcPanel = `<div class="tr-panel">
    <div class="cx-panel-head"><span class="overline">Borç Masası</span><span class="cx-hint">faiz %${Math.round(e.faizOrani * 100)}</span></div>
    <div class="cx-seg" style="margin-top:2px">
      <button class="cx-btn" data-act="payDebt" data-arg="25" ${e.kasa < 25 || e.borc <= 0 ? 'disabled' : ''}>25mn Öde</button>
      <button class="cx-btn" data-act="payDebt" data-arg="all" ${e.kasa <= 0 || e.borc <= 0 ? 'disabled' : ''}>Tümünü Öde</button>
      <button class="cx-btn" data-act="restructure" data-tip="Faiz −%4, anapara +%5 · sezonda 1 kez" ${e.borc <= 0 || G.yapilandirmaSezon === G.meta.season || e.faizOrani <= 0.151 ? 'disabled' : ''}>${G.yapilandirmaSezon === G.meta.season ? 'Yapılandırıldı ✓' : 'Yapılandır'}</button>
    </div>
    ${aile
    ? '<div class="tr-not" style="color:var(--club-2)">Aile Kulübü: kulüp borçlanamaz — kredi yok, açıklar servetten kapanır.</div>'
    : `<div class="cx-seg" style="margin-top:6px">
      <button class="cx-btn" data-act="takeLoan" data-arg="20" data-tip="Kasaya +20mn, borç +20mn (mevcut faizle)" ${e.borc + 20 > 400 ? 'disabled' : ''}>+20mn Kredi</button>
      <button class="cx-btn" data-act="takeLoan" data-arg="50" data-tip="Kasaya +50mn, borç +50mn (mevcut faizle)" ${e.borc + 50 > 400 ? 'disabled' : ''}>+50mn Kredi</button>
    </div>
    <div class="tr-not">Ödeme kasadan düşer. Kredi kasaya nakit verir ama borç + haftalık faiz büyür. Yapılandırma faizi düşürür, anaparayı %5 artırır.</div>`}
  </div>`;

  // ── Sponsorluk (forma göğüs / stadyum ismi / forma kol) ──
  const deals = G.sponsorDeals || {};
  const SLT = { gogus: 'Forma Göğüs', naming: 'Stadyum İsmi', kol: 'Forma Kol' };
  const namingLocked = (G.facilities.stadyum || 0) < 7;
  // Tip → marka logo aksan rengi (kurumsal altın, fintech mavi, bahis kırmızı, kripto turuncu, yerel yeşil)
  const SPO_ACCENT = { standart: 'var(--club)', fintech: 'var(--info)', bahis: 'var(--neg)', kripto: 'var(--warn)', yerel: 'var(--pos)', naming: 'var(--club-2)' };
  const sezonluk = (o) => Math.round((o.annual ?? o.weekly * 52) * 10) / 10;
  const slotCell = (slot) => {
    const signed = deals[slot];
    if (signed) {
      const sv = Math.round((signed.weekly * 52) * 10) / 10;
      return `<div class="spo-slot filled">
        <div class="spo-slot-h">${SLT[slot]}<span class="spo-slot-tag on">✓ İmzalı</span></div>
        <div class="spo-card signed" style="--sc:${SPO_ACCENT[signed.type] || 'var(--club)'}">
          <div class="spo-c-top">
            <div class="spo-logo">${signed.ik || '🤝'}</div>
            <div class="spo-c-id"><div class="spo-c-nm">${esc(signed.name)}</div><div class="spo-c-sec">${esc(signed.sector)}${signed.riskProfile ? ' · riskli' : ''}</div></div>
            <div class="spo-c-val"><b>${fmt(sv)}</b><span>mn/sezon</span></div>
          </div>
          <div class="spo-c-terms">
            <span><i>Haftalık</i><b>${fmt(signed.weekly)}mn</b></span>
            <span><i>Kalan</i><b>${signed.remainingSeasons ?? signed.years} yıl</b></span>
            <span><i>Durum</i><b class="pos">Aktif</b></span>
          </div>
          <button class="spo-fesih" data-act="cancelSponsor" data-arg="${slot}" data-tip="Erken fesih AĞIR bedellidir: ceza kasadan düşer + itibar −3">Sözleşmeyi Feshet (−${fmt(signed.fesihCeza)}mn)</button>
        </div>
      </div>`;
    }
    if (slot === 'naming' && namingLocked) {
      return `<div class="spo-slot locked"><div class="spo-slot-h">${SLT[slot]}<span class="spo-slot-tag">🔒 Kilitli</span></div>
        <div class="spo-locked-box">🔒 Stadyum sv≥7 gerekir<span>Önce stadı büyüt — naming hakkı açılır.</span></div></div>`;
    }
    const offers = sponsorOffers(G, slot);
    return `<div class="spo-slot"><div class="spo-slot-h">${SLT[slot]}<span class="spo-slot-tag">${offers.length} teklif</span></div>
      ${offers.map((o) => `<div class="spo-card ${o.riskProfile ? 'risky' : ''}" style="--sc:${SPO_ACCENT[o.type] || 'var(--club)'}" data-tip="${o.note ? esc(o.note) + ' · ' : ''}Erken fesih cezası ${fmt(o.fesihCeza)}mn">
        <div class="spo-c-top">
          <div class="spo-logo">${o.ik || '🤝'}</div>
          <div class="spo-c-id"><div class="spo-c-nm">${esc(o.name)}${o.riskProfile ? ' <span class="spo-warn">⚠</span>' : ''}</div><div class="spo-c-sec">${esc(o.sektor || o.sector || '')}</div></div>
          <div class="spo-c-val"><b>${fmt(sezonluk(o))}</b><span>mn/sezon</span></div>
        </div>
        <div class="spo-c-terms">
          <span><i>Peşinat</i><b>${fmt(o.pesinat)}mn</b></span>
          <span><i>Haftalık</i><b>${fmt(o.weekly)}mn</b></span>
          <span><i>Süre</i><b>${o.years} yıl</b></span>
        </div>
        <div class="spo-c-foot">
          <span class="spo-badge ${o.dezavantaj ? 'risk' : 'clean'}">${o.dezavantaj ? '⚠ ' + esc(o.dezavantaj) : '✓ temiz anlaşma'}</span>
          <span class="spo-wait" data-tip="Teklif masada bu kadar hafta daha bekler — sonra çekilir">🕒 ${o.kalanHafta}h</span>
        </div>
        <div class="spo-c-act">
          <button class="spo-al" data-act="signSponsor" data-arg="${slot}|${o.id}">İmzala</button>
          <button class="spo-ret" data-act="rejectSponsor" data-arg="${slot}|${o.id}" data-tip="Kapıyı göster — yeni markalar sonraki haftalarda gelir">Reddet</button>
        </div>
      </div>`).join('') || '<div class="spo-empty">Masada teklif yok<span>Menajerler piyasada — yeni markalar önümüzdeki haftalarda kapıyı çalacak.</span></div>'}
    </div>`;
  };
  const sponsorPanel = `<div class="tr-panel fin-sponsor">
    <div class="cx-panel-head"><span class="overline">Sponsorluk Pazarı</span><span class="cx-hint">her kariyerde farklı markalar · peşinat kasaya · haftalık gelir</span></div>
    <div class="spo-grid">${['gogus', 'naming', 'kol'].map(slotCell).join('')}</div>
    <div class="tr-not">Teklifler bekletilirse çekilir; reddedersen piyasaya haber gider, yeni markalar sonraki haftalarda kapıyı çalar. Bahis/kripto çok getirir ama taraftar/itibar riski + kısa süre. Süre dolunca cezasız biter; erken fesih AĞIR bedellidir.</div>
    <div class="btnrow" style="margin-top:8px">
      ${G.expansion && G.expansion.officeCount >= 1
    ? '<span class="badge">🌍 Yurt dışı ofisi AÇIK — sponsor geliri +%6</span>'
    : `<button class="cx-btn" data-act="yurtOfis" ${G.economy.kasa < 25 || (G.club.reputation ?? 50) < 60 ? 'disabled' : ''} data-tip="25mn · itibar ≥60 ister. Sponsor geliri kalıcı +%6; 'Adımızı Sınırın Ötesine Taşıyacağım' sözünü tutar">🌍 Yurt Dışı Ofisi Aç · 25mn</button>`}
    </div>
  </div>`;

  return `<div class="tr-wrap fin-wrap">
    <div class="tr-head">
      <div><div class="overline">Finans · Mali Merkez</div><h2>Kulübün Kasası</h2></div>
      <div class="fin-plates">
        <span class="tesis-kasa"><i>KASA</i><b>${fmt(e.kasa)}mn</b></span>
        <span class="tesis-kasa" style="border-color:rgba(224,82,82,.35)"><i>BORÇ</i><b style="color:var(--neg)">${fmt(e.borc)}mn</b></span>
        <span class="tesis-kasa" style="border-color:var(--line)"><i>FAİZ</i><b style="color:var(--ink-1)">%${Math.round(e.faizOrani * 100)}</b></span>
      </div>
    </div>
    <div class="fin-grid">
      <div class="tr-sol">${biletPanel}${borcPanel}</div>
      ${akisPanel}
      <div class="tr-sol">${ffpPanel}${primPanel}</div>
    </div>
    ${sponsorPanel}
  </div>`;
}
