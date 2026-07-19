// src/ui/ozelHayat.js — ÖZEL HAYAT ekranı (sb- görsel katman, 2 sekme).
// Genel Durum: profil + rozetler + özel gündem (ikilem) + yaşam halkaları + haftalık program + ilişki ağı.
// Servet & Yaşam: kişisel servet + kulübe destek + varlık mağazası + davetler.
// Yalnız state OKUR — tüm mutasyonlar actions.js (ozelProg/ozelKarar/ozelVarlik/ozelDavet/ozelBagis).
import { esc } from './frame.js';
import { sbShell } from './cockpit.js';
import { UNVANLAR, SEVIYE_ESIK, VARLIK, DAVETLER, OLAYLAR, ROZETLER, UNVAN_PASIF, varlikDegeri, varlikPasif, varlikPerkleri, haftalikGelir } from '../engines/ozel.js';
import { bkIsim } from '../engines/iliski.js';

const fm = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

// Kokpit ile aynı halka bileşeni (sb-gauge) — stres/enerji için renk tersine dönebilir
function ring(v, lbl, word, tersRenk = false, tip = '') {
  const C = 175.93, off = ((1 - v / 100) * C).toFixed(1);
  const kotu = tersRenk && v >= 60;
  return `<div class="sb-gauge"${tip ? ` data-tip="${tip}"` : ''}><div class="sb-gauge-ring"><svg viewBox="0 0 72 72"><circle class="sb-gauge-bg" cx="36" cy="36" r="28"/><circle class="sb-gauge-fg" cx="36" cy="36" r="28" transform="rotate(-90 36 36)" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off}"${kotu ? ' style="stroke:var(--neg)"' : ''}/></svg><span class="sb-gauge-val">${Math.round(v)}</span></div><div class="sb-gauge-l">${lbl}</div><div class="sb-gauge-n">${word}</div></div>`;
}
const kelime = (v, a, b, c) => (v < 40 ? a : v < 65 ? b : c);

export function render(G) {
  const oz = G.ozel;
  if (!oz) return sbShell(G, { crumb: 'ÖZEL HAYAT', title: 'Özel Hayat', body: '<div class="sb-muted">Kariyer başlayınca aile fotoğrafı buraya asılacak.</div>' });
  const tab = G._ozelTab || 'genel';
  const unvan = UNVANLAR[oz.seviye - 1] || UNVANLAR[0];
  const tabs = `<div class="oz-tabs">
    <button class="oz-tab ${tab === 'genel' ? 'on' : ''}" data-act="ozelTab" data-arg="genel">Genel Durum</button>
    <button class="oz-tab ${tab === 'servet' ? 'on' : ''}" data-act="ozelTab" data-arg="servet">Servet &amp; Yaşam</button>
    <button class="oz-tab ${tab === 'defter' ? 'on' : ''}" data-act="ozelTab" data-arg="defter">Karar Defteri${(oz.defter || []).length ? ` · ${oz.defter.length}` : ''}</button>
  </div>`;
  const body = tabs + (tab === 'servet' ? servetTab(G, oz) : tab === 'defter' ? defterTab(G, oz) : genelTab(G, oz, unvan));
  return sbShell(G, { crumb: `ÖZEL HAYAT · ${unvan.toLocaleUpperCase('tr')} · SEVİYE ${oz.seviye}`, title: 'Özel Hayat', body });
}

