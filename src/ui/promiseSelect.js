// src/ui/promiseSelect.js — AÇILIŞ ZİNCİRİ Sahne 2+3.
// S2: risk hiyerarşisi (zorluk 4-5 BÜYÜK kart + "BÜYÜK OYUN" rozeti, 1-2 kompakt) ·
// bedel/getiri fısıltısı · çelişki uyarısı (conflicts) · rakip gölgesi kulisi · tek cümle açıklama.
// S3: direktif DİYALOĞA döner — GM kartı konuşur (9 kombinasyon), bütçe butonlarında gerçek rakam.
import { TUNING } from '../config.js';
import { isSelectable } from '../engines/promises.js';
import { esc, stars, fmt } from './frame.js';
import { sbTopbar } from './cockpit.js';

const kisaAd = (n) => String(n || '').split(' ').slice(0, 2).join(' '); // sözleşme slotu için kısa ad

// S2b: bedel/getiri fısıltısı — kartta TEK satır (tek ekran disiplini), tam metin hover tooltip'te
function bedelSatiri(diff) {
  if (diff >= 4) return 'verirsen: tribün ayağa kalkar, kongre coşar · tutmazsan: sandıkta ağır bir koz, sicilinde kalıcı bir leke';
  if (diff === 3) return 'verirsen: umut yükselir, gözler üstünde olur · tutmazsan: rakibin eline sağlam bir malzeme';
  return 'verirsen: mütevazı ama sağlam bir söz · tutmazsan: birkaç sitem, o kadar';
}
// Sözün oy etkisi: tutulursa +k, tutulmazsa −c (zorluğa göre)
function oyDegeri(diff) {
  return ({ 5: { k: 10, c: 14 }, 4: { k: 8, c: 12 }, 3: { k: 5, c: 6 }, 2: { k: 4, c: 3 }, 1: { k: 3, c: 2 } })[diff] || { k: 4, c: 4 };
}
// ŞU AN → HEDEF: sözün somut hedefi (mevcut duruma göre) — oyuncu "ne kadar zor?" sorusunu bakar bakmaz anlar
function hedefMetni(G, p) {
  const eco = G.economy || {}, fac = G.facilities || {}, club = G.club || {};
  const star80 = (G.squad || []).filter((x) => x.overall >= 80).length;
  const kd = Math.round(club.kadroDeger || 0);
  return ({
    P01: 'Kupa: — → Şampiyonluk',
    P02: `Borç: ${Math.round(eco.borc || 0)}mn → ${Math.round((eco.borc || 0) / 2)}mn`,
    P03: `Stadyum: Lv${fac.stadyum} → Lv${fac.stadyum + 2}`,
    P04: `Kadro: ${kd}mn → ${Math.round(kd * 1.25)}mn`,
    P05: `Akademi: Lv${fac.akademi} → Lv${fac.akademi + 2} + genç`,
    P06: `Antrenman: Lv${fac.antrenman} → Lv${fac.antrenman + 2}`,
    P07: `Stadyum: Lv${fac.stadyum} → Lv${fac.stadyum + 1} + bilet ≤1.2×`,
    P08: `Sağlık: Lv${fac.tibbi} → Lv${fac.tibbi + 2}`,
    P09: 'Teknik ekip skoru: → 75+',
    P10: 'Sosyal proje: 0 → 3',
    P11: 'Kadın takımı: yok → kuruldu',
    P12: 'Akademiden çıkan: → en az 1',
    P13: `Gözlemci ağı: Lv${fac.scout} → Lv3+`,
    P14: `Taraftar: ${Math.round((club.fanCount || 0) / 1000)}b → ${Math.round(((club.fanCount || 0) * 1.15) / 1000)}b`,
    P15: 'Maaş/gelir: %55 altına',
    P16: 'Haftalık ticari gelir: +%25',
    P19: 'Müzeye 1 kayıt ya da 6 defter anı',
    P20: 'Yurt dışı ofis: 0 → 1',
    P21: `80+ güç transfer: ${star80} → ${star80 + 1}`,
    P22: 'Teknik ekip: → yıldız kalibre (75+)',
    P23: 'Küme hattına düşme (dönem boyu)',
    P24: 'Bilete zam: yok (dönem boyu)',
  })[p.id] || condTr(p);
}
// Kategoriler (22 söz 4 gruba bölünür → ekranda tek seferde 5-7 kart)
const PROMISE_CAT = {
  P01: 'sportif', P23: 'sportif', P21: 'sportif', P22: 'sportif', P09: 'sportif',
  P02: 'mali', P04: 'mali', P15: 'mali', P16: 'mali',
  P03: 'tesis', P06: 'tesis', P08: 'tesis', P05: 'tesis', P13: 'tesis', P12: 'tesis',
  P07: 'camia', P10: 'camia', P11: 'camia', P14: 'camia', P19: 'camia', P20: 'camia', P24: 'camia',
};
const CAT_TR = { sportif: 'Sportif', mali: 'Mali', tesis: 'Tesis & Altyapı', camia: 'Camia & Marka' };
const CAT_ORDER = ['sportif', 'mali', 'tesis', 'camia'];
// Rakip adayın kuliste hazırladığı söz → promise (aynısını seçersen "elinden aldın")
const RIVAL_PROMISE = { 'şampiyonluk': 'P01', 'borçsuz kulüp': 'P02', 'stadyum yatırımı': 'P03' };
// Sinerji çiftleri: biri seçilince diğerinin kenarı altın parlar
const SYNERGY = { P05: ['P12'], P12: ['P05'], P03: ['P07'], P07: ['P03'], P13: ['P21'], P21: ['P13'], P09: ['P22'], P22: ['P09'] };
// GM'in kulüp durumuna göre tek söz tavsiyesi (yeni oyuncuya yön verir)
function gmOneri(G) {
  const eco = G.economy || {}, club = G.club || {};
  if ((eco.borc || 0) >= 30 && (eco.borc || 0) >= (club.kadroDeger || 0) * 0.5) return `Borç ${Math.round(eco.borc)}mn — kongre bunu konuşacak, siz de konuşun.`;
  if (club.beklenti === 'sampiyonluk') return 'Bu camia kupa bekliyor; sportif bir söz olmadan sandık zor.';
  if (club.beklenti === 'kumede_kal') return 'Önce ligde kalmayı vaat edin; gerisi lüks.';
  return 'Az ama tutulabilir söz, çok ama havada kalandan iyidir.';
}

