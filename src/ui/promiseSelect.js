// src/ui/promiseSelect.js — AÇILIŞ ZİNCİRİ Sahne 2+3.
// S2: risk hiyerarşisi (zorluk 4-5 BÜYÜK kart + "BÜYÜK OYUN" rozeti, 1-2 kompakt) ·
// bedel/getiri fısıltısı · çelişki uyarısı (conflicts) · rakip gölgesi kulisi · tek cümle açıklama.
// S3: direktif DİYALOĞA döner — GM kartı konuşur (9 kombinasyon), bütçe butonlarında gerçek rakam.
import { TUNING } from '../config.js';
import { isSelectable } from '../engines/promises.js';
import { esc, stars, fmt } from './frame.js';

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
      const dim = locked || conflict || (full && !on);
      const disabled = locked || conflict;
      const oy = oyDegeri(p.difficulty);
      const dots = '●'.repeat(p.difficulty) + '○'.repeat(5 - p.difficulty);
      const altSatir = locked ? lockReason(p.id) : conflict ? 'Çelişki: seçili bir sözle çakışıyor' : hedefMetni(G, p);
      const boyCls = p.difficulty >= 4 ? 'vow--buyuk' : p.difficulty <= 2 ? 'vow--kompakt' : '';
      return `<button class="vow ${boyCls} ${on ? 'on' : ''} ${dim ? 'dim' : ''} ${conflict ? 'celisen' : ''} ${synergy ? 'sinerji' : ''}" data-act="togglePromise" data-arg="${p.id}" ${disabled ? 'disabled' : ''} data-tip="${esc(bedelSatiri(p.difficulty))}">
        ${p.difficulty >= 4 ? '<span class="rozet-buyuk">Büyük Kumar</span>' : ''}
        <div class="nm">${esc(p.name)}${locked ? ' 🔒' : ''}</div>
        <div class="vow-hedef">${esc(altSatir)}</div>
        <div class="vow-risk-row"><span class="vow-dots" data-tip="Risk (zorluk)">${dots}</span><span class="vow-oy"><b class="oy-arti">⚑+${oy.k}</b><b class="oy-eksi">⚠−${oy.c}</b></span></div>
        ${on && rivalPid === p.id ? '<span class="vow-caldi">Sözünü elinden aldın</span>' : ''}
        ${on ? '<span class="muhur-damga">MÜHÜRLENDİ</span>' : ''}
      </button>`;
    };
    const sections = CAT_ORDER.map((cat) => {
      const ps = G.data.promises.filter((p) => (PROMISE_CAT[p.id] || 'camia') === cat);
      if (!ps.length) return '';
      return `<div class="vow-kat"><div class="vow-kat-h">${CAT_TR[cat]} <span class="muted">· ${ps.length} söz</span></div><div class="vows">${ps.map(card).join('')}</div></div>`;
    }).join('');
    // Sağ sözleşme paneli: slotlar + tribün nabzı + kulis + GM tavsiyesi + çelişki
    const slotlar = Array.from({ length: TUNING.MAX_PROMISES }, (_, i) => {
      const id = sel[i]; const p = id && G.data.promises.find((x) => x.id === id);
      return p
        ? `<span class="chip muhur" style="border-color:var(--club);color:var(--club-2)">📜 ${esc(p.name)}</span>`
        : '<span class="chip slot-bos">◌ mühür yeri</span>';
    }).join('');
    let celiski = null;
    for (const id of sel) {
      const meta = G.data.promises.find((x) => x.id === id);
      const kes = (meta && meta.conflicts || []).find((c) => sel.includes(c));
      if (kes) { celiski = `${G.gm?.name || 'GM'}: "${meta.name} derken ${(G.data.promises.find((x) => x.id === kes) || {}).name}… Aynı kasadan iki kere para çıkmaz Başkanım."`; break; }
    }
    const hopeSum = sel.reduce((a, id) => { const p = G.data.promises.find((x) => x.id === id); return a + (p ? p.difficulty : 0); }, 0);
    const hopePct = Math.min(100, Math.round((hopeSum / 12) * 100)); // ~3 zor söz = dolu
    const gmTavsiye = gmOneri(G);
    return `<div class="vaat-sahne">
      <div class="vaat-topbar">
        <button class="btn" data-act="setupToClub" style="padding:4px 12px;font-size:12px">← Kulüp seçimine dön</button>
        <span class="vaat-ufuk">🗳 Kongre: 3 sezon sonra</span>
      </div>
      <div class="vaat-baslik"><div>
        <div class="overline">Dönem Başı · 1/2 · Sandık Sözü</div>
        <h2 style="margin:2px 0 0">Sözünü ver <span class="muted" style="font-size:13px;font-family:var(--font-body);font-weight:400;letter-spacing:0" data-tip="Söz verdiğin yolda atılan her adım tribünde karşılık bulur. Adım atılmayan sezonun sonunda ise kulis kaynar. Tutulan söz güven, taraftar ve oy getirir.">— En fazla ${TUNING.MAX_PROMISES} söz. Tutarsan alkış, tutmazsan sandıkta koz. <span class="micro">ⓘ</span></span></h2>
      </div></div>
      <div class="vaat-grid">
        <div class="vaat-sol">${sections}</div>
        <aside class="vaat-sag">
          <div class="overline">Sözleşme</div>
          <div class="sozlesme-slots">${slotlar}</div>
          <div class="tribun-nabiz"><span class="micro">Tribün umudu</span><div class="track"><div class="fill" style="width:${hopePct}%"></div></div><span class="micro" style="opacity:.7">${hopePct < 34 ? 'risk almadın — coşku zayıf' : hopePct < 70 ? 'dengeli' : 'tribün ayakta'}</span></div>
          ${G.rakipKulis ? `<div class="kulis-golge"><span class="micro" style="color:var(--neg)">Kuliste Fısıltı</span><br>Rakip aday "<b>${esc(G.rakipKulis)}</b>" diyecek.${rivalPid && sel.includes(rivalPid) ? ' <b class="pos">Sözünü elinden aldın!</b>' : rivalPid ? ' <span class="muted">Aynı sözü sen verirsen kozu zayıflar.</span>' : ''}</div>` : ''}
          ${gmTavsiye ? `<div class="gm-tavsiye">💬 <b>${esc(G.gm?.name || 'GM')}:</b> ${esc(gmTavsiye)}</div>` : ''}
          ${celiski ? `<div class="celiski-uyari">⚠ ${esc(celiski)}</div>` : ''}
        </aside>
      </div>
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
  const bFx = { dusuk: '<b class="p">+ Kurul rahatlar</b><b class="m">− Tribün somurtur</b>', orta: '<b class="n">± Yan etki yok</b>', yuksek: '<b class="p">+ Tribün coşar</b><b class="m">− Kurul huzursuz</b>' };
  const lFx = { genc: '<b class="p">+ Kadro değeri uzun vadede ↑</b><b class="m">− Bu sezon güç kazancı düşük</b>', hazir: '<b class="n">± Bugünü alırsın, yarını değil</b>', yildiz: '<b class="p">+ Tribün coşar, marka ↑</b><b class="m">− Maaş yükü ağır, tek atış</b>' };
  const lDosya = { genc: '17-21 yaş · güç 50-62', hazir: '24-28 yaş · güç 65-72', yildiz: '1 isim · güç 78-85 · maaş yüksek' };
  // Karar butonları — replik yalnızca SEÇİLİ kartta (gürültü azalır); profil kartında "gelecek dosyalar"
  const bBtn = (k, label) => `<button class="btn replik ${dir.budgetKey === k ? 'on' : ''}" data-act="dirBudget" data-arg="${k}">
      <span class="rk-ad">${label} <span class="muted tnum">≈${fmt(rakam(k))}mn</span></span>
      ${dir.budgetKey === k ? `<i>«${bReplik[k]}»</i>` : ''}<span class="dir-fx">${bFx[k]}</span></button>`;
  const lBtn = (k, label) => `<button class="btn replik ${dir.line === k ? 'on' : ''}" data-act="dirLine" data-arg="${k}">
      <span class="rk-ad">${label}</span><span class="dir-dosya">📁 Gelecek dosyalar: ${lDosya[k]}</span>
      ${dir.line === k ? `<i>«${lReplik[k]}»</i>` : ''}<span class="dir-fx">${lFx[k]}</span></button>`;
  // CANLI SONUÇ önizlemesi — kasa/kurul/taraftar: şu an → sonra (startTerm mantığıyla)
  const budgetCap = rakam(dir.budgetKey);
  const kasaSonra = Math.round(G.economy.kasa - budgetCap);
  const promiseHope = sel.reduce((a, id) => { const p = G.data.promises.find((x) => x.id === id); return a + (p ? p.difficulty * TUNING.HOPE_MULT : 0); }, 0);
  const maliNow = Math.round(G.gauges.mali), maliSonra = cl(maliNow + (dir.budgetKey === 'dusuk' ? 4 : dir.budgetKey === 'yuksek' ? -4 : 0), 0, 100);
  const tarNow = Math.round(G.gauges.taraftar), tarSonra = cl(Math.round(tarNow + promiseHope + (dir.budgetKey === 'yuksek' ? 3 : 0)), 0, 92);
  const kasaTehlike = kasaSonra < 10;
  const dRow = (ad, now, sonra, unit = '') => {
    const d = sonra - now, ar = d > 0 ? '<span class="pos">↑</span>' : d < 0 ? '<span class="neg">↓</span>' : '';
    const cls = ad === 'Kasa' && sonra < 10 ? 'neg' : '';
    return `<div class="onizleme-satir"><span>${ad}</span><b class="tnum ${cls}">${now}${unit} → ${sonra}${unit} ${ar}</b></div>`;
  };
  // GM çelişki İTİRAZI / ONAYI — verdiğin sözlerle seçimini bağlar
  const disiplin = sel.includes('P15') || sel.includes('P02');
  let gmUyari = '', gmUyariCls = '';
  if (disiplin && dir.budgetKey === 'yuksek') { gmUyari = `Başkanım, daha dün ${sel.includes('P15') ? 'kasada delik bırakmayacağım' : 'borcu indireceğim'} dediniz. Tutanağa ikisini birden yazamam.`; gmUyariCls = 'itiraz'; }
  else if (disiplin && dir.budgetKey === 'dusuk') { gmUyari = 'Sözünüzün arkasında durdunuz — kurul bunu görür, itibarınıza yazılır.'; gmUyariCls = 'onay'; }
  else if (sel.includes('P21') && dir.line === 'yildiz') { gmUyari = 'Söz verdiğiniz gibi yıldız avındayız; tutanak tutarlı, hoşuma gitti.'; gmUyariCls = 'onay'; }
  else if (kasaTehlike) { gmUyari = "Bu rakamla Şubat'ta maaş sıkıntısı çekeriz Başkanım, şimdiden söyleyeyim."; gmUyariCls = 'itiraz'; }
  // GM yetenek çubukları — Ağ / Pazarlık / Göz (gmSkill'den türetilir; dosya kalitesine bağlanır)
  const bars = { 'Ağ': cl(gmSkill + 8, 5, 99), 'Pazarlık': cl(gmSkill - 6, 5, 99), 'Göz': cl(gmSkill + 1, 5, 99) };
  const barHtml = Object.entries(bars).map(([k, v]) => `<div class="gm-bar"><span>${k}</span><div class="track"><div class="fill" style="width:${v}%"></div></div></div>`).join('');
  // Mühürlü sözler — madde madde (tek paragraf değil)
  const sozMad = sel.length ? sel.map((id) => `<div class="tut-soz">▸ ${esc((G.data.promises.find((x) => x.id === id) || {}).name || id)}</div>`).join('') : '<div class="muted" style="font-size:11px">Söz yok — "Laf değil, iş" düşülecek.</div>';
  const lineTr = { genc: 'gençlik yatırımı', hazir: 'pişmiş adam', yildiz: 'yıldız avı' }[dir.line] || dir.line;
  return `<div class="direktif-wrap">
    <div class="vaat-topbar">
      <button class="btn" data-act="setupBack" style="padding:4px 12px;font-size:12px">← Sözleri bir daha göreyim</button>
      <span class="vaat-ufuk">Dönem Başı · 2/2 · Makam Odası</span>
    </div>
    <h2 class="makam-baslik">${esc(gmAd)} kapıyı çaldı. Koltuğun altında bir dosya var.</h2>
    <div class="makam-grid">
      <div class="card gm-kart">
        ${personAvatar(gmAd, 'gm')}
        <b>${esc(gmAd)}</b>
        <div class="micro" style="margin-top:2px">Sportif Direktör</div>
        <div class="muted" style="font-size:11.5px;margin-top:8px">${gmKarakter}</div>
        <div class="gm-barlar">${barHtml}</div>
        <div class="muted" style="font-size:11px;margin-top:8px;border-top:1px solid var(--line);padding-top:8px">Dosyayı o getirir, kalemi sen tutarsın. Transferi sen yapmazsın — ONAYLARSIN.</div>
      </div>
      <div class="masa">
        <div class="gm-balon kuyruk">${esc(acilisSoz)}</div>
        <div class="karar-blok"><div class="overline">“Kese ne kadar açılsın?”</div>
          <div class="karar-uc">${bBtn('dusuk', 'Kemer Sıkı')}${bBtn('orta', 'Ölçülü')}${bBtn('yuksek', 'Kese Ağzı Açık')}</div></div>
        <div class="karar-blok"><div class="overline">“Gözüm kimde olsun?”</div>
          <div class="karar-uc">${lBtn('genc', 'Gençlere yatır')}${lBtn('hazir', 'Hazır adam')}${lBtn('yildiz', 'Bana yıldız bul')}</div></div>
        <div class="gm-balon tepki kuyruk">${esc(soz)}</div>
        ${gmUyari ? `<div class="gm-uyari ${gmUyariCls}">${gmUyariCls === 'itiraz' ? '⚠' : '✓'} <b>${esc(gmAd)}:</b> ${esc(gmUyari)}</div>` : ''}
      </div>
      <aside class="makam-sag">
        <div class="overline">Canlı Sonuç</div>
        <div class="onizleme">
          ${dRow('Kasa', Math.round(G.economy.kasa), kasaSonra, 'mn')}
          ${dRow('Borç', Math.round(G.economy.borc), Math.round(G.economy.borc), 'mn')}
          ${dRow('Kurul', maliNow, maliSonra)}
          ${dRow('Taraftar', tarNow, tarSonra)}
          ${kasaTehlike ? '<div class="onizleme-uyari">⚠ Kasa kritik — Şubat riskli</div>' : ''}
        </div>
        <div class="overline" style="margin-top:4px">Mühürlü Sözler</div>
        <div class="tut-sozler">${sozMad}</div>
        <div class="tutanak-belge">
          <div class="micro">Tutanak</div>
          <div class="tut-line">Kese ≈${fmt(budgetCap)}mn · ${lineTr} · ${sel.length} söz</div>
          <div class="muted" style="font-size:10.5px;margin-top:4px">Aşağıdaki “Sözleşmeyi İmzala” ile mühür basılır.</div>
        </div>
      </aside>
    </div>
  </div>`;
}

// Deterministik düz-vektör avatar (isimden ten/saç) — GM (takım elbise) / oyuncu (kulüp forması)
function personAvatar(name, kind) {
  let h = 0; for (const c of String(name || '?')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const skins = ['#e8c9a8', '#d9b48c', '#c99b6e', '#a97c50', '#8a5a34'];
  const hairs = ['#2b2118', '#43301c', '#6b4b2f', '#1c1c1c', '#5a4a3a'];
  const skin = skins[h % skins.length], hair = hairs[(h >> 3) % hairs.length];
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
function condTr(p) {
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
    P22: 'Başına 75+ kalibre bir teknik ekip kur',
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