// ── SEKME 1: GENEL DURUM ──
function genelTab(G, oz, unvan) {
  const R = oz.iliski, g = oz.g;
  // Tecrübe ilerlemesi
  const svMax = oz.seviye >= SEVIYE_ESIK.length;
  const alt = SEVIYE_ESIK[oz.seviye - 1] || 0, ust = SEVIYE_ESIK[oz.seviye] || (alt + 1);
  const pct = svMax ? 100 : Math.min(100, Math.round((oz.xp - alt) / (ust - alt) * 100));
  const rozetler = Object.entries(ROZETLER).map(([k, r]) => `<div class="oz-rozet ${oz.rozet[k] ? 'acik' : ''}" data-tip="${oz.rozet[k] ? r.pasifTxt : 'Kilitli — ' + r.kosulTxt}">
      <span class="oz-rozet-ik">${oz.rozet[k] ? r.ik : '🔒'}</span><b>${r.ad}</b><i>${oz.rozet[k] ? r.pasifTxt : r.kosulTxt}</i>
    </div>`).join('');

  // Özel gündem — ikilem kartı ya da sakin hafta
  const o = oz.olay ? OLAYLAR.find((x) => x.id === oz.olay.id) : null;
  const adDoldur = (s) => String(s).replace(/%ES%/g, oz.aile?.es || '—').replace(/%C1%/g, oz.aile?.c1 || '—').replace(/%C2%/g, oz.aile?.c2 || '—').replace(/%BK%/g, bkIsim(G.opponents?.[0], G.data?.names));
  const gundem = o ? `<div class="oz-olay">
      <div class="oz-olay-kisi">${esc(adDoldur(o.kisi).toLocaleUpperCase('tr'))} <span class="oz-ikilem">İKİLEM</span></div>
      <div class="oz-olay-t">${esc(o.t)}</div>
      <div class="oz-olay-q">${esc(adDoldur(o.q))}</div>
      ${o.a.map((a, i) => `<button class="oz-secim ${i === 0 ? 'birincil' : ''}" data-act="ozelKarar" data-arg="${i}"><b>${esc(a.l)}</b><i>${esc(a.info || '')}</i></button>`).join('')}
    </div>`
    : `<div class="oz-olay sakin"><div class="oz-olay-t">Sakin bir hafta</div><div class="sb-muted">Telefon susuyor, ev sıcak. Gündem gelince burada bekler — cevapsız kalan fırsat kaçar.</div></div>`;
  const akis = oz.akis.length ? `<div class="oz-akis"><div class="oz-akis-k">AKIŞ</div>${oz.akis.map((s) => `<div class="oz-akis-s">· ${esc(s)}</div>`).join('')}</div>` : '';

  // Haftalık program
  const PROG = [
    ['aile', 'Aile akşamı', 'Ev ▲ · eş/çocuklar ▲'],
    ['dinlen', 'Sağlık / dinlenme', 'Enerji ▲ · stres ▼'],
    ['mesai', 'Kulüp mesaisi', '2 akşamda sorgu hakkı +1 · enerji ▼'],
    ['sosyal', 'Sosyal / davet', 'Sosyal ▲ · çevre ▲'],
  ];
  const bos = 4 - Object.values(oz.prog).reduce((a, b) => a + b, 0);
  // CANLI ÖNİZLEME — motorla AYNI formüller (ozelTick): oyuncu bu programın haftalık net etkisini görür
  const vpz = varlikPasif(oz);
  const P = oz.prog;
  const net = {
    ev: P.aile * 3 - (oz.rozet.aile ? 2 : 3) + (vpz.ev || 0),
    enerji: P.dinlen * 5 + 2 - 3 - P.mesai * ((oz.varlik.hava || 0) >= 1 ? 1 : 2) - P.sosyal + (vpz.enerji || 0),
    stres: 4 - P.dinlen * 4 - P.aile,
    sosyal: P.sosyal * 4 - 4 + (vpz.sosyal || 0),
  };
  const cip = (ad, v, ters = false) => { const iyi = ters ? v <= 0 : v >= 0; return `<span class="oz-net ${v === 0 ? '' : iyi ? 'iyi' : 'kotu'}">${ad} ${v > 0 ? '+' : ''}${Math.round(v * 10) / 10}</span>`; };
  const netCips = `<div class="oz-net-cips" data-tip="Bu programın haftalık net etkisi (maç sonucu hariç)">${cip('Ev', net.ev)}${cip('Enerji', net.enerji)}${cip('Stres', net.stres, true)}${cip('Sosyal', net.sosyal)}</div>`;
  const progRows = PROG.map(([k, ad, sub]) => `<div class="oz-prog-satir">
      <div class="oz-prog-ad"><b>${ad}</b><i>${sub}</i></div>
      <div class="oz-prog-btn"><button data-act="ozelProg" data-arg="${k}|-" ${oz.prog[k] <= 0 ? 'disabled' : ''}>−</button><span class="tnum">${oz.prog[k]}</span><button data-act="ozelProg" data-arg="${k}|+" ${bos <= 0 ? 'disabled' : ''}>+</button></div>
    </div>`).join('');

  const bar = (v) => `<div class="oz-il-bar"><i class="${v >= 60 ? 'iyi' : v >= 40 ? 'orta' : 'kotu'}" style="width:${Math.max(3, Math.min(100, v))}%"></i></div>`;
  const bosandi = !!oz.flags?.bosandi;
  const iliskiler = [
    bosandi
      ? [oz.aile?.es || '—', 'eski eş · ayrı yaşıyor', R.es, 'Yollar ayrıldı — bu kanal kapalı; evin direği artık çocuklarla bağ']
      : [oz.aile?.es || '—', 'Eş', R.es, 'Eş <35 → evde soğuk rüzgâr; 4 hafta <20 kalırsa valizler kapıya dayanır'],
    [oz.aile?.c1 || '—', 'Kızı', R.c1, 'Çocuklarla bağ ort. ≥70 → sezon sonu yıllık aile fotoğrafı (itibar +1)'],
    [oz.aile?.c2 || '—', 'Oğlu', R.c2, 'Çocuklarla bağ ort. ≥70 → sezon sonu yıllık aile fotoğrafı (itibar +1)'],
    ['Rıfat Bey', 'iş dostu', R.dost, 'Arsa fırsatları ve tekne turlarının adamı'],
    ['Deniz Aksu', 'magazin muhabiri', R.muhabir, '≥70 → Medya Dostu rozeti: magazin seni teğet geçer'],
  ].map(([ad, rol, v, tip]) => `<div class="oz-il" data-tip="${esc(tip)}"><span><b>${esc(ad)}</b> · ${rol}</span>${bar(v)}</div>`).join('');

  return `<div class="oz-grid">
    <div class="oz-kol">
      <div class="sb-panel">
        <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">ÖZEL HAYAT · SAYIN BAŞKAN</span><span class="sb-panel-r oz-ruh">RUH HÂLİ · ${kelime((g.ev + g.enerji + (100 - g.stres)) / 3, 'YIPRANMIŞ', 'DENGEDE', 'HUZURLU')}</span></div>
        <div class="oz-profil">
          <div class="oz-profil-ad">${esc(G.baskan?.name || 'Sayın Başkan')}</div>
          <div class="sb-muted">${oz.yas} yaşında · ${oz.flags?.bosandi ? `${esc(oz.aile?.es || '—')} Hanım'dan boşandı` : `${esc(oz.aile?.es || '—')} Hanım ile ${oz.evlilikYil} yıl`} · 2 çocuk (${esc(oz.aile?.c1 || '—')} ${oz.c1Yas || ''}, ${esc(oz.aile?.c2 || '—')} ${oz.c2Yas || ''})${oz.flags?.ogulKadroda ? ' · ⚽ oğlun A takımda' : oz.flags?.ogulAkademide ? ' · 🎓 oğlun akademide' : ''}${oz.flags?.kizKulupte ? ' · 👔 kızın kulüpte' : ''}</div>
          <div class="oz-xp"><span>BAŞKANLIK TECRÜBESİ · <b>${esc(unvan)}</b> (sv.${oz.seviye})</span><span class="tnum">%${pct}</span></div>
          <div class="oz-xp-bar"><i style="width:${pct}%"></i></div>
          <div class="micro">${oz.seviye >= UNVANLAR.length ? 'Zirvedesin — adın kulüp tarihine yazılıyor.' : `Sonraki: <b>${esc(UNVANLAR[oz.seviye])}</b> — ${esc(UNVAN_PASIF[oz.seviye + 1] || 'dengeli haftalar puan kazandırır')}`}</div>
          ${oz.seviye >= 2 ? `<div class="oz-pasifler" data-tip="Unvanlarınla açılan kalıcı kolaylıklar">${Object.entries(UNVAN_PASIF).filter(([sv]) => +sv <= oz.seviye).map(([sv, p]) => `<span class="oz-pasif">◆ ${esc(p)}</span>`).join('')}</div>` : ''}
        </div>
        <div class="oz-rozetler">${rozetler}</div>
      </div>
      <div class="sb-panel">
        <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">ÖZEL GÜNDEM</span><span class="sb-panel-r">${oz.olayCoz} ikilem çözüldü</span></div>
        ${gundem}${akis}
      </div>
    </div>
    <div class="oz-kol">
      <div class="sb-panel">
        <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">YAŞAM GÖSTERGELERİ</span></div>
        <div class="oz-ringler">
          ${ring(g.ev, 'EV HUZURU', kelime(g.ev, 'gergin', 'dengede', 'sıcak'))}
          ${ring(g.enerji, 'ENERJİ', kelime(g.enerji, 'tükenmiş', 'idare eder', 'zinde'))}
          ${ring(g.stres, 'STRES', kelime(100 - g.stres, 'tehlikeli', 'baskıda', 'kontrollü'), true, 'DÜŞÜK İYİDİR. Her hafta baz +4 · Dinlenme akşamı başına −4 · Aile akşamı −1 · galibiyet −2, mağlubiyet +2. Düşürmek için: Dinlenmeye 2 akşam ver; Dr. Vural randevusu −8, tatil kaçamağı −10. 80 üstünde 3 hafta kalırsan doktor kapıyı çalar.')}
          ${ring(g.sosyal, 'SOSYAL', kelime(g.sosyal, 'köşede', 'görünür', 'cemiyette'))}
        </div>
        <div class="micro" style="margin-top:.4em">${g.enerji < 35 ? 'Enerji düşük — basında gaf, masada yorgun karar riski.' : g.stres >= 70 ? 'Stres yüksek — Dr. Vural tansiyon takibi öneriyor.' : 'Dengeli hafta tecrübe puanı kazandırır.'}</div>
      </div>
      <div class="sb-panel">
        <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">HAFTALIK PROGRAM</span><span class="sb-panel-r">${bos} akşam boş</span></div>
        ${progRows}
        ${netCips}
        <div class="micro">Program her hafta kendiliğinden uygulanır — bir kez ayarla, gerektiğinde dokun.</div>
      </div>
      <div class="sb-panel">
        <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">İLİŞKİ AĞI</span></div>
        ${iliskiler}
      </div>
    </div>
  </div>`;
}

// ── SEKME 3: KARAR DEFTERİ — verdiğin ikilemlerin tarihi (hikâyeni geriye oku) ──
function defterTab(G, oz) {
  const adDoldur = (s) => String(s).replace(/%ES%/g, oz.aile?.es || '—').replace(/%C1%/g, oz.aile?.c1 || '—').replace(/%C2%/g, oz.aile?.c2 || '—').replace(/%BK%/g, 'Rakip Başkan');
  const kayitlar = (oz.defter || []).map((d) => `<div class="oz-defter-satir">
      <span class="oz-defter-tarih tnum">S${d.s}·H${d.h}</span>
      <div class="oz-defter-icerik"><b>${esc(d.t)}</b><i>${esc(adDoldur(d.kisi || ''))}</i></div>
      <span class="oz-defter-secim">▸ ${esc(d.secim)}</span>
    </div>`).join('');
  return `<div class="oz-grid"><div class="oz-kol" style="grid-column:1/-1">
    <div class="sb-panel">
      <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">KARAR DEFTERİ</span><span class="sb-panel-r">${(oz.defter || []).length ? `son ${(oz.defter || []).length} karar` : 'defter boş'}</span></div>
      ${kayitlar || '<div class="sb-muted">Henüz ikilem çözmedin — hayat kapıyı çalınca burada iz bırakır. Her seçim, kim olduğunun tutanağıdır.</div>'}
    </div>
  </div></div>`;
}

// ── SEKME 2: SERVET & YAŞAM ──
function servetTab(G, oz) {
  const abs = (G.meta.season || 1) * 100 + (G.meta.week || 1);
  const toplam = varlikDegeri(oz) + oz.nakit;
  const gelir = haftalikGelir(oz);
  const bagisKalan = 3 - oz.bagisSezon;
  const bagisBtn = [2, 5, 10].map((mn) => {
    const olmaz = bagisKalan <= 0 ? 'sezon hakkı doldu' : oz.nakit < mn ? 'nakit yetersiz' : '';
    return `<button class="oz-bagis-btn" data-act="ozelBagis" data-arg="${mn}" ${olmaz ? 'disabled' : ''} data-tip="${olmaz || `Kulüp kasasına +${mn}mn · taraftar/itibar minik ▲`}">+${mn}mn</button>`;
  }).join('');

  // ── SHOWROOM (assets/showroom.html — 3D vitrin): sol liste kategori+kademe çipleri, sağda
  // seçili varlığın interaktif 3D sahnesi. SABİT İSKELET: 5 kategori satırı hep durur, seçim
  // yalnız vitrini değiştirir — panel boyu oynamaz (kullanıcı kuralı).
  const vitS = G._vitrin && VARLIK[G._vitrin.kat] ? G._vitrin : { kat: 'konut', idx: Math.min(oz.varlik.konut || 0, VARLIK.konut.adlar.length - 1) };
  const VV = VARLIK[vitS.kat];
  const vIdx = Math.max(0, Math.min(vitS.idx ?? 0, VV.adlar.length - 1));
  const vLv = oz.varlik[vitS.kat] || 0;
  const vSahip = vIdx < vLv, vSirada = vIdx === vLv, vFiyat = VV.fiyat[vIdx];
  const vScene = (VV.model || [])[vIdx] || 'konut1';
  const vPasif = Object.entries(VV.pasif || {}).map(([g, arr]) => (arr[vIdx] ? `${{ ev: 'ev huzuru', sosyal: 'sosyal', enerji: 'enerji' }[g] || g} +${arr[vIdx]}/hafta` : '')).filter(Boolean).join(' · ');
  const vitrinBtn = vSahip ? '<span class="oz-vit-tag sahip">✓ SAHİPSİN</span>'
    : vSirada ? `<button class="oz-vit-al" data-act="ozelVarlik" data-arg="${vitS.kat}" ${oz.nakit < vFiyat ? 'disabled' : ''} data-tip="${oz.nakit < vFiyat ? 'Nakit yetersiz — kişisel servet lazım' : 'Kişisel servetten ödenir · pasifi hemen işler'}">✍ SATIN AL · ₺${vFiyat}mn</button>`
      : `<span class="oz-vit-tag kilit">🔒 Önce ${esc(VV.adlar[vLv] || '')} (Sv.${vLv + 1})</span>`;
  // AKORDEON MAĞAZA: seçili kategori açılır, kademeler ADLARIYLA listelenir (rakam çipi yok).
  // SABİT İSKELET: liste kabı sabit yükseklikte — hangi kategori açık olursa olsun panel boyu değişmez.
  const magaza = Object.entries(VARLIK).map(([k, V]) => {
    const lv = oz.varlik[k] || 0;
    const acik = vitS.kat === k;
    // YAN YANA KARTLAR (kullanıcı kuralı): kademeler 2×2 ızgarada isimleriyle — dikey liste sığmıyordu
    const tiers = V.adlar.map((ad, i) => {
      const durum = i < lv ? 'sahip' : i === lv ? 'sirada' : 'kilit';
      const sag = i < lv ? '✓ sahipsin' : i === lv ? `₺${V.fiyat[i]}mn` : '🔒 kilitli';
      return `<button class="oz-vt ${durum} ${acik && vIdx === i ? 'aktif' : ''}" data-act="vitrin" data-arg="${k}|${i}" data-tip="${esc(ad)} — ${i < lv ? 'vitrinde izle' : i === lv ? 'sıradaki yükseltme · vitrinde izle' : 'önce alt kademe gerekir'}">
        <span class="oz-vt-ust"><i class="oz-vt-nokta"></i><span class="oz-vt-ad">${esc(ad)}</span></span>
        <b>${sag}</b>
      </button>`;
    }).join('');
    return `<div class="oz-vk2 ${acik ? 'acik' : ''}">
      <div class="oz-vk2-bas" data-act="vitrin" data-arg="${k}|${Math.min(lv, V.adlar.length - 1)}" data-tip="${acik ? esc(V.ad) + ' vitrinde' : esc(V.ad) + ' koleksiyonunu aç'}">
        <span class="oz-mag-ik">${V.ik}</span>
        <div class="oz-vk-id"><b>${V.ad}</b><i>${lv ? 'Sv.' + lv + ' · ' + esc(V.adlar[lv - 1]) : 'henüz yok'}</i></div>
        <span class="oz-vk2-sag">${lv}/${V.adlar.length}${acik ? '' : ' ▸'}</span>
      </div>
      ${acik ? `<div class="oz-vt-liste">${tiers}</div>` : ''}
    </div>`;
  }).join('');
  const vitrinPanel = `<div class="sb-panel oz-vitrin-panel">
      <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">SHOWROOM · ${esc(VV.ad).toLocaleUpperCase('tr')}</span></div>
      <iframe class="oz-vitrin-frame" src="assets/showroom/${vScene}.html" title="Varlık Showroom" loading="lazy"></iframe>
      <div class="oz-vit-alt">
        <div class="oz-vit-id"><b>${esc(VV.adlar[vIdx])}</b><i>Sv.${vIdx + 1}${vPasif ? ' · ' + vPasif : ''}</i>${(VV.perk || [])[vIdx] ? `<span class="oz-vit-perk">◆ ${esc(VV.perk[vIdx])}</span>` : ''}</div>
        ${vitrinBtn}
      </div>
    </div>`;

  const davetler = Object.entries(DAVETLER).map(([id, D]) => {
    const cdKalan = Math.max(0, (oz.davetCd[id] || 0) - abs);
    const olmaz = !D.req(oz, G) ? D.reqTxt : cdKalan > 0 ? `takvim dolu (${cdKalan} hafta)` : oz.nakit < D.maliyet ? 'nakit yetersiz' : oz.g.enerji < 15 ? 'takat yok' : '';
    return `<div class="oz-davet">
      <div class="oz-davet-b"><b>${D.ik} ${esc(D.ad)}</b><i>₺${D.maliyet}mn · Enerji −${D.enerji} · ${esc(D.konuk)}</i><i class="oz-davet-oz">${esc(D.ozet)}</i></div>
      <button data-act="ozelDavet" data-arg="${id}" ${olmaz ? 'disabled' : ''} data-tip="${olmaz || 'Düzenle — etkisi hemen işler'}">DÜZENLE ›</button>
    </div>`;
  }).join('');

  // AKTİF İMTİYAZLAR — sahip olunan varlıkların ÇALIŞAN etkileri tek şeritte (motorla aynı kaynak)
  const perkler = varlikPerkleri(oz);
  const perkSerit = perkler.length
    ? perkler.map((p) => `<span class="oz-perk">${p.ik} ${esc(p.txt)}</span>`).join('')
    : '<span class="oz-perk bos">varlık aldıkça etkileri burada birikir — her kademenin gerçek bir imtiyazı var</span>';
  return `<div class="oz-servet-serit sb-panel">
      <div class="oz-ss-hucre"><i>HARCANABİLİR NAKİT</i><b class="oz-nakit">₺${fm(oz.nakit)}mn</b></div>
      <div class="oz-ss-hucre"><i>TOPLAM VARLIK</i><b>₺${fm(toplam)}mn</b></div>
      <div class="oz-ss-hucre"><i>HAFTALIK GELİR</i><b class="pos">+₺${fm(gelir)}mn</b></div>
      <div class="oz-ss-perk"><i>AKTİF İMTİYAZLAR <span class="sb-muted">(${perkler.length})</span></i><div class="oz-perk-akis">${perkSerit}</div></div>
      <div class="oz-ss-bagis"><i>KULÜBE DESTEK <span class="sb-muted">(sezonda 3 · kalan ${bagisKalan})</span></i><div>${bagisBtn}</div></div>
    </div>
    <div class="oz-grid oz-grid-vitrin">
      <div class="oz-kol">
        <div class="sb-panel">
          <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">VARLIK MAĞAZASI</span><span class="sb-panel-r">kişisel servetten</span></div>
          <div class="oz-vk-liste">${magaza}</div>
        </div>
        <div class="sb-panel">
          <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">DAVET ORGANİZE ET</span><span class="sb-panel-r">${oz.davetToplam} davet verildi</span></div>
          ${davetler}
        </div>
      </div>
      <div class="oz-kol">
        ${vitrinPanel}
      </div>
    </div>`;
}