export function render(G) {
  const sel = G._sel || [];
  const full = sel.length >= TUNING.MAX_PROMISES;
  const step = G._setupStep || 1;
  if (step === 1) {
    // Seçili sözlerin çelişki/sinerji kümeleri (görsel karşılık)
    const conflictSet = new Set(), synergySet = new Set();
    for (const id of sel) {
      const meta = G.data.promises.find((x) => x.id === id);
      (meta && meta.conflicts || []).forEach((c) => conflictSet.add(c));
      (SYNERGY[id] || []).forEach((s) => synergySet.add(s));
    }
    const rivalPid = RIVAL_PROMISE[G.rakipKulis];
    const card = (p) => {
      const locked = !isSelectable(G, p.id);
      const on = sel.includes(p.id) && !locked;
      const conflict = !on && conflictSet.has(p.id);
      const synergy = !on && !conflict && synergySet.has(p.id);
      const dim = !locked && !conflict && full && !on;
      const disabled = locked || conflict;
      const oy = oyDegeri(p.difficulty);
      const dots = Array.from({ length: 5 }, (_, i) => `<span class="sb-dot ${i < p.difficulty ? 'is-on' : ''}"></span>`).join('');
      const hedef = conflict ? 'Çelişki: seçili bir sözle çakışıyor' : locked ? lockReason(p.id) : hedefMetni(G, p);
      const cls = ['sb-prom', on ? 'is-active' : '', locked ? 'is-locked' : '', conflict ? 'is-conflict' : '', (synergy && !dim) ? 'is-synergy' : '', dim ? 'is-dim' : ''].filter(Boolean).join(' ');
      return `<button class="${cls}" data-act="togglePromise" data-arg="${p.id}" ${disabled ? 'disabled' : ''} data-tip="${esc(bedelSatiri(p.difficulty))}">
        ${p.difficulty >= 4 ? '<span class="sb-gamble">BÜYÜK KUMAR</span>' : ''}
        ${on ? '<span class="sb-check"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5l4 4 8-9"/></svg></span>' : ''}
        <div class="sb-prom-t">${esc(p.name)}</div>
        <div class="sb-prom-c">${esc(hedef)}</div>
        <div class="sb-prom-f"><div class="sb-dots">${dots}</div><div class="sb-prom-tags"><span class="sb-tag-pos">+${oy.k}</span><span class="sb-tag-neg">△${oy.c}</span></div></div>
        ${on && rivalPid === p.id ? '<span class="sb-caldi">Sözünü elinden aldın</span>' : ''}
        ${locked ? '<div class="sb-lock">SÖZ GEREKMEZ</div>' : ''}
      </button>`;
    };
    const sections = CAT_ORDER.map((cat) => {
      const ps = G.data.promises.filter((p) => (PROMISE_CAT[p.id] || 'camia') === cat);
      if (!ps.length) return '';
      return `<div class="sb-cat"><div class="sb-cat-h"><span class="sb-tick"></span><span class="sb-cat-t">${esc(CAT_TR[cat].toLocaleUpperCase('tr-TR'))}</span><span class="sb-cat-n">· ${ps.length} söz</span><span class="sb-cat-line"></span></div><div class="sb-cat-grid">${ps.map(card).join('')}</div></div>`;
    }).join('');
    // Sağ sözleşme paneli: slotlar + tribün umudu + kulis + GM + çelişki
    const slotlar = Array.from({ length: TUNING.MAX_PROMISES }, (_, i) => {
      const id = sel[i]; const p = id && G.data.promises.find((x) => x.id === id);
      return p
        ? `<div class="sb-slot is-filled"><span class="sb-slot-n">${i + 1}</span><span>${esc(kisaAd(p.name))}</span></div>`
        : `<div class="sb-slot"><span class="sb-slot-n">${i + 1}</span><span>Mühür yeri boş</span></div>`;
    }).join('');
    let celiski = null;
    for (const id of sel) {
      const meta = G.data.promises.find((x) => x.id === id);
      const kes = (meta && meta.conflicts || []).find((c) => sel.includes(c));
      if (kes) { celiski = `${G.gm?.name || 'GM'}: "${meta.name} derken ${(G.data.promises.find((x) => x.id === kes) || {}).name}… Aynı kasadan iki kere para çıkmaz Başkanım."`; break; }
    }
    const hopeSum = sel.reduce((a, id) => { const p = G.data.promises.find((x) => x.id === id); return a + (p ? p.difficulty : 0); }, 0);
    const hopePct = Math.min(100, Math.round((hopeSum / 12) * 100)); // ~3 zor söz = dolu
    const hopeNote = hopePct < 34 ? 'Risk almadın — coşku zayıf' : hopePct < 70 ? 'Dengeli — tribün izliyor' : 'Tribün ayakta';
    const rivalWhisper = rivalPid && sel.includes(rivalPid) ? ' <b class="sb-pos-ink">Sözünü elinden aldın!</b>' : rivalPid ? ' <span class="sb-muted">Aynı sözü sen verirsen kozu zayıflar.</span>' : '';
    const gmName = G.gm?.name || 'Ferda Koyuncu';
    return `<div class="sb-root sb-cinematic">
      <div class="sb-atmo"></div><div class="sb-vignette"></div>
      ${sbTopbar(G, { back: { label: '‹ Kulüp seçimi', act: 'setupToClub' } })}
      <div class="sb-body sb-body-col">
        <div class="sb-page-head">
          <div>
            <div class="sb-crumb">DÖNEM BAŞI · 1/2 · SANDIK SÖZÜ</div>
            <div class="sb-h1row"><h1 class="sb-h1">Sözünü Ver</h1><span class="sb-quote-i" data-tip="Söz verdiğin yolda atılan her adım tribünde karşılık bulur; adım atılmayan söz sezon sonunda kuliste kaynar.">En fazla ${TUNING.MAX_PROMISES} söz. Tutarsan alkış, tutmazsan sandıkta koz.</span></div>
          </div>
          <div class="sb-count"><span>SEÇİLEN</span><b>${sel.length}</b><span class="sb-muted">/ ${TUNING.MAX_PROMISES}</span></div>
        </div>
        <div class="sb-two">
          <div class="sb-board">${sections}</div>
          <aside class="sb-side">
            <div class="sb-panel">
              <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">SÖZLEŞME</span></div>
              <div class="sb-slots">${slotlar}</div>
              <div class="sb-meter">
                <div class="sb-meter-h"><span>TRİBÜN UMUDU</span><b class="sb-club-ink">%${hopePct}</b></div>
                <div class="sb-bar"><span class="sb-bar-fill" style="width:${hopePct}%"></span></div>
                <div class="sb-meter-note">${esc(hopeNote)}</div>
              </div>
            </div>
            <div class="sb-panel sb-panel-grow">
              <div class="sb-gm"><span class="sb-gm-av">${esc(gmName[0])}</span><div><div class="sb-gm-name">${esc(gmName)}</div><div class="sb-gm-role">Genel Menajer (GM)</div></div></div>
              <p class="sb-quote">${esc(gmOneri(G))}</p>
              ${G.rakipKulis ? `<div class="sb-whisper"><span class="sb-whisper-t">Kuliste fısıltı:</span> Rakip aday "<b>${esc(G.rakipKulis)}</b>" diyecek.${rivalWhisper}</div>` : ''}
              ${celiski ? `<div class="sb-conflict-note">⚠ ${esc(celiski)}</div>` : ''}
            </div>
          </aside>
        </div>
      </div>
      <footer class="sb-bottombar">
        <div class="sb-bb-l"><span class="sb-bb-k">SANDIK SÖZÜ</span><span class="sb-bb-note">${sel.length} söz seçildi · tribün umudu %${hopePct}.</span></div>
        <button class="sb-btn sb-btn-primary" data-act="devam">Sözleri Mühürle (${sel.length}/${TUNING.MAX_PROMISES}) → Direktif ▸</button>
      </footer>
    </div>`;
  }
  // ── S3: Adım 2/2 — MAKAM ODASI: seçimin ertesi sabahı GM ile İLK TOPLANTI (diyalog) ──
  const dir = G._dir || { budgetKey: 'orta', line: 'hazir' };
  const cl = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const rakam = (k) => Math.round(G.economy.kasa * (TUNING.APPROVAL.BUDGET_PRESET[k] ?? 0.5));
  const gmAd = G.gm?.name || 'Genel Menajer';
  const gmSkill = G.gm?.skill ?? 60;
  const gmKarakter = gmSkill >= 75 ? 'Piyasayı avucunun içi gibi bilir. Aradığı menajer telefonu ilk çalışta açar.'
    : gmSkill >= 55 ? 'İşini bilir, tanıdığı da vardır. Yıldız getirmez ama yanıltmaz.'
      : 'Hevesli, ama çevresi dar. Getirdiği her dosyayı iki kere oku.';
  const beklentiSoz = { kumede_kal: 'küme hattından uzak durmak', ust_yari: 'üst yarıya oturmak', sampiyonluk: 'kupayı kaldırmak' }[G.club?.beklenti] || 'adam gibi bir sezon';
  const acilisSoz = `Hayırlı olsun Başkanım. Tablo şu: kasada ${fmt(G.economy.kasa)} milyon, sırtımızda ${fmt(G.economy.borc)} milyon borç. Kurul da ${beklentiSoz} diyor. Transfer masası bende — sizden sadece iki cümle bekliyorum: kesem ne kadar, gözüm kimde olsun?`;
  const soz = ((G.data.media || {}).gmDirektif || {})[`${dir.budgetKey}|${dir.line}`] || 'Siz çerçeveyi çizin Başkanım, gerisi bana ait.';
  const bReplik = { dusuk: 'Bu rakamı bir kuruş geçme. Kasa kimseye ihale değil.', orta: 'Ne cimri ol ne savurgan. Ölçüyü tuttur.', yuksek: 'Gerekeni harca. Hesabını sonra veririz — verirsek.' };
  const lReplik = { genc: 'Genç olsun, aç olsun. Bugünü değil yarını alıyoruz.', hazir: 'Bana pişmiş adam getir. Deneme yapacak vaktimiz yok.', yildiz: 'Bir isim getir ki gelişi manşet olsun, tribün yerinden oynasın.' };
  // 3. KARAR — "Basına ne diyeyim?" (beklenti yönetimi: iddia kurul hedefini OYNATIR)
  const pReplik = { alcak: 'Hedefimiz sağlam bir sezon — fazlası söz değil, iştir.', iddiali: 'Bu sene kimseye eyvallahımız yok.', sessiz: 'Konuşmayı sahaya bırakıyorum.' };
  const pFx = { alcak: '<b class="p">+ Kurul rahat (hedef sıra ↓)</b><b class="m">− Tribün heyecansız</b>', iddiali: '<b class="p">+ Tribün coşar</b><b class="m">− Kurul hedefi YÜKSELTİR</b>', sessiz: '<b class="n">± Etki yok · basın seni sıkıştırır (medya izi)</b>' };
  const pAd = { alcak: 'Alçakgönüllü', iddiali: 'İddialı', sessiz: 'Sessiz kal' };
  const bFx = { dusuk: '<b class="p">+ Kurul rahatlar</b><b class="m">− Tribün somurtur</b>', orta: '<b class="n">± Yan etki yok</b>', yuksek: '<b class="p">+ Tribün coşar</b><b class="m">− Kurul huzursuz</b>' };
  const lFx = { genc: '<b class="p">+ Kadro değeri uzun vadede ↑</b><b class="m">− Bu sezon güç kazancı düşük</b>', hazir: '<b class="n">± Bugünü alırsın, yarını değil</b>', yildiz: '<b class="p">+ Tribün coşar, marka ↑</b><b class="m">− Maaş yükü ağır, tek atış</b>' };
  const lDosya = { genc: '17-21 yaş · güç 50-62', hazir: '24-28 yaş · güç 65-72', yildiz: '1 isim · güç 78-85 · maaş yüksek' };
  // Karar butonları — replik yalnızca SEÇİLİ kartta (gürültü azalır); profil kartında "gelecek dosyalar"
  // DERLİ TOPLU: her kartın iskeleti SABİT (başlık → fx → replik alanı) — replik alanı
  // seçili değilken de yer tutar (boş <i>) → kart yükseklikleri asla tırtıklanmaz.
  const bBtn = (k, label) => `<button class="btn replik ${dir.budgetKey === k ? 'on' : ''}" data-act="dirBudget" data-arg="${k}">
      <span class="rk-ad">${label} <span class="muted tnum">≈${fmt(rakam(k))}mn</span></span>
      <span class="dir-fx">${bFx[k]}</span><i>${dir.budgetKey === k ? `«${bReplik[k]}»` : ''}</i></button>`;
  const lBtn = (k, label) => `<button class="btn replik ${dir.line === k ? 'on' : ''}" data-act="dirLine" data-arg="${k}">
      <span class="rk-ad">${label}</span><span class="dir-dosya">📁 ${lDosya[k]}</span>
      <span class="dir-fx">${lFx[k]}</span><i>${dir.line === k ? `«${lReplik[k]}»` : ''}</i></button>`;
  const press = dir.press || 'sessiz';
  const pBtn = (k) => `<button class="btn replik ${press === k ? 'on' : ''}" data-act="dirPress" data-arg="${k}">
      <span class="rk-ad">${pAd[k]}</span>
      <span class="dir-fx">${pFx[k]}</span><i>${press === k ? `«${pReplik[k]}»` : ''}</i></button>`;
  // CANLI SONUÇ önizlemesi — DEĞİŞENLER vurgulu (+delta), değişmeyenler SOLUK; kasa dili
  // "harcandı" değil "AYRILDI" (henüz transfer yok — kese ayrılıyor)
  const budgetCap = rakam(dir.budgetKey);
  const kasaSonra = Math.round(G.economy.kasa - budgetCap);
  const promiseHope = sel.reduce((a, id) => { const p = G.data.promises.find((x) => x.id === id); return a + (p ? p.difficulty * TUNING.HOPE_MULT : 0); }, 0);
  const maliNow = Math.round(G.gauges.mali), maliSonra = cl(maliNow + (dir.budgetKey === 'dusuk' ? 4 : dir.budgetKey === 'yuksek' ? -4 : 0), 0, 100);
  const tarNow = Math.round(G.gauges.taraftar), tarSonra = cl(Math.round(tarNow + promiseHope + (dir.budgetKey === 'yuksek' ? 3 : 0) + (press === 'iddiali' ? 2 : 0)), 0, 92);
  const hedefNow = G.club.hedefSira, hedefSonra = press === 'iddiali' ? Math.max(1, hedefNow - 1) : press === 'alcak' ? Math.min(17, hedefNow + 1) : hedefNow;
  const kasaTehlike = kasaSonra < 10;
  const dRow = (ad, now, sonra, unit = '', tip = '') => {
    const d = Math.round(sonra - now);
    const ar = d > 0 ? `<span class="pos">(+${d})</span>` : d < 0 ? `<span class="neg">(${d})</span>` : '';
    return `<div class="onizleme-satir ${d === 0 ? 'sonuk' : ''}"${tip ? ` data-tip="${esc(tip)}"` : ''}><span>${ad}</span><b class="tnum">${now}${unit} → ${sonra}${unit} ${ar}</b></div>`;
  };
  // GM çelişki İTİRAZI / ONAYI — verdiğin sözlerle seçimini bağlar
  const disiplin = sel.includes('P15') || sel.includes('P02');
  let gmUyari = '', gmUyariCls = '';
  if (disiplin && dir.budgetKey === 'yuksek') { gmUyari = `Başkanım, daha dün ${sel.includes('P15') ? 'kasada delik bırakmayacağım' : 'borcu indireceğim'} dediniz. Tutanağa ikisini birden yazamam.`; gmUyariCls = 'itiraz'; }
  else if (disiplin && dir.budgetKey === 'dusuk') { gmUyari = 'Sözünüzün arkasında durdunuz — kurul bunu görür, itibarınıza yazılır.'; gmUyariCls = 'onay'; }
  else if (sel.includes('P21') && dir.line === 'yildiz') { gmUyari = 'Söz verdiğiniz gibi yıldız avındayız; tutanak tutarlı, hoşuma gitti.'; gmUyariCls = 'onay'; }
  else if (kasaTehlike) { gmUyari = "Bu rakamla Şubat'ta maaş sıkıntısı çekeriz Başkanım, şimdiden söyleyeyim."; gmUyariCls = 'itiraz'; }
  // GM yetenek çubukları — Ağ / Pazarlık / Göz (tooltip: neyi etkilediği yazar)
  const bars = [
    ['Ağ', cl(gmSkill + 8, 5, 99), 'Gelen dosyaların kalitesi — ağı genişse iyi isimler masaya düşer'],
    ['Pazarlık', cl(gmSkill - 6, 5, 99), 'Şartlı pazarlıkta bedeli kırma şansı'],
    ['Göz', cl(gmSkill + 1, 5, 99), 'Dosyalardaki güç sisinin darlığı — göz keskinse yanılmazsın'],
  ];
  const barHtml = bars.map(([k, v, tip]) => `<div class="gm-bar" data-tip="${esc(tip)}"><span>${k}</span><div class="track"><div class="fill" style="width:${v}%"></div></div></div>`).join('');
  // Mühürlü sözler — madde madde (tek paragraf değil)
  const sozMad = sel.length ? sel.map((id) => `<div class="tut-soz">▸ ${esc((G.data.promises.find((x) => x.id === id) || {}).name || id)}</div>`).join('') : '<div class="muted" style="font-size:11px">Söz yok — "Laf değil, iş" düşülecek.</div>';
  const lineTr = { genc: 'gençlik yatırımı', hazir: 'pişmiş adam', yildiz: 'yıldız avı' }[dir.line] || dir.line;
  // Etki metinleri (yapısal — pos/neg/neu) — Design sb-eff satırlarına dökülür
  const EFF = {
    budget: { dusuk: { pos: 'Kurul rahatlar', neg: 'Tribün somurtur' }, orta: { neu: 'Yan etki yok' }, yuksek: { pos: 'Tribün coşar', neg: 'Kurul huzursuz' } },
    line: { genc: { pos: 'Kadro değeri uzun vadede ↑', neg: 'Bu sezon güç kazancı düşük' }, hazir: { neu: 'Bugünü alırsın, yarını değil' }, yildiz: { pos: 'Tribün coşar, marka ↑', neg: 'Maaş yükü ağır, tek atış' } },
    press: { alcak: { pos: 'Kurul rahat (hedef sıra ↓)', neg: 'Tribün heyecansız' }, iddiali: { pos: 'Tribün coşar', neg: 'Kurul hedefi YÜKSELTİR' }, sessiz: { neu: 'Etki yok · basın sıkıştırır' } },
  };
  const effHtml = (e) => `${e.pos ? `<div class="sb-eff-pos">＋ ${esc(e.pos)}</div>` : ''}${e.neg ? `<div class="sb-eff-neg">－ ${esc(e.neg)}</div>` : ''}${e.neu ? `<div class="sb-eff-neu">± ${esc(e.neu)}</div>` : ''}`;
  // replik alanı HER KARTTA yer tutar (seçili değilken boş) → seçince kart yüksekliği DEĞİŞMEZ (kayma/kesilme yok)
  const sbOpt = (act, grp, k, on, label, detail, replik) => `<button class="sb-opt ${on ? 'is-active' : ''}" data-act="${act}" data-arg="${k}">
      <div class="sb-opt-t">${esc(label)}</div><div class="sb-opt-m">${esc(detail)}</div><div class="sb-opt-eff">${effHtml(EFF[grp][k])}</div><div class="sb-opt-q">${on ? '«' + esc(replik) + '»' : ''}</div></button>`;
  const pDetail = { alcak: 'düşük profil', iddiali: 'yüksek beklenti', sessiz: 'konuşma yok' };
  const kvDelta = (now, sonra) => { const d = Math.round(sonra - now); return d > 0 ? ` <span class="pos">(+${d})</span>` : d < 0 ? ` <span class="neg">(${d})</span>` : ''; };
  const gmInitials = gmAd.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toLocaleUpperCase('tr-TR');
  const ferdaCls = gmUyariCls === 'itiraz' ? 'itiraz' : '';
  return `<div class="sb-root sb-cinematic">
    <div class="sb-atmo"></div><div class="sb-vignette"></div>
    <div class="sb-body sb-body-col sb-pad">
      <div class="sb-page-head sb-tight">
        <button class="sb-back" data-act="setupBack">← Sözleri bir daha göreyim</button>
        <span class="sb-crumb">DÖNEM BAŞI · 2/2 · MAKAM ODASI</span>
      </div>
      <div class="sb-h1row"><span class="sb-h1-bar"></span><h1 class="sb-h1 sb-h1-lg">${esc(gmAd)} kapıyı çaldı. Koltuğun altında bir dosya var.</h1></div>
      <div class="sb-three">
        <aside class="sb-gm-card">
          <span class="sb-gm-av sb-gm-av-lg">${esc(gmInitials)}</span>
          <div class="sb-gm-name sb-fs-h1">${esc(gmAd)}</div>
          <div class="sb-gm-role sb-club-ink">GENEL MENAJER (GM)</div>
          <p class="sb-gm-desc">${esc(gmKarakter)}</p>
          <div class="sb-gm-stats">${bars.map(([k, v, tip]) => `<div class="sb-gm-stat" data-tip="${esc(tip)}"><span>${esc(k)}</span><div class="sb-bar"><span class="sb-bar-fill" style="width:${v}%"></span></div></div>`).join('')}</div>
          <p class="sb-gm-foot">Dosyayı o getirir, kalemi sen tutarsın. Transferi sen yapmazsan — <b class="sb-club-ink">ONAYLARSIN.</b></p>
        </aside>
        <div class="sb-dmid">
          <div class="sb-brief">${esc(acilisSoz)}</div>
          <div><div class="sb-dgroup-h">“KESE NE KADAR AÇILSIN?”</div><div class="sb-dgroup-grid">
            ${sbOpt('dirBudget', 'budget', 'dusuk', dir.budgetKey === 'dusuk', `Kemer Sıkı ≈${fmt(rakam('dusuk'))}mn`, `${fmt(rakam('dusuk'))} milyon kese`, bReplik.dusuk)}
            ${sbOpt('dirBudget', 'budget', 'orta', dir.budgetKey === 'orta', `Ölçülü ≈${fmt(rakam('orta'))}mn`, `${fmt(rakam('orta'))} milyon kese`, bReplik.orta)}
            ${sbOpt('dirBudget', 'budget', 'yuksek', dir.budgetKey === 'yuksek', `Kese Ağzı Açık ≈${fmt(rakam('yuksek'))}mn`, `${fmt(rakam('yuksek'))} milyon kese`, bReplik.yuksek)}
          </div></div>
          <div><div class="sb-dgroup-h">“GÖZÜM KİMDE OLSUN?”</div><div class="sb-dgroup-grid">
            ${sbOpt('dirLine', 'line', 'genc', dir.line === 'genc', 'Gençlere yatır', lDosya.genc, lReplik.genc)}
            ${sbOpt('dirLine', 'line', 'hazir', dir.line === 'hazir', 'Hazır adam', lDosya.hazir, lReplik.hazir)}
            ${sbOpt('dirLine', 'line', 'yildiz', dir.line === 'yildiz', 'Bana yıldız bul', lDosya.yildiz, lReplik.yildiz)}
          </div></div>
          <div><div class="sb-dgroup-h">“BASINA NE DİYEYİM?”</div><div class="sb-dgroup-grid">
            ${sbOpt('dirPress', 'press', 'alcak', press === 'alcak', pAd.alcak, pDetail.alcak, pReplik.alcak)}
            ${sbOpt('dirPress', 'press', 'iddiali', press === 'iddiali', pAd.iddiali, pDetail.iddiali, pReplik.iddiali)}
            ${sbOpt('dirPress', 'press', 'sessiz', press === 'sessiz', pAd.sessiz, pDetail.sessiz, pReplik.sessiz)}
          </div></div>
          <div class="sb-ferda-line">${esc(soz)}</div>
          ${gmUyari ? `<div class="sb-ferda-line ${ferdaCls}"><b>${esc(gmAd)}:</b> ${esc(gmUyari)}</div>` : ''}
        </div>
        <aside class="sb-side sb-side-narrow">
          <div class="sb-panel">
            <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">CANLI SONUÇ</span></div>
            <div class="sb-kv"${kasaTehlike ? ' style="color:var(--neg)"' : ''}><span>Kasa</span><b>${Math.round(G.economy.kasa)} − ${fmt(budgetCap)} → ${kasaSonra}mn</b></div>
            <div class="sb-kv"><span>Borç</span><b>${Math.round(G.economy.borc)}mn → ${Math.round(G.economy.borc)}mn</b></div>
            <div class="sb-kv"><span>Kurul</span><b>${maliNow} → ${maliSonra}${kvDelta(maliNow, maliSonra)}</b></div>
            <div class="sb-kv"><span>Taraftar</span><b>${tarNow} → ${tarSonra}${kvDelta(tarNow, tarSonra)}</b></div>
            <div class="sb-kv"><span>Hedef sıra</span><b>${hedefNow}. → ${hedefSonra}.</b></div>
            <div class="sb-panel-h" style="margin-top:.9em"><span class="sb-tick"></span><span class="sb-panel-t">MÜHÜRLÜ SÖZLER</span></div>
            <div class="sb-side-note">${sel.length ? `${sel.length} söz mühürlü — “${esc((G.data.promises.find((x) => x.id === sel[0]) || {}).name || '')}”${sel.length > 1 ? ` +${sel.length - 1}` : ''}` : 'Söz yok — “Laf değil, iş.” düşülecek.'}</div>
            ${kasaTehlike ? '<div class="sb-conflict-note">⚠ Kasa kritik — Şubat’ta maaş sıkıntısı riski</div>' : ''}
          </div>
        </aside>
      </div>
      <div class="sb-contract">
        <div class="sb-contract-h">DÖNEM SÖZLEŞMESİ · TUTANAK — ${esc(G.club.name).toLocaleUpperCase('tr-TR')} · SEZON ${G.meta.season}</div>
        <div class="sb-contract-body">
          <div>
            <div class="sb-crow"><span>Transfer kesesi</span><i></i><b>≈${fmt(budgetCap)}mn</b></div>
            <div class="sb-crow"><span>Aranan profil</span><i></i><b>${esc(lineTr)}</b></div>
            <div class="sb-crow"><span>Basın hattı</span><i></i><b>${esc(pAd[press])}</b></div>
            <div class="sb-crow"><span>Genel Menajer</span><i></i><b>${esc(gmAd)}</b></div>
            <div class="sb-crow"><span>Kongreye verilen söz</span><i></i><b>${sel.length ? sel.length + ' madde' : '— yok —'}</b></div>
          </div>
          <div class="sb-contract-sign">
            <div class="sb-contract-q">${sel.length ? `“${esc((G.data.promises.find((x) => x.id === sel[0]) || {}).name || '')}”` : '“Laf değil, iş.”'}</div>
            <div class="sb-sign-row"><div><div class="sb-sign-line"></div><span class="sb-sign-k">${esc(G.baskan?.name || 'Başkan')} / İMZA</span></div><button class="sb-btn sb-btn-primary" data-act="muhurBas" data-tip="Tutanağı mühürle — dönem başlar (geri dönüşü yok)">● MÜHÜRLE</button></div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

// Deterministik düz-vektör avatar (isimden ten/saç) — GM (takım elbise) / oyuncu (kulüp forması)
function personAvatar(name, kind) {
  let h = 0; for (const c of String(name || '?')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const skins = ['#e8c9a8', '#d9b48c', '#c99b6e', '#a97c50', '#8a5a34'];
  const hairs = ['#2b2118', '#43301c', '#6b4b2f', '#1c1c1c', '#5a4a3a'];
  const skin = skins[h % skins.length], hair = hairs[(h >>> 3) % hairs.length]; // >>> işaretsiz: >> negatif indeks → undefined renk
  const govde = kind === 'gm' ? '#1e2740' : 'var(--club)';
  return `<span class="gm-portre"><svg viewBox="0 0 64 64" width="60" height="60" aria-hidden="true">
    <circle cx="32" cy="32" r="32" fill="var(--bg-3)"/>
    <path d="M12 64c0-12 9-19 20-19s20 7 20 19z" fill="${govde}"/>
    <circle cx="32" cy="27" r="12" fill="${skin}"/>
    <path d="M20 26a12 12 0 0 1 24 0c0-6-4-12-12-12s-12 6-12 12z" fill="${hair}"/>
    ${kind === 'gm' ? '<path d="M28 46l4 7 4-7-4-2z" fill="#b23b3b"/><path d="M23 46l9-3 9 3-2 5H25z" fill="#e9edf5" opacity=".9"/>' : '<path d="M24 46h16l-2 6H26z" fill="rgba(255,255,255,.14)"/>'}
  </svg></span>`;
}

// Sözün koşulu — İNSAN cümlesi (kod anahtarı/dev-speak yok). Hepsi kapsanır; boş fallback.
// EXPORT: kongre "Kürsüye Çık" butonlarının tooltip'i de AYNI sözlüğü kullanır (tek kaynak).
export function condTr(p) {
  return ({
    P01: 'Bir lig şampiyonluğu kaldır',
    P02: 'Borcu yarıya indir',
    P03: 'Stadı iki kademe büyüt',
    P04: 'Kadro değerini %25 artır',
    P05: 'Altyapıyı güçlendir, genç çıkar',
    P06: 'Antrenman tesisini iki kademe çıkar',
    P07: 'Maç günü deneyimini iyileştir',
    P08: 'Sağlık ekibini iki kademe çıkar',
    P09: 'Teknik ekibi tam kadro kur',
    P10: 'Mahalleye üç sosyal proje getir',
    P11: 'Kadın takımını kur',
    P12: 'Akademiden en az bir oyuncu çıkar',
    P13: 'Gözlemci ağını üç kademeye çıkar',
    P14: 'Kulübün marka değerini büyüt',
    P15: 'Maaşlar gelirin %55 altında kalsın',
    P16: 'Ticari geliri dörtte bir büyüt',
    P19: 'Kulüp müzesini aç',
    P20: 'Yurt dışında bir ofis aç',
    P21: 'Pencerede 80+ güç bir isim al',
    P22: 'Dönem sonunda GÜÇ 75+ teknik direktör görevde olsun (TD Pazarı yolu açık)',
    P23: 'Dönem boyu küme hattına düşme',
    P24: 'Dönem boyu bilete zam yapma',
  }[p.id]) || '';
}

function lockReason(id) {
  return ({
    P02: 'Kulübün zaten borcu yok — bu sözün alıcısı olmaz',
    P23: 'Bu camia küme derdinde değil — böyle bir söz gülünç kaçar',
  }[id]) || 'Şartlar tutmuyor — bu sözü şimdi veremezsin';
}
