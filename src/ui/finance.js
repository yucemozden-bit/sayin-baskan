// src/ui/finance.js — MALİ MERKEZ v2: tam ekran 3 kolonlu pano, kaydırma yok.
// Nakit akışı BARLI grafik (gelir yeşil / gider kırmızı / NET LED), FFP şeridi,
// primler, borç masası. Panel dili tr-panel (3B yüzey) ile ortak.
import { fmt, esc } from './frame.js';
import { sponsorOffers } from '../actions.js';
import { sbShell } from './cockpit.js';

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
  // Sade satır — tıkla → DETAY kartı açılır (tüm şart/avantaj/dezavantaj + imza/red orada)
  const slotCell = (slot) => {
    const signed = deals[slot];
    if (signed) {
      const sv = Math.round((signed.weekly * 52) * 10) / 10;
      return `<div class="spo-slot filled">
        <div class="spo-slot-h">${SLT[slot]}<span class="spo-slot-tag on">✓ İmzalı</span></div>
        <div class="spo-row signed" style="--sc:${SPO_ACCENT[signed.type] || 'var(--club)'}" data-act="spDetay" data-arg="${slot}|signed" data-tip="Anlaşma detayı + fesih">
          <span class="spo-logo-sm">${signed.ik || '🤝'}</span>
          <div class="spo-row-id"><b>${esc(signed.name)}</b><i>${esc(signed.sector)} · ${signed.remainingSeasons ?? signed.years} yıl kaldı</i></div>
          <span class="spo-row-val"><b>${fmt(sv)}</b><em>mn/sezon</em></span>
          <span class="spo-detay">Detay ›</span>
        </div>
      </div>`;
    }
    if (slot === 'naming' && namingLocked) {
      return `<div class="spo-slot locked"><div class="spo-slot-h">${SLT[slot]}<span class="spo-slot-tag">🔒 Kilitli</span></div>
        <div class="spo-locked-box">🔒 Stadyum sv≥7 gerekir<span>Önce stadı büyüt — naming hakkı açılır.</span></div></div>`;
    }
    const offers = sponsorOffers(G, slot);
    return `<div class="spo-slot"><div class="spo-slot-h">${SLT[slot]}<span class="spo-slot-tag">${offers.length} teklif</span></div>
      ${offers.map((o) => `<div class="spo-row ${o.riskProfile ? 'risky' : ''}" style="--sc:${SPO_ACCENT[o.type] || 'var(--club)'}" data-act="spDetay" data-arg="${slot}|${o.id}" data-tip="Detayları aç — avantaj/dezavantaj, şartlar, imza">
        <span class="spo-logo-sm">${o.ik || '🤝'}</span>
        <div class="spo-row-id"><b>${esc(o.name)}${o.riskProfile || o.dezavantaj ? ' <span class="spo-warn">⚠</span>' : ''}</b><i>${esc(o.sektor || o.sector || '')} · ${o.years} yıl${o.dezavantaj ? ' · ⚠ riskli' : ' · ✓ temiz'}</i></div>
        <span class="spo-row-val"><b>${fmt(sezonluk(o))}</b><em>mn/sezon</em></span>
        <span class="spo-detay">Detay ›</span>
      </div>`).join('') || '<div class="spo-empty">Masada teklif yok<span>Yeni markalar önümüzdeki haftalarda kapıyı çalacak.</span></div>'}
    </div>`;
  };
  const yurtBtn = G.expansion && G.expansion.officeCount >= 1
    ? '<span class="cx-hint" style="color:var(--pos)">🌍 Yurt dışı ofisi AÇIK · +%6</span>'
    : `<button class="cx-btn cx-btn-sm" data-act="yurtOfis" ${G.economy.kasa < 25 || (G.club.reputation ?? 50) < 60 ? 'disabled' : ''} data-tip="25mn · itibar ≥60 ister. Sponsor geliri kalıcı +%6; 'Adımızı Sınırın Ötesine Taşıyacağım' sözünü tutar">🌍 Yurt Dışı Ofisi · 25mn</button>`;
  const sponsorPanel = `<div class="tr-panel fin-sponsor">
    <div class="cx-panel-head"><span class="overline">Sponsorluk Pazarı</span><span class="cx-hint" data-tip="Peşinat kasaya · haftalık gelir · bahis/kripto çok getirir ama taraftar/itibar riski. Süre dolunca cezasız biter; erken fesih ağır bedellidir.">peşinat kasaya · haftalık gelir</span>${yurtBtn}</div>
    <div class="spo-grid">${['gogus', 'naming', 'kol'].map(slotCell).join('')}</div>
  </div>`;

  const faizPct = Math.round(e.faizOrani * 100);
  const ffpDurum = ffp.taahhut ? 'TAAHHÜT' : !ffp.limit ? 'BEKLEMEDE' : fPct >= 100 ? 'AŞILDI' : fPct >= 90 ? 'SINIRDA' : 'TAKİPTE';
  const crumb = `FİNANS · KASA ${fmt(e.kasa)}MN · BORÇ ${fmt(e.borc)}MN · FAİZ %${faizPct} · FFP ${ffpDurum}`;
  const body = `<div class="fin-root">
    <div class="fin-strip">${biletPanel}${borcPanel}${ffpPanel}${primPanel}</div>
    <div class="fin-main">${akisPanel}${sponsorPanel}</div>
  </div>`;
  return sbShell(G, { crumb, title: 'Kulübün Kasası', body });
}

