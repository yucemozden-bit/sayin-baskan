// src/ui/finance.js — MALİ MERKEZ v2: tam ekran 3 kolonlu pano, kaydırma yok.
// Nakit akışı BARLI grafik (gelir yeşil / gider kırmızı / NET LED), FFP şeridi,
// primler, borç masası. Panel dili tr-panel (3B yüzey) ile ortak.
import { fmt, esc } from './frame.js';
import { TUNING } from '../config.js';
import { sponsorOffers, iflasEsigi as A_iflasEsigi } from '../actions.js';
import { bilet as ecoBilet } from '../engines/economy.js';
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

  // ── Bilet fiyatı — CANLI ÖNİZLEME: seçili çarpanın doluluk/gişe etkisi anında görünür (saf hesap, RNG yok) ──
  const price = e.ticketPrice;
  const bOn = ecoBilet(G);
  const priceBtns = [0.6, 0.8, 1.0, 1.2, 1.6].map((p) =>
    `<button class="cx-btn ${Math.abs(price - p) < 0.001 ? 'on' : ''}" data-act="setTicket" data-arg="${p}">${p.toFixed(1)}×</button>`).join('');
  const biletPanel = `<div class="tr-panel">
    <div class="cx-panel-head"><span class="overline">Bilet Fiyatı</span><span class="cx-hint">çarpan</span></div>
    <div class="fin-kpi"><b>${price.toFixed(1)}<i>×</i></b><span>doluluk ~<b class="tnum">%${Math.round(bOn.doluluk * 100)}</b> · gişe ~<b class="tnum">${fmt(bOn.gelir)}mn</b>/maç — çarpanı değiştir, rakam anında oynar</span></div>
    <div class="cx-seg" style="margin-top:2px">${priceBtns}</div>
    <div class="tr-not">Ucuz = dolu tribün, az gelir · Pahalı = boş koltuk, çok gelir. Taraftar algısı sosyal nabza yansır.</div>
  </div>`;

  // ── YIL SONU VERGİLERİ (canlı projeksiyon) — kullanıcı: gerçekçi mali kural katmanı ──
  const VT = TUNING.ECONOMY || {};
  const karHam = Math.round(G.sezonKar || 0);
  const karEsik = VT.KAR_VERGISI_ESIK ?? 55;
  const borcMuaf = (e.borc || 0) > (VT.KAR_VERGISI_BORC_MUAF ?? 20);
  const karVergi = (!borcMuaf && karHam > karEsik) ? Math.round((karHam - karEsik) * (VT.KAR_VERGISI ?? 0.4)) : 0;
  const svEsik = ((VT.SERVET_VERGISI || {}).ESIK || {})[G.club.tier] || 100;
  const kasaFazla = Math.max(0, Math.round(e.kasa) - svEsik);
  const servetVergi = Math.round(kasaFazla * ((VT.SERVET_VERGISI || {}).ORAN ?? 0.5));
  const vergiSerit = `<div class="fin-vergi">
    <span class="fin-vergi-t">📅 YIL SONU VERGİ</span>
    <span class="fin-vergi-i" data-tip="Sezon işletme kârının ilk ${karEsik}mn'i muaf, üstü %${Math.round((VT.KAR_VERGISI ?? 0.4) * 100)} kesilir — AMA yalnız borçsuzken. Borçluyken 'önce borcunu öde', vergi yok. Bu sezon kârı: ${fmt(karHam)}mn.">💰 Kâr vergisi <b class="${karVergi > 0 ? 'neg' : 'pos'}">~${fmt(karVergi)}mn</b>${borcMuaf ? ' <i>borçlu·muaf</i>' : ''}</span>
    <span class="fin-vergi-i" data-tip="Kasa tier tamponunu (${svEsik}mn) aşarsa fazlanın %${Math.round(((VT.SERVET_VERGISI || {}).ORAN ?? 0.5) * 100)}'i vergilenir — hazine milyarlarda kalmasın. Parayı sahaya/tesise yatır, tampon altında kal. Kasa: ${fmt(e.kasa)}mn.">🏛 Servet vergisi <b class="${servetVergi > 0 ? 'neg' : 'pos'}">~${fmt(servetVergi)}mn</b>${kasaFazla > 0 ? ` <i>+${fmt(kasaFazla)} fazla</i>` : ''}</span>
    <span class="fin-vergi-not">${servetVergi > 0 || karVergi > 0 ? 'yatır ya da kaybet — parayı çürütme' : e.borc > 0 ? 'borcunu öde, vergiden muafsın' : 'kasa temiz, vergi yok'}</span>
  </div>`;

  // ── GAYRİMENKUL PORTFÖYÜ — servet vergisine karşı üretken çıkış (Gayrimenkul Ofisi portalı) ──
  const gm = G.gayrimenkul || { deger: 0, kira: 0, adet: 0 };
  const gmBar = `<div class="fin-vergi gmo-bar-fin">
    <span class="fin-vergi-t">🏙️ GAYRİMENKUL</span>
    <span class="fin-vergi-i" data-tip="Portföy değeri — servet vergisinden MUAF üretken varlık (kasadaki para vergilenir, gayrimenkul vergilenmez).">Portföy <b class="pos">${fmt(gm.deger)}mn</b>${gm.adet ? ` <i>${gm.adet} mülk</i>` : ''}</span>
    <span class="fin-vergi-i" data-tip="Aylık kira geliri — her sezon kasaya akar (${Math.round((VT.GAYRIMENKUL?.AY_PER_SEZON ?? 2.5))} ay/sezon). Yalnız binalar kira üretir, arsalar değerlenir.">Kira <b class="pos">${fmt(gm.kira)}mn</b>/ay</span>
    <button class="cx-btn on" data-act="gayrimenkulAc" data-tip="Gayrimenkul Ofisi'ni aç — kasan bütçe olur, arsa/bina al, sat, inşa et, kiraya ver">🏙️ Ofisi Aç</button>
    ${gm.deger > 0 ? `<button class="cx-btn" data-act="gayrimenkulSat" data-tip="Tüm portföyü nakde çevir — %${Math.round((VT.GAYRIMENKUL?.SATIS_ISKONTO ?? 0.05) * 100)} likidite iskontosu">Portföyü Sat</button>` : ''}
  </div>`;

  // ── Nakit akışı: TAM GENİŞLİK YATAY BANT — gelir | gider | NET üç kolonda (vitrin başrol, akış dipnot)
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
      <div class="cx-panel-head"><span class="overline">Haftalık Nakit Akışı</span><span class="cx-hint" data-tip="${esc(guvenilirlik)}">⚠ CFO projeksiyonu</span></div>
      <div class="fin-akis-grid">
        <div class="fin-akis-kol">
          <div class="fin-grup pos-c">GELİR · ${fmt(g.toplam)}mn</div>
          ${rows.slice(0, 4).map((r) => satir(r[0], r[1], 1)).join('')}
        </div>
        <div class="fin-akis-kol">
          <div class="fin-grup neg-c">GİDER · ${fmt(gi.toplam)}mn</div>
          ${rows.slice(4).map((r) => satir(r[0], r[1], 0)).join('')}
        </div>
        <div class="fin-net-kutu">
          <i>NET / HAFTA</i>
          <b class="led" style="color:${net >= 0 ? 'var(--pos)' : 'var(--neg)'}">${net >= 0 ? '+' : ''}${fmt(net)}<span>mn</span></b>
          <span class="micro">${esc(guvenilirlik)}</span>
        </div>
      </div>
    </div>`;
  } else {
    akisPanel = `<div class="tr-panel fin-akis">
      <div class="cx-panel-head"><span class="overline">Haftalık Nakit Akışı</span><span class="cx-hint">CFO projeksiyonu</span></div>
      <div class="fin-akis-bos">📊 İlk maçtan sonra gelir-gider barları burada akacak.</div>
    </div>`;
  }

  // ── FFP ──
  const ffp = G.ffp || { limit: 0, spent: 0 };
  const fPct = ffp.limit ? Math.min(120, Math.round((ffp.spent / ffp.limit) * 100)) : 0;
  const fColor = fPct >= 100 ? 'var(--neg)' : fPct >= 90 ? 'var(--warn)' : 'var(--pos)';
  const ffpPanel = `<div class="tr-panel">
    <div class="cx-panel-head"><span class="overline">Harcama Limiti · FFP</span>${ffp.taahhut ? '<span class="badge" style="background:var(--neg);color:#fff">TAAHHÜTNAME</span>' : '<span class="cx-hint">federasyon takibi</span>'}</div>
    <div class="fin-kpi"><b style="color:${fColor}">%${fPct}</b><span>tavan <b class="tnum">${fmt(ffp.limit)}mn</b> · harcanan <b class="tnum">${fmt(ffp.spent)}mn</b> — sınırı aşan başkan taahhütnameye imza atar</span></div>
    <div class="tr-butce-bar" style="margin-top:4px"><div style="width:${Math.min(100, fPct)}%;background:${fColor}"></div></div>
    ${ffp.cutActive ? '<div class="tr-not" style="color:var(--warn);border:0;padding-top:6px">Bu sezon gelirlerden taahhüt kesintisi düşülüyor (−%5).</div>' : ''}
    <div class="cx-seg"><button class="cx-btn" data-act="ffpLobi" ${ffp.lobiUsed || (G.club.reputation <= 60) ? 'disabled' : ''} data-tip="İtibar>60 gerekir · %40 şans · başarıda tavan +%10">Federasyona lobi yap</button></div>
  </div>`;

  // ── Primler ──
  const pl = G.primLedger || {};
  const primTop = (pl.mac || 0) + (pl.seri || 0) + (pl.ozel || 0) + (pl.sezon || 0);
  const primPanel = `<div class="tr-panel">
    <div class="cx-panel-head"><span class="overline">Prim Defteri</span><span class="cx-hint">bu sezon</span></div>
    <div class="fin-kpi"><b>${fmt(primTop)}<i>mn</i></b><span>maç <b class="tnum">${fmt(pl.mac || 0)}</b> · seri <b class="tnum">${fmt(pl.seri || 0)}</b> · özel <b class="tnum">${fmt(pl.ozel || 0)}</b> · hedef <b class="tnum">${fmt(pl.sezon || 0)}</b></span></div>
    <div class="cx-seg">
      <button class="cx-btn ${G.seriPrim ? 'on' : ''}" data-act="seriPrim">Seri Primi ${G.seriPrim ? 'AÇIK' : 'kapalı'}</button>
      <button class="cx-btn ${G.sezonHedefDeclared ? 'on' : ''}" data-act="sezonPrim" ${G.sezonHedefDeclared || G.meta.week > 2 ? 'disabled' : ''}>${G.sezonHedefDeclared ? 'Sezon Hedefi İLAN EDİLDİ' : 'Sezon Hedefi ilan et (hafta 1-2)'}</button>
    </div>
    <div class="tr-not">Seri: 3 galibiyet üstüne ekstra. Sezon hedefi: tüm sezona moral tabanı; tutmazsa küçük ceza.</div>
  </div>`;

  // ── Borç masası ──
  const aile = G.mode === 'aile';
  // İFLAS ÇİZGİSİ — kayyum eşiği görünür olsun (büyük test kararı #5): bar + kırmızı çentik
  const esik = A_iflasEsigi(G);
  const borcPct = Math.min(100, Math.round((e.borc / esik) * 100));
  const cizgiRenk = borcPct >= 80 ? 'var(--neg)' : borcPct >= 55 ? 'var(--warn)' : 'var(--club-2)';
  const iflasBar = `<div class="fin-iflas" data-tip="Kayyum eşiği ${esik}mn — borç bu çizgiyi aşarsa federasyon yönetime el koyar (eşik, devraldığın borca göre hesaplanır)">
    <div class="fin-iflas-ust"><span>Kayyum çizgisi</span><b style="color:${cizgiRenk}">${Math.round(e.borc)} / ${esik}mn</b></div>
    <div class="fin-iflas-bar"><i style="width:${borcPct}%;background:${cizgiRenk}"></i><u style="left:${Math.round((esik - 100) / esik * 100)}%" data-tip="Uyarı bölgesi: ${esik - 100}mn'de KAYYUM KAPIDA manşeti düşer"></u></div>
  </div>`;
  const hFaiz = e.borc > 0 ? Math.round(e.borc * e.faizOrani / (G.SEASON_WEEKS || 34) * 10) / 10 : 0;
  const borcPanel = `<div class="tr-panel">
    <div class="cx-panel-head"><span class="overline">Borç Masası</span><span class="cx-hint">faiz %${Math.round(e.faizOrani * 100)}</span></div>
    <div class="fin-kpi"><b class="${e.borc > 0 ? 'kpi-neg' : 'kpi-pos'}">${fmt(e.borc)}<i>mn</i></b><span>${e.borc > 0 ? `faiz kasadan haftada ~<b class="tnum">${fmt(hFaiz)}mn</b> yiyor · <b class="tnum" data-tip="Faizi ödesen bile anapara ~%${Math.round((TUNING.ECONOMY.BORC_KOMPOUND ?? 0.02) * 100)}/yıl bileşik büyür — sürüncemede bırakma">anapara bileşik ↑</b> — ödedikçe kayyum çizgisi uzaklaşır` : 'borç SIFIR — kongre mali disiplini alkışlıyor'}</span></div>
    ${iflasBar}
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
  const SLT_IK = { gogus: '👕', naming: '🏟', kol: '🎽' };
  const namingLocked = (G.facilities.stadyum || 0) < 7;
  // Tip → marka logo aksan rengi (kurumsal altın, fintech mavi, bahis kırmızı, kripto turuncu, yerel yeşil)
  const SPO_ACCENT = { standart: 'var(--club)', fintech: 'var(--info)', bahis: 'var(--neg)', kripto: 'var(--warn)', yerel: 'var(--pos)', naming: 'var(--club-2)' };
  const sezonluk = (o) => Math.round((o.annual ?? o.weekly * 52) * 10) / 10;
  // MARKA VİTRİNİ — en güçlü teklif büyük plaka, kalanlar kompakt satır; imzalı anlaşma altın levha.
  // Her teklifte ⏳ masada-kalma sayacı (2 hafta ve altı kırmızı — "beklemek de bir karar").
  const avBekleyen = (G.inbox || []).filter((m) => m.action === 'spBuyout' && !m.resolved).map((m) => m.slot);
  const slotCell = (slot) => {
    const signed = deals[slot];
    if (signed) {
      const sv = Math.round((signed.weekly * 52) * 10) / 10;
      const kalan = signed.remainingSeasons ?? signed.years;
      const dots = '●'.repeat(Math.max(0, Math.min(5, kalan))) + '○'.repeat(Math.max(0, Math.min(5, (signed.years || kalan)) - Math.min(5, kalan)));
      const avli = avBekleyen.includes(slot);
      return `<div class="spo-slot filled">
        <div class="spo-slot-h"><span class="spo-slot-ik">${SLT_IK[slot]}</span>${SLT[slot]}<span class="spo-slot-tag on">✓ İMZALI</span></div>
        <div class="spo-card signed ${avli ? 'avli' : ''}" style="--sc:${SPO_ACCENT[signed.type] || 'var(--club)'}" data-act="spDetay" data-arg="${slot}|signed" data-tip="Anlaşma detayı + fesih">
          <div class="spo-c-top">
            <span class="spo-logo">${signed.ik || '🤝'}</span>
            <div class="spo-c-id"><div class="spo-c-nm">${esc(signed.name)}</div><div class="spo-c-sec">${esc(signed.sector)} · <span class="spo-dots" data-tip="Kalan sözleşme yılı">${dots}</span> ${kalan} yıl</div></div>
            <div class="spo-c-val"><b>${fmt(sv)}</b><span>mn/sezon</span></div>
          </div>
          <div class="spo-c-terms">
            <span><i>HAFTALIK</i><b class="pos">+${fmt(signed.weekly)}mn</b></span>
            <span><i>FESİH CEZASI</i><b>${fmt(signed.fesihCeza)}mn</b></span>
            <span><i>DURUM</i><b>${avli ? '🎯 AV TEKLİFİ' : 'Aktif'}</b></span>
          </div>
          ${avli ? '<div class="spo-av-not">🎯 Rakip marka fesih bedelini üstlenmeye talip — dosya karar masanda</div>' : ''}
        </div>
      </div>`;
    }
    if (slot === 'naming' && namingLocked) {
      // Kilitli slot ORTA SAHNEYİ İŞGAL ETMEZ: dar "kasa dairesi" sütunu — stadyum ilerlemesi + kestirme
      const sv = G.facilities.stadyum || 0;
      const seg = Array.from({ length: 7 }, (_, i) => `<span class="spo-kasa-seg ${i < sv ? 'dolu' : ''}"></span>`).join('');
      return `<div class="spo-slot locked dar"><div class="spo-slot-h"><span class="spo-slot-ik">${SLT_IK[slot]}</span>${SLT[slot]}<span class="spo-slot-tag">🔒</span></div>
        <div class="spo-kasa">
          <div class="spo-kasa-kilit">🔒</div>
          <b>EN PAHALI SLOT</b>
          <span>Stadın adı holdinglere satılır — kapı stadyum <b>sv.7</b>'de açılır.</span>
          <div class="spo-kasa-sv" data-tip="Stadyum seviyesi ${sv}/7 — her kademe kapıyı biraz daha aralar">${seg}</div>
          <span class="micro">stadyum sv.${sv}/7</span>
          <button class="cx-btn cx-btn-sm" data-act="nav" data-arg="tesis" data-tip="Tesisler ekranına git — stadyum ihalesi aç">🏗 Stadı Büyüt ▸</button>
        </div></div>`;
    }
    const offers = sponsorOffers(G, slot);
    if (!offers.length) return `<div class="spo-slot"><div class="spo-slot-h"><span class="spo-slot-ik">${SLT_IK[slot]}</span>${SLT[slot]}<span class="spo-slot-tag">boş masa</span></div>
      <div class="spo-empty">📡 Masada teklif yok<span>Piyasa canlı — yeni markalar her hafta kapıyı çalabilir.</span></div></div>`;
    // KARE KARE (kullanıcı kuralı): en fazla 4 teklif, 2×2 eşit kart — üst üste binme yok,
    // büyük kart/satır karması yok. En güçlü teklif aynı boyda kalır, altın çerçeveyle konuşur.
    const sirali = [...offers].sort((a, b) => (b.annual ?? b.weekly * 52) - (a.annual ?? a.weekly * 52)).slice(0, 4);
    const kare = (o, best) => `<div class="spo-mini ${best ? 'best' : ''} ${o.riskProfile ? 'risky' : ''}" style="--sc:${SPO_ACCENT[o.type] || 'var(--club)'}" data-act="spDetay" data-arg="${slot}|${o.id}" data-tip="Detayları aç — avantaj/dezavantaj, tüm şartlar">
        ${best ? '<span class="spo-mini-star">★ EN GÜÇLÜ TEKLİF</span>' : ''}
        <div class="spo-mini-ust">
          <span class="spo-logo-sm">${o.ik || '🤝'}</span>
          <div class="spo-mini-id"><b>${esc(o.name)}</b><i>${esc(o.sektor || o.sector || '')} · ${o.years} yıl</i></div>
          <span class="spo-mini-val"><b>${fmt(sezonluk(o))}</b><em>mn/sezon</em></span>
        </div>
        <div class="spo-mini-alt">
          <span class="spo-mini-chip ${o.kalanHafta <= 2 ? 'kritik' : ''}" data-tip="Teklif masada ${o.kalanHafta} hafta daha kalır">⏳${o.kalanHafta}h</span>
          <span class="spo-mini-chip ${o.dezavantaj ? 'risk' : 'temiz'}" data-tip="${o.dezavantaj ? esc(o.dezavantaj) : 'Temiz anlaşma — bilinen risk yok'}">${o.dezavantaj ? '⚠' : '✓'}</span>
          <button class="spo-mini-al" data-act="signSponsor" data-arg="${slot}|${o.id}" data-tip="Hızlı imza — ${fmt(o.pesinat)}mn peşinat anında kasaya">✍ İMZALA · ${fmt(o.pesinat)}mn</button>
        </div>
      </div>`;
    return `<div class="spo-slot"><div class="spo-slot-h"><span class="spo-slot-ik">${SLT_IK[slot]}</span>${SLT[slot]}<span class="spo-slot-tag">${offers.length} teklif</span></div>
      <div class="spo-mini-grid">${sirali.map((o, i) => kare(o, i === 0)).join('')}</div></div>`;
  };
  const yurtBtn = G.expansion && G.expansion.officeCount >= 1
    ? '<span class="cx-hint" style="color:var(--pos)">🌍 Yurt dışı ofisi AÇIK · +%6</span>'
    : `<button class="cx-btn cx-btn-sm" data-act="yurtOfis" ${G.economy.kasa < 25 || (G.club.reputation ?? 50) < 60 ? 'disabled' : ''} data-tip="25mn · itibar ≥60 ister. Sponsor geliri kalıcı +%6; 'Adımızı Sınırın Ötesine Taşıyacağım' sözünü tutar">🌍 Yurt Dışı Ofisi · 25mn</button>`;
  const spToplam = Math.round(['gogus', 'naming', 'kol'].reduce((s, k) => s + (deals[k]?.weekly || 0), 0) * 10) / 10;
  const spGelir = spToplam > 0
    ? `sözleşmeli gelir <b class="spo-toplam">+${fmt(spToplam)}mn/hafta</b>`
    : `<b class="spo-toplam">imzalı anlaşma yok</b> — peşinat kasaya, haftalık akışa yazar`;
  // SABİT SAHNE (kullanıcı kuralı): sütun oranları duruma göre ASLA değişmez — imza/teklif/kilit
  // fark etmeksizin orta (naming) dar-sabit, yanlar geniş-sabit. Zıplama, büyüyüp küçülme yok.
  const sponsorPanel = `<div class="tr-panel fin-sponsor">
    <div class="cx-panel-head"><span class="overline">Sponsorluk Pazarı</span><span class="spo-nabiz" data-tip="Teklifler her hafta yenilenir: eskiyen çekilir, yeni marka kapıyı çalar. İmzalı sponsorun varsa rakip markalar fesih bedelini üstlenip formanı isteyebilir (SPONSOR AVI)."><i></i>CANLI PİYASA</span><span class="cx-hint" data-tip="Peşinat kasaya · haftalık gelir · bahis/kripto çok getirir ama taraftar/itibar riski. Süre dolunca cezasız biter; erken fesih ağır bedellidir.">${spGelir}</span>${yurtBtn}</div>
    <div class="spo-grid">${['gogus', 'naming', 'kol'].map(slotCell).join('')}</div>
  </div>`;

  const faizPct = Math.round(e.faizOrani * 100);
  const ffpDurum = ffp.taahhut ? 'TAAHHÜT' : !ffp.limit ? 'BEKLEMEDE' : fPct >= 100 ? 'AŞILDI' : fPct >= 90 ? 'SINIRDA' : 'TAKİPTE';
  const crumb = `FİNANS · KASA ${fmt(e.kasa)}MN · BORÇ ${fmt(e.borc)}MN · FAİZ %${faizPct} · FFP ${ffpDurum}`;
  // YENİ DÜZEN (kullanıcı: "sıkışık — gerekirse sayfa düzenini değiştir"): vitrin BAŞROL satırı
  // (tam genişlik, 3 slot gerçek alan bulur), nakit akışı altta yatay dipnot bandı.
  const body = `<div class="fin-root">
    <div class="fin-strip">${biletPanel}${borcPanel}${ffpPanel}${primPanel}</div>
    ${vergiSerit}
    ${gmBar}
    ${sponsorPanel}
    ${akisPanel}
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
