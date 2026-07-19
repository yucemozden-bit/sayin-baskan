// src/engines/ozel.js — ÖZEL HAYAT modu: saf veri + yardımcılar (aksiyonlar actions.js'te).
// TASARIM İLKELERİ:
//  1) AUTOPLAY-NÖTR: varsayılan program (1/1/1/1) ile hiçbir kulüp-yönlü etki tetiklenmez —
//     denge/kalibrasyon bantları oynamaz. Etkiler yalnız bilinçli yatırımla (eşik aşımı) açılır.
//  2) DETERMİNİZM KUTSAL: core/rng'ye çekiliş EKLENMEZ — tüm rastgelelik h32 hash (kulüp+sezon+hafta).
//  3) KÜÇÜK AMA GERÇEK: kulüp etkileri minik (≤0.4 gauge/hafta, ≤2 tek seferlik) ama hissedilir.

// MUTLAK HAFTA (monotonik) — cooldown/vade matematiğinin TEK kaynağı.
// BUG DERSİ (2026-07-21): eski `sezon×100+hafta` sayacı DÖNEM başında sezonla birlikte
// sıfırlanıyordu → dönem geçişinde davet/arsa/sponsor-av bekleme süreleri 200+ haftaya
// fırlıyordu ("takvim dolu (219 hafta)"). Dönem 1'de eski ölçekle BİREBİR aynı (kayıt uyumu);
// sonraki dönemlerde artmaya devam eder. Eski kayıtlardaki şaşmış değerler negatif kalana
// düşer → süresi dolmuş sayılır (kendini onarır).
export function absHafta(G) {
  const donem = (G.meta?.term || 1) - 1, spt = G.SEASONS_PER_TERM || 3;
  return (donem * spt + (G.meta?.season || 1)) * 100 + (G.meta?.week || 1);
}