// ── SPONSOR DETAY KARTI (modal): tüm şartlar + avantajlar + dezavantajlar + imza/red/fesih ──
const SP_SLT = { gogus: 'Forma Göğüs', naming: 'Stadyum İsmi', kol: 'Forma Kol' };
const SP_ACCENT = { standart: 'var(--club)', fintech: 'var(--info)', bahis: 'var(--neg)', kripto: 'var(--warn)', yerel: 'var(--pos)', naming: 'var(--club-2)' };
const SP_TIP_AD = { standart: 'Kurumsal', fintech: 'Fintech', bahis: 'Bahis', kripto: 'Kripto', yerel: 'Yerel esnaf', naming: 'İsim hakkı' };
export function renderSponsorCard(G) {
  const sc = G._spCard;
  if (!sc) return '';
  const signedDeal = (G.sponsorDeals || {})[sc.slot];
  let o, isSigned = false;
  if (sc.id === 'signed' && signedDeal) { o = signedDeal; isSigned = true; }
  else { o = (sponsorOffers(G, sc.slot) || []).find((x) => x.id === sc.id); }
  if (!o) return ''; // teklif imzalandı/reddedildi/çekildi → kart kapanır
  const annual = Math.round((o.annual ?? o.weekly * 52) * 10) / 10;
  const rp = o.riskProfile || {};
  const avant = [];
  avant.push(`Yıllık gelir <b>${fmt(annual)}mn</b> · haftalık ${fmt(o.weekly)}mn — kasaya düzenli akış`);
  if (!isSigned) avant.push(`İmza anında <b>${fmt(o.pesinat)}mn peşinat</b> doğrudan kasaya`);
  if (o.incomeMult > 1.15) avant.push(`Yüksek gelir çarpanı <b>×${o.incomeMult}</b> — sektör ortalamasının üstünde`);
  if (rp.taraftar > 0) avant.push(`Taraftar memnuniyeti <b>+${rp.taraftar}</b> — "bizim kulüp" havası`);
  if (rp.gencTaban) avant.push(`Genç taban <b>+${rp.gencTaban}</b> — dijital kampanyalar, yeni nesil`);
  if (o.years >= 3) avant.push(`Uzun vade — <b>${o.years} yıl</b> gelir garantisi`);
  const dez = [];
  if (rp.taraftar < 0) dez.push(`Taraftar <b>${rp.taraftar}</b> — ılımlı grup imajı zedeler`);
  if (rp.itibar) dez.push(`İtibar <b>${rp.itibar}</b> — kamuoyu tepkisi`);
  if (rp.batmaChance) dez.push(`<b>%${Math.round(rp.batmaChance * 100)} batma riski</b> — batarsa gelir kesilir, manşet olur`);
  dez.push(`Erken fesih cezası <b>${fmt(o.fesihCeza)}mn</b> — peşinatı aşar (imzala-boz hilesi yok)`);
  if (o.years <= 1) dez.push(`Kısa süre — yalnız <b>${o.years} yıl</b>, yenileme garantisi yok`);
  if (!dez.length) dez.push('Kayda değer bir dezavantaj yok — <b>temiz anlaşma</b>.');
  const line = (arr, cls) => arr.map((t) => `<div class="sp-li ${cls}">${cls === 'pos' ? '＋' : '－'} ${t}</div>`).join('');
  return `<div class="sp-ovl" data-act="spCardClose"><div class="sp-card" data-act="noop" style="--sc:${SP_ACCENT[o.type] || 'var(--club)'}">
    <button class="pc-close" data-act="spCardClose" aria-label="Kapat">✕</button>
    <div class="sp-head">
      <span class="sp-logo">${o.ik || '🤝'}</span>
      <div class="sp-head-id"><div class="sp-nm">${esc(o.name)}${isSigned ? ' <span class="sp-imzali">İMZALI</span>' : ''}</div><div class="sp-sub">${SP_TIP_AD[o.type] || ''} · ${esc(o.sektor || o.sector || '')} · ${SP_SLT[sc.slot]}</div></div>
      <div class="sp-val"><b>${fmt(annual)}</b><span>mn/sezon</span></div>
    </div>
    <div class="sp-terms">
      <span class="sp-cell"><i>PEŞİNAT</i><b>${fmt(o.pesinat)}mn</b></span>
      <span class="sp-cell"><i>HAFTALIK</i><b>${fmt(o.weekly)}mn</b></span>
      <span class="sp-cell"><i>SÜRE</i><b>${isSigned ? (o.remainingSeasons ?? o.years) + ' yıl kaldı' : o.years + ' yıl'}</b></span>
      <span class="sp-cell"><i>FESİH CEZASI</i><b>${fmt(o.fesihCeza)}mn</b></span>
    </div>
    <div class="sp-lists">
      <div class="sp-list"><div class="sp-list-h pos">✓ AVANTAJLAR</div>${line(avant, 'pos')}</div>
      <div class="sp-list"><div class="sp-list-h neg">⚠ DEZAVANTAJLAR</div>${line(dez, 'neg')}</div>
    </div>
    <div class="sp-actions">
      ${isSigned
    ? `<span class="pc-hint">İmzalı anlaşma — süre dolunca cezasız biter.</span><button class="pc-btn on" data-act="cancelSponsor" data-arg="${sc.slot}">🔨 Sözleşmeyi Feshet · −${fmt(o.fesihCeza)}mn</button><button class="pc-btn" data-act="spCardClose">Kapat</button>`
    : `<button class="pc-btn" data-act="rejectSponsor" data-arg="${sc.slot}|${o.id}">Reddet</button><button class="pc-btn pri" data-act="signSponsor" data-arg="${sc.slot}|${o.id}">✍ İmzala · peşinat ${fmt(o.pesinat)}mn</button><button class="pc-btn" data-act="spCardClose">Kapat</button>`}
    </div>
  </div></div>`;
}