// Hash — sponsorGen/market ile aynı aile (yerel, seed'den bağımsız)
export function h32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Kadın isim havuzu (names.json'da yok — aile üretimi için yerel, kurgusal)
export const KADIN_AD = ['Leyla', 'Feride', 'Nermin', 'Sabiha', 'Gönül', 'Perihan', 'Türkan', 'Müjde', 'Hale', 'Belgin', 'Aysel', 'Nilüfer', 'Serap', 'Ceyda', 'Yasemin', 'Elif', 'Zeynep', 'Selin', 'Melis', 'Duygu', 'Ebru', 'Sibel', 'Nazan', 'Figen'];

// Başkanlık tecrübesi — seviye eşikleri + unvanlar (gelir: 0.35 + 0.05×seviye /hafta)
// DENGE (entegrasyon simülasyonu kanıtı): eski eğri 2 sezonda sv.8'e tavan yapıyordu —
// unvan bir KARİYER yolculuğu: çok aktif oyuncu ~2 sezonda sv.5-6, Efsane ~5+ sezon ister.
export const SEVIYE_ESIK = [0, 30, 70, 130, 210, 320, 460, 640];
export const UNVANLAR = ['Çaylak Başkan', 'Mahallenin Başkanı', 'İş İnsanı', 'Cemiyet İnsanı', 'Halkın Adamı', 'Şehrin Yüzü', 'Camianın Babası', 'Efsane Başkan'];
export function seviyeOf(xp) { let s = 1; for (let i = 1; i < SEVIYE_ESIK.length; i++) if (xp >= SEVIYE_ESIK[i]) s = i + 1; return s; }

// Haftalık kişisel gelir — TEK KAYNAK (actions tick + UI şeridi aynı formülü okur).
// DENGE (simülasyon kanıtı): eski 0.35+0.05sv aktif başkanın davet/ikilem harcamasını
// karşılayamıyordu — varlık merdiveni fiilen kilitliydi. Unvan büyüdükçe iş imparatorluğu büyür.
export function haftalikGelir(oz) { return Math.round((0.5 + 0.1 * (oz?.seviye || 1)) * 100) / 100; }

// Varlık kataloğu — 5 kategori × seviyeler. fiyat[i] = (i+1). seviyeye YÜKSELTME bedeli (mn).
// pasif: haftalık iç-gösterge katkısı (kulüp gauge'una DEĞİL — autoplay-nötr kalsın).
// SHOWROOM GENİŞLEMESİ (assets/showroom.html — 3D vitrin): konut/oto 4 kademeye, hava 3'e çıktı;
// her kademe `model` anahtarıyla 3D sahnesine bağlanır. Yeni zirveler geç-oyun para lavabosu
// (kişisel servet), pasifler yalnız İÇ göstergelere → autoplay-nötrlük değişmez.
// Her kademenin İMTİYAZI (perk) gerçek bir mekaniğe bağlıdır (actions kancaları) — vitrin altında
// açıklaması yazar, aktifleri servet şeridinde birikir. Kancalar deterministik (rand sayısı sabit).
export const VARLIK = {
  konut: { ad: 'Konut', ik: '🏠', adlar: ['Şehir Evi', 'Müstakil Köşk', 'Boğaz Yalısı', 'Büyük Malikâne'], fiyat: [0, 18, 45, 85], pasif: { ev: [0, 1.5, 2.5, 4] }, model: ['konut1', 'konut2', 'konut3', 'konut4'],
    perk: ['Aile yuvası — başlangıç konutu', 'Yalıda Akşam Yemeği davetleri açılır (kurul sofrası)', 'Davetler 1 az enerji yorar (ağırlamaya alışkın ev)', 'Malikâne resepsiyonu: her sezon başı kurul sadakati +1'] },
  oto: { ad: 'Otomobil', ik: '🏎️', adlar: ['Lüks Sedan', 'Spor Coupé', 'Grand Tourer', 'Süper Spor'], fiyat: [6, 16, 38, 60], pasif: { sosyal: [0.5, 1, 2, 3] }, model: ['oto1', 'oto2', 'oto3', 'oto4'],
    perk: ['Şehirde tanınırsın', 'Jest yayılımı +1 (kulübe gelişin olay olur)', 'Cemiyette ağırlığın artar (sosyal +2/hafta)', 'Şehir olayı: satın alınca taraftar +2 · sosyal +3/hafta'] },
  tekne: { ad: 'Deniz Aracı', ik: '🛥️', adlar: ['Lüks Tekne', 'Flybridge Yat', 'Mega Yat'], fiyat: [12, 32, 60], pasif: { sosyal: [1, 1.5, 2.5] }, model: ['deniz1', 'deniz2', 'deniz3'],
    perk: ['Tekne Turu davetleri açılır (iş çevresi)', 'Mali algı ×2 · TAKIM TEKNE GÜNÜ: sezon başı kadro morali +4', 'Takvim −2 hafta · takım günü sezon başı moral +6 · form +3'] },
  hava: { ad: 'Hava Aracı', ik: '🚁', adlar: ['Helikopter (pay)', 'Turboprop Uçak (pay)', 'Özel Jet'], fiyat: [20, 45, 90], pasif: { enerji: [1, 2, 3] }, dis: 'Kulüp mesaisi yarı yorar', model: ['hava1', 'hava2', 'hava3'],
    perk: ['Kulüp mesaisi yarı yorar (akşamlar senin)', 'Scout uçuşları: sorgu +1 · TAKIM CHARTER\'I: deplasman dönüşü kadro kondisyonu +1', 'Özel Jet: pazarlık +%4 · deplasman dönüşü kondisyon +2'] },
  sanat: { ad: 'Sanat', ik: '🖼️', adlar: ['Genç Koleksiyon', 'Usta Tablosu', 'Müze Şaheseri'], fiyat: [8, 24, 50], pasif: {}, dis: 'Hayır Gecesi güçlenir (sv.2+), sv.3: takvim −2', model: ['sanat1', 'sanat2', 'sanat3'],
    perk: ['Koleksiyoner imajı filizlenir', 'Hayır Gecesi etkisi büyür (itibar/taraftar +1)', 'Müze Şaheseri: her sezon başı itibar +1 · hayır takvimi −2'] },
};

// AKTİF İMTİYAZ ÖZETİ — sahip olunan kademelerin çalışan etkileri (UI şeridi + testler tek kaynaktan okur)
export function varlikPerkleri(oz) {
  const v = oz?.varlik || {};
  const out = [];
  const p = varlikPasif(oz || { varlik: {} });
  if (p.ev) out.push({ ik: '🏠', txt: `ev huzuru +${p.ev}/hafta` });
  if (p.sosyal) out.push({ ik: '🎩', txt: `sosyal +${p.sosyal}/hafta` });
  if (p.enerji) out.push({ ik: '⚡', txt: `enerji +${p.enerji}/hafta` });
  if ((v.konut || 0) >= 2) out.push({ ik: '🍽', txt: 'yalı yemekleri açık' });
  if ((v.konut || 0) >= 3) out.push({ ik: '🕯', txt: 'davetler −1 enerji' });
  if ((v.konut || 0) >= 4) out.push({ ik: '🏛', txt: 'sezon başı kurul +1' });
  if ((v.oto || 0) >= 2) out.push({ ik: '🏎️', txt: 'jest yayılımı +1' });
  if ((v.tekne || 0) >= 1) out.push({ ik: '⛵', txt: 'tekne turları açık' });
  if ((v.tekne || 0) >= 2) out.push({ ik: '💼', txt: 'tekne turu mali algı ×2' });
  if ((v.tekne || 0) >= 2) out.push({ ik: '🛥️', txt: (v.tekne || 0) >= 3 ? 'sezon başı takım moral +6 · form +3' : 'sezon başı takım moral +4' });
  if ((v.tekne || 0) >= 3) out.push({ ik: '🗓', txt: 'tekne takvimi −2 hafta' });
  if ((v.hava || 0) >= 1) out.push({ ik: '🚁', txt: 'mesai yarı yorar' });
  if ((v.hava || 0) >= 2) out.push({ ik: '🔎', txt: 'sorgu hakkı +1/hafta' });
  if ((v.hava || 0) >= 2) out.push({ ik: '✈️', txt: `deplasman dönüşü kondisyon +${(v.hava || 0) >= 3 ? 2 : 1}` });
  if ((v.hava || 0) >= 3) out.push({ ik: '🤝', txt: 'pazarlık +%4' });
  if ((v.sanat || 0) >= 2) out.push({ ik: '🖼️', txt: 'hayır gecesi güçlü' });
  if ((v.sanat || 0) >= 3) out.push({ ik: '🏺', txt: 'sezon başı itibar +1' });
  return out;
}

// Davetler — kişisel para + enerji → kulüp-yönlü tek seferlik etki (bilinçli aksiyon, autoplay değmez)
export const DAVETLER = {
  // KRİZ SOFRASI (kullanıcı isteği): üst üste mağlubiyette başkan CEBİNDEN takımı ağırlar —
  // moral+form toparlar. req G'yi de alır (magSeri maç motorundan sayılır); kapı kapalıyken görünür kalır.
  moral: { ad: 'Takım Moral Gecesi', ik: '🍖', req: (oz, G) => (G?.magSeri || 0) >= 2, reqTxt: 'Üst üste 2 mağlubiyet sonrası açılır (kriz sofrası)', maliyet: 2, enerji: 2, cd: 4, konuk: 'Tüm kadro · teknik ekip', ozet: 'Moral +8 · form +4 · başkana güven ▲ — seri kırma sofrası' },
  altyapi: { ad: 'Altyapı Kahvaltısı', ik: '🥐', req: () => true, reqTxt: '', maliyet: 1, enerji: 2, cd: 6, konuk: 'Ocak çocukları · akademi hocaları', ozet: 'Ocak/genç oyuncularda başkana güven ▲' },
  yemek: { ad: 'Yalıda Akşam Yemeği', ik: '🍽️', req: (oz) => oz.varlik.konut >= 2 && !oz.flags?.bosandi, reqTxt: 'Köşk/Yalı gerek (Konut sv.2+)', maliyet: 2, enerji: 2, cd: 4, konuk: 'Eş · kurul üyeleri', ozet: 'Kurul sadakati +2 · Ev +4' },
  tekne: { ad: 'Tekne Turu', ik: '⛵', req: (oz) => oz.varlik.tekne >= 1, reqTxt: 'Tekne gerek (Deniz Aracı sv.1+)', maliyet: 4, enerji: 3, cd: 6, konuk: 'Rıfat Bey · iş çevresi', ozet: 'Mali algı +1 · Sosyal +6' },
  hayir: { ad: 'Hayır Gecesi', ik: '🕯️', req: () => true, reqTxt: '', maliyet: 6, enerji: 3, cd: 8, konuk: 'Basın · sponsorlar · dernekler', ozet: 'İtibar +2 · Taraftar +1 · manşet (sanat sv.2+: etki büyür)' },
};

// ── ÖZEL GÜNDEM: ikilem havuzu ──
// fx anahtarları: ev enerji stres sosyal nakit | es c1 c2 dost muhabir | guven taraftar itibar mali kasa | xp
// kosul(oz,G): havuza girme şartı. flag: seçim sonrası oz.flags'e yazılır. arsa: vadeli yatırım (özel).
export const OLAYLAR = [
  {
    id: 'nisan', kisi: 'KIZINIZ · %C1%', t: 'Nişan mı, deplasman mı?',
    q: '"Nişanım cuma akşamı baba. Ama senin de kritik deplasmanın var... Yine telefondan mı takip edeceksin?"',
    a: [
      { l: 'NİŞANA GİT', info: 'Ev ▲▲ · kızın ▲ · maçı telefondan', fx: { ev: 6, c1: 8, es: 3, enerji: -2, xp: 2 }, flag: 'elifNisan' },
      { l: 'MAÇA GİT — telefondan tebrik', info: 'Taraftar ▲ · kızın ▼▼', fx: { taraftar: 1, c1: -8, ev: -5 } },
    ],
  },
  {
    id: 'dugun', kisi: 'KIZINIZ · %C1%', t: 'Düğün tarihi kongre haftasına denk geldi', kosul: (oz) => !!oz.flags.elifNisan,
    q: '"Salon ancak o haftaya müsaitmiş baba. Erteleyelim mi diyorsun yoksa...?"',
    a: [
      { l: 'DÜĞÜN O HAFTA — masrafı benden', info: 'Nakit −4 · Ev ▲▲▲ · Sosyal ▲', fx: { nakit: -4, ev: 8, c1: 10, es: 5, sosyal: 5, xp: 3 } },
      { l: 'Birkaç hafta erteleyin', info: 'Kızın ▼▼ · eşin ▼', fx: { c1: -8, es: -4, stres: 2 } },
    ],
  },
  {
    id: 'karne', kisi: 'OĞLUNUZ · %C2%', t: 'Karne zayıf geldi',
    q: '%ES% Hanım karneyi masaya koydu: "İki zayıf. Baba ilgisi istiyor bu çocuk, konuş onunla."',
    a: [
      { l: 'Hafta sonu baş başa vakit', info: 'Oğlun ▲▲ · Ev ▲ · Enerji ▼', fx: { c2: 8, ev: 4, enerji: -2, xp: 1 } },
      { l: 'Özel öğretmen tut', info: 'Nakit −1 · oğlun ▲', fx: { nakit: -1, c2: 3 } },
    ],
  },
  {
    id: 'yildonumu', kisi: 'EŞİNİZ · %ES%', t: 'Evlilik yıldönümü', kosul: (oz) => !oz.flags.bosandi,
    q: 'Ajandana kongre üyesi yazmış: "Yarın yıldönümünüz Başkanım. Geçen sene unutmuştunuz, hatırlatayım dedim."',
    a: [
      { l: 'Sürpriz akşam yemeği', info: 'Nakit −1,5 · Eşin ▲▲ · Ev ▲▲', fx: { nakit: -1.5, es: 8, ev: 6, xp: 2 } },
      { l: 'Bu hafta olmaz — telafi ederim', info: 'Eşin ▼▼', fx: { es: -6, ev: -3 } },
    ],
  },
  {
    id: 'arsa', kisi: 'DOSTUNUZ · RIFAT BEY', t: 'Körfezde arsa fırsatı',
    q: '"Başkanım, imar geliyor diyorlar. 5 milyon koy, birkaç haftaya ikiye katlarsın. Ama bu işler malum... garanti yok."',
    a: [
      { l: 'VAR MISIN? — 5mn yatır', info: 'Nakit −5 · yazı tura (%50) · sonuç 4 hafta sonra Inbox\'a düşer', fx: { nakit: -5, dost: 4 }, arsa: true },
      { l: 'Ben futbol adamıyım Rıfat', info: 'Dostun ▼ · güvenli', fx: { dost: -4 } },
    ],
  },
  {
    id: 'roportaj', kisi: 'MUHABİR · DENİZ AKSU', t: 'Evde özel röportaj talebi',
    q: '"Okurlar Başkan\'ın insan tarafını merak ediyor. Yalıda bir kahve, birkaç kare... Söz, magazin sorusu yok."',
    a: [
      { l: 'Kabul et', info: 'İtibar ▲ · muhabir ▲▲ · Ev ▼ (mahremiyet)', fx: { itibar: 1, muhabir: 7, ev: -3, xp: 1 } },
      { l: 'Özel hayat özeldir', info: 'Muhabir ▼▼', fx: { muhabir: -5 } },
    ],
  },
  {
    id: 'checkup', kisi: 'DR. VURAL', t: 'Check-up randevusu', kosul: (oz) => oz.g.stres >= 55,
    q: '"Tansiyon sınırda Başkanım. Yarım gün ayır, şu tetkikleri yapalım. Maç stresi böyle giderse ben karışmam."',
    a: [
      { l: 'Randevuya git', info: 'Stres ▼▼ · Enerji ▲ · Nakit −0,5', fx: { nakit: -0.5, stres: -8, enerji: 6, xp: 1 } },
      { l: 'Sezon sonu bakarız', info: 'Stres ▲', fx: { stres: 4 } },
    ],
  },
  {
    id: 'jubile', kisi: 'ESKİ TAKIM ARKADAŞI', t: 'Jübile daveti',
    q: '"Kaptanım, jübilemde forma giymeni istiyorum. Tribün seni de görsün — eski günlerin hatrına."',
    a: [
      { l: 'Formayı giy', info: 'Taraftar ▲ · Sosyal ▲ · Enerji ▼', fx: { taraftar: 1, sosyal: 5, dost: 4, enerji: -2, xp: 1 } },
      { l: 'Tebrik mesajı yeter', info: 'Sosyal ▼', fx: { sosyal: -3 } },
    ],
  },
  {
    id: 'dernek', kisi: 'EŞİNİZ · %ES%', t: 'Dernek başkanlığı teklifi', kosul: (oz) => !oz.flags.bosandi,
    q: '"Kongre eşleri derneği başkanlık teklif etti. Kabul edersem daha az evde olurum ama... istiyorum."',
    a: [
      { l: 'Destekle', info: 'Eşin ▲▲ · Sosyal ▲', fx: { es: 6, sosyal: 4, ev: 2, xp: 1 } },
      { l: 'Ev düzenimiz bozulmasın', info: 'Eşin ▼▼', fx: { es: -5 } },
    ],
  },
  {
    id: 'bilet', kisi: 'AKRABA', t: 'Protokol bileti ısrarı',
    q: 'Amcaoğlu aradı: "10 kişiyiz, protokolden yer ayarla." Basın protokol şişkinliğini yazmaya bayılıyor.',
    a: [
      { l: 'Ayarla — aile bunun için var', info: 'Aile ▲ · İtibar ▼ (basın yazar)', fx: { ev: 3, dost: 2, itibar: -1 } },
      { l: 'Gişeden alsınlar', info: 'Aile ▼', fx: { ev: -3 } },
    ],
  },
  {
    id: 'borc', kisi: 'DELEGE DOST · NUSRET', t: 'Eski dosttan borç talebi',
    q: '"İşler bozuk Başkanım, 3 milyon lazım. Kongrede hep yanındaydım, biliyorsun..."',
    a: [
      { l: 'Ver — dostluk sandıktan büyük', info: 'Nakit −3 · Güven ▲ (delege çevresi)', fx: { nakit: -3, guven: 1, dost: 5, xp: 1 } },
      { l: 'Bu ara ben de sıkışığım', info: 'Dost ▼▼ · Güven ▼', fx: { dost: -6, guven: -0.5 } },
    ],
  },
  {
    id: 'tatil', kisi: 'EŞİNİZ · %ES%', t: 'Ara hafta kaçamağı', kosul: (oz) => !oz.flags.bosandi,
    q: '"Milli ara var, iki günlüğüne kaçalım. Telefonu da kapat — kulüp iki gün sensiz batmaz."',
    a: [
      { l: 'Kaçamak yap', info: 'Enerji ▲▲ · Stres ▼▼ · Nakit −2', fx: { nakit: -2, enerji: 10, stres: -10, ev: 5, es: 5, xp: 2 } },
      { l: 'Kulüpte işim var', info: 'GM not eder: işinin başında · eşin ▼', fx: { guven: 0.5, es: -4 } },
    ],
  },
  {
    id: 'asparagas', kisi: 'MAGAZİN', t: 'Asparagas manşet',
    q: '"BAŞKANIN GİZLİ SERVETİ" — kaynak belirsiz, rakamlar uydurma. Leyla Hanım gazeteyi masaya fırlattı.',
    a: [
      { l: 'Dava aç', info: 'Nakit −1 · İtibar ▲ · muhabir ▼', fx: { nakit: -1, itibar: 1, muhabir: -4, stres: 2 } },
      { l: 'Gül geç', info: 'Stres ▼ · İtibar ▼ (cevapsız kaldı)', fx: { stres: -3, itibar: -0.5 } },
    ],
  },
  {
    id: 'atisma', kisi: 'RAKİP BAŞKAN · %BK%', t: 'Derbi rakibinden laf geldi',
    q: 'Rakip başkan kameralara "farkı görecekler" demiş. Gazeteciler kapıda, tribün cevap bekliyor.',
    a: [
      { l: 'CEVABI YAPIŞTIR', info: 'Taraftar ▲ · husumet ▲▲ · stres ▲', fx: { taraftar: 1, stres: 3, sosyal: 2, xp: 1 }, bk: -8 },
      { l: 'Centilmen kal — "sahada konuşuruz"', info: 'İtibar ▲ · rakip başkan ▲ (kapılar açılır)', fx: { itibar: 0.5, stres: -1, xp: 1 }, bk: 5 },
    ],
  },
  { // #6 BOŞANMA YAYI — eş ilişkisi uzun süre dipte kalırsa hayat kapıyı SERT çalar (zorunlu ikilem)
    id: 'ayrilik', kisi: 'EŞİNİZ · %ES%', t: 'Valizler kapıda',
    kosul: (oz) => !!oz.flags.ayrilikTeklif && !oz.flags.bosandi,
    q: '"Yıllarca bekledim. Kulüp, kongre, kameralar... Ben hep üçüncü sıradaydım. Ya bu evi seçersin, ya yolumuza ayrı devam ederiz."',
    a: [
      { l: 'YUVAMI KURTARACAĞIM', info: 'Nakit −6 (telafi tatili) · eşin ▲▲▲ · ev ▲▲ — söz: aile önce', fx: { nakit: -6, es: 25, ev: 10, stres: 4, xp: 3 }, flag: 'krizAtlatildi' },
      { l: 'Yollarımızı ayıralım', info: 'KALICI: ev tavanı düşer · yalı yemekleri biter · sandıkta aile desteği zorlaşır', fx: { ev: -8, stres: 6 }, flag: 'bosandi' },
    ],
  },
  { // HANEDAN (2.8): oğul 16'sında + akademi güçlüyse — futbolcu yolu açılır
    id: 'ogulAkademi', kisi: 'OĞLUNUZ · %C2%', t: 'Altyapı forması giymek istiyor',
    kosul: (oz, G) => (oz.c2Yas || 14) >= 16 && !oz.flags.ogulKarar && (G?.facilities?.akademi || 0) >= 3,
    q: '"Akademi hocası beni izlemiş baba. Formayı giymek istiyorum — soyadım yük mü olur, kanat mı?"',
    a: [
      { l: 'ALTYAPIYA YAZ — yolu açık olsun', info: 'Oğlun ▲▲ · 18\'inde kadroya aday (hanedan)', fx: { c2: 10, ev: 3, xp: 3 }, flag: ['ogulAkademide', 'ogulKarar'] },
      { l: 'Önce okul, futbol sonra', info: 'Oğlun ▼ · güvenli yol', fx: { c2: -3, es: 2 }, flag: 'ogulKarar' },
    ],
  },
  { // HANEDAN: kızı düğünden sonra kulüpte görev ister — halef yolu
    id: 'kizKulup', kisi: 'KIZINIZ · %C1%', t: 'Kulüpte çalışmak istiyor',
    kosul: (oz) => (oz.c1Yas || 20) >= 22 && !!oz.flags.dugunOldu && !oz.flags.kizKarar,
    q: '"İşletme bitti baba. Kulübün masasında ben de olmak istiyorum — yarın senin koltuğun kimseye emanet kalmasın."',
    a: [
      { l: 'İŞE AL — omzumda yetişsin', info: 'Kızın ▲▲ · kurul +2 · her sezon kurul ısınır (halef)', fx: { c1: 10, ev: 3, xp: 3 }, flag: ['kizKulupte', 'kizKarar'], kurul: 2 },
      { l: 'Kendi yolunu çizsin', info: 'Kızın saygı duyar · bağımsız', fx: { c1: 3 }, flag: 'kizKarar' },
    ],
  },
  {
    id: 'gece', kisi: 'CEMİYET', t: 'Gece davetinde kalma kararı',
    q: 'Şehrin ünlü davetindesin; kalabalık dağılmıyor, kameralar kapıda. Saat gece yarısını geçti.',
    a: [
      { l: 'Sonuna kadar kal', info: 'Sosyal ▲▲ · Enerji ▼▼', fx: { sosyal: 6, dost: 3, enerji: -4, stres: -2, xp: 1 } },
      { l: 'Erken ayrıl', info: 'Güvenli · Enerji korunur', fx: { enerji: 1 } },
    ],
  },
];

// UNVAN PASİFLERİ (2.9 yetenek ağacı) — her seviye somut bir kolaylık açar (aksiyonlarda uygulanır)
export const UNVAN_PASIF = {
  2: 'Jest kliği daha geniş ısıtır (+2 yayılım)',
  3: 'Kulübe destek hakkı sezonda 4',
  4: 'Davetler 1 az enerji yorar',
  5: 'Haftada 2 kişisel jest',
  6: 'Özel röportajlar basında daha çok yer bulur',
  7: 'Altyapı kahvaltısında gençler seni ağabey bilir (+2 güven)',
  8: 'Kelepir masalarında ekstra saygı (fiyat daha da kırılır)',
};

// Rozetler — kalıcı unlock; koşul + pasif açıklaması (pasifler actions/ozelTick'te uygulanır)
export const ROZETLER = {
  aile: { ad: 'Aile Adamı', ik: '❤️', kosulTxt: '6 hafta üst üste ev huzuru ≥70', pasifTxt: 'Ev huzuru daha yavaş aşınır' },
  comert: { ad: 'Cömert Patron', ik: '⭐', kosulTxt: 'Kulübe toplam 10mn kişisel destek', pasifTxt: 'Bağışta taraftar coşkusu artar' },
  medya: { ad: 'Medya Dostu', ik: '📰', kosulTxt: 'Deniz Aksu ile ilişki ≥70', pasifTxt: 'Magazin manşetleri seni teğet geçer' },
  gece: { ad: 'Gece Kuşu', ik: '🌙', kosulTxt: 'Toplam 6 davet organize et', pasifTxt: 'Davetler daha az enerji yorar' },
};

// AİLE TELEFONLARI (Y2 kesme sistemine hash'le düşer — ~%8 hafta, ikilem yokken).
// kim: %AD% doldurma anahtarı. Etkiler yalnız iç göstergeler/ilişkiler → autoplay-nötr.
export const AILE_TEL = [
  {
    id: 'tunel', kim: 'c2', t: 'Tünel çıkışında buluşalım mı?', text: '"Baba maça geliyorum! Tünel çıkışında bekler misin, arkadaşlarım görsün?"',
    opts: [
      { key: 'a0', label: 'Gel evladım — tünelde buluşuruz', whisper: 'oğlun ▲ · ev ▲', fx: { c2: 6, ev: 2, enerji: -1 } },
      { key: 'a1', label: 'Bu maç olmaz, protokol dolu', whisper: 'oğlun ▼', fx: { c2: -4 } },
    ],
  },
  {
    id: 'yemek', kim: 'es', t: 'Akşam sofrası kuruldu', text: '"Bütün hafta kulüptesin. Bu akşamı bize ayır — sofra kurdum, telefonu da kapat."',
    opts: [
      { key: 'a0', label: 'Geliyorum — telefon kapalı', whisper: 'eşin ▲ · stres ▼', fx: { es: 5, ev: 3, stres: -4 } },
      { key: 'a1', label: 'Toplantım var, geç kalırım', whisper: 'eşin ▼', fx: { es: -4, ev: -2 } },
    ],
  },
  {
    id: 'ziyaret', kim: 'c1', t: 'Makama kahve ziyareti', text: '"Baba, yarın kahve içmeye geleyim mi makama? Konuşacaklarım var."',
    opts: [
      { key: 'a0', label: 'Gel kızım — takvimi boşaltırım', whisper: 'kızın ▲', fx: { c1: 6, ev: 2, enerji: -1 } },
      { key: 'a1', label: 'Bu hafta çok yoğunum', whisper: 'kızın ▼', fx: { c1: -4 } },
    ],
  },
  {
    id: 'dede', kim: 'es', t: 'Kayınpederler geliyor', text: '"Babamlar hafta sonu geliyor. Maç günüyle çakışıyor, biliyorum — ama yüzünü görsünler."',
    opts: [
      { key: 'a0', label: 'Yemekte olurum, maçı locadan izleriz', whisper: 'ev ▲▲ · enerji ▼', fx: { es: 4, ev: 4, enerji: -2 } },
      { key: 'a1', label: 'Selamımı söyle — stad beni bekler', whisper: 'eşin ▼', fx: { es: -3 } },
    ],
  },
];

// Varlık pasiflerinin haftalık toplamı (iç göstergelere)
export function varlikPasif(oz) {
  const t = { ev: 0, sosyal: 0, enerji: 0 };
  for (const [k, v] of Object.entries(VARLIK)) {
    const lv = oz.varlik[k] || 0;
    if (!lv) continue;
    for (const [gk, arr] of Object.entries(v.pasif)) t[gk] += arr[lv - 1] || 0;
  }
  return t;
}

// Toplam varlık değeri (gösterim): taban 10 (mevcut şehir evi) + satın alınan yükseltmeler
export function varlikDegeri(oz) {
  let top = 10;
  for (const [k, v] of Object.entries(VARLIK)) {
    const lv = oz.varlik[k] || 0;
    for (let i = 0; i < lv; i++) top += v.fiyat[i] || 0;
  }
  return top;
}
