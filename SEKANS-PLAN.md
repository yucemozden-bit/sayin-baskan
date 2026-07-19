# Sayın Başkan — İlişki & Sekans Planı

> **DURUM (2026-07-18):** ✅ **Faz 1 KODLANDI** — Ortak İlişki Motoru (`src/engines/iliski.js`),
> Oyuncularla İlişki 2.1 (jest · satmam sözü · klik · kişilik · iyilik defteri · huzursuz olayı ·
> yenileme indirimi/reddi · kaptan bağı · güven≥70→moral), TD temeli 2.2 (telkin sonucu→ilişki,
> ilişki→telkin reddi eşiği, istifa sinyali olayı), çocuk isim onarımı 2.8.
> Test: `tests/iliski.test.mjs` (27 kontrol — determinizm + autoplay-nötr + negatif-pasif kanıtlı).
>
> ✅ **KÖPRÜLER YAMASI da KODLANDI** (aynı gün): kulüp→özel çift yön (maç/derbi/şampiyonluk eve
> yansır — **BANT YASASI**: maç kaynaklı ev değişimi [35,68] dışına taşamaz, eşikleri yalnız
> program/ikilem aşar → autoplay-nötrlük matematiksel garanti) · enerji=kapasite (takatsizken
> jest+sorgu bonusu yanar) · Altyapı Kahvaltısı daveti (Özel Hayat↔oyuncu ilişkisi köprüsü) ·
> hava/sanat dişleri · yıllık aile fotoğrafı (çocuk barları dişlendi) · sezon sonu AİLE KARNESİ ·
> davet-açıldı nav sinyali · canlı program önizleme çipleri. Test: `tests/kopru.test.mjs` (21 kontrol).
>
> ✅ **FAZ 2+ PAKETİ KODLANDI:** Medya 2.5 (muhabir başına ilişki — ton×stil matrisi: sert kalem
> cesaret, babacan sükûnet, magazinci ateş sever; ≥70 dost kalem manşeti yumuşatır, <30 sivriltir;
> özel röportaj sezonda kalem başına 1; douse dost-kalem bonusu) · Rakip Başkanlar 2.3 (hash
> kimlikli başkanlar `bkIsim`, derbi atışması ikilemi ↔ husumet/centilmenlik `G.bkRel`, ≥70 →
> kelepir indirimi + sezonda 1 ortak hasılat gecesi +1,5mn) · Menajer bağı 2.4 (sosyal ≥65 →
> pazarlık şansı +6 puan) · Karanlık sponsor bedeli 2.7 (kripto batmaChance artık İŞLİYOR:
> 8. haftada hash zarı — batarsa gelir kesilir + manşet) · Unvan pasifleri 2.9 (sv.2-8 yetenek
> ağacı: jest yayılımı / 2 jest / 4 bağış / ucuz davet / güçlü röportaj / altyapı ağabeyi /
> kelepir saygısı — profilde listelenir). Test: `tests/faz2.test.mjs` (25 kontrol).
> ✅ **SON 5 ENTEGRASYON KODLANDI (Faz 5 çekirdeği dahil):** HANEDAN 2.8 — çocuklar sezonla
> büyür (c1Yas/c2Yas); oğul 16'sında akademi ikilemi → 18'inde HASH-determinist üretimle A
> takıma katılır (soyadıyla, ocak+YENİ, "torpil mi yetenek mi" manşeti; satarsan evde deprem);
> kız düğün sonrası halef yolu → kurul her sezon ısınır; kariyer kapanışında HANEDAN mirası
> bloğu. AİLE TELEFONLARI — Y2 kesmesine hash'le düşer (~%8, ikilemden öncelikli; 💗 AİLE
> araması, etkiler yalnız iç dünya). SEÇİM GECESİ — 6. karne kartı "Aile": eş+çocuk bağı ort
> ≥70 → +2 oy (varsayılan 66.7 → autoplay-nötr; asla negatif değil). MAÇ GÜNÜ — iç sahada
> aile locası şeridi (ev ≥60 dolu · <40 boş). BASIN — PRESS_POOL.ozel 6 soru (~9 haftada bir,
> %ES%/%C1%/%C2% gerçek isimlerle). Test: `tests/hanedan.test.mjs` (20 kontrol).
> ✅ **ON-PAKET KODLANDI (2026-07-19, büyük testin onaylı 10 fikri):** #6 BOŞANMA YAYI —
> eş bağı 4 hafta <20 (esSeri) → "Valizler kapıda" ZORUNLU ikilemi (cevaplanana dek gündemde
> çakılı); yuvayı kurtar (−6mn telafi, es+25) YA DA boşan: KALICI iz — ev tavanı 60 (güven
> eşiği 72 kapanır), eş kanalı donuk, yalı yemeği + eşli ikilemler + eş telefonu kapalı,
> sandıkta aile ort = (kız+oğul)/2. Ayrıca: kupa sinematiği (#1) · kayyum kurtuluş paketi (#3)
> · 5-maç şeridi (#4) · iflas çizgisi barı (#5) · terfi yarışı satırı (#7) · Stadyum MEGA
> Projesi (#8: Sv.10+250mn→8 hafta→kapasite ×1.2 kalıcı) · sorgu devri (#9) · kısa liste
> temizliği (#10) · karar defteri sekmesi (#12). Test: `tests/onpaket.test.mjs` (49 kontrol).
> Sıradaki: Faz 4 (Kongre blokları 2.6 derinleştirme) + Kariyer & Rekorlar menü ekranı.

Bu belge, oyuna eklenecek ilişki-tabanlı sistemleri (sekansları) ve bunların
birbirine nasıl bağlanacağını tanımlar. Amaç: özel hayatı, kulübü, ligi ve
sahayı tek bir "başkanlık simülasyonu" olarak birbirine dokumak. Her sistem,
aşağıdaki **mevcut denge garantilerine** uymak zorundadır.

---

## 0. UYULACAK KURALLAR (dokunma, her sistem bunlara uyar)

1. **Determinizm kutsal.** Hiçbir sistem `Math.random()` / core RNG çekilişi
   eklemez. Üretilen her şey (kişilik, olay sonucu, isim) `hash(seed, entityId,
   hafta)` ile deterministik. Aynı kayıt + aynı girdi → bit bit aynı sonuç.
2. **Autoplay-nötr.** Oyuncu hiçbir şeye dokunmazsa (varsayılan haftalık
   program) tüm ilişki ve gösterge sürüklenmeleri **net sıfır**. Yukarı yönlü
   kazanç yalnızca **bilinçli yatırımla** açılır. (Test: 12 hafta tick →
   gauge'lar bit bit aynı.)
3. **Negatif pasif yok.** İhmal edilen bir ilişki sessizce bir gauge'ı
   düşürmez. Bunun yerine **olay/manşet üretir** (oyuncu görür ve müdahale
   edebilir). Tehdit = fırsat maliyeti + olay riski, sessiz ceza değil.
4. **Her şey sahaya/kulübe döner.** Hiçbir gösterge "dekor" olamaz. Her
   göstergenin en az bir somut kulüp sonucu, her ilişkinin en az bir
   iyilik (fırsat) ve bir tehdit (olay) kanalı olmalı.
5. **Kayıt uyumluluğu.** Eski kayıt açılınca yeni sistemler "tembel" (lazy)
   kurulur: alan yoksa nötr varsayılanla doğar, mevcut dengeyi bozmaz.

---

## 1. ORTAK İLİŞKİ MOTORU (tüm ilişkiler bunu kullanır)

Tek bir veri modeli ve tek bir mantık. Oyuncu, TD, rakip başkan, menajer,
gazeteci, sponsor, kongre üyesi, eş — hepsi aynı motoru kullanır. Böylece kod
tek yerde, davranış tutarlı.

### Veri modeli
```
iliski = {
  id,                 // deterministik: hash(seed, "iliski", entityId)
  tip,                // "oyuncu" | "baskan" | "menajer" | "muhabir" | "sponsor" | "kurul" | "aile" ...
  ad,                 // hash ile üretilen isim
  kisilik,            // "sadik" | "firsatci" | "gururlu" | "centilmen" | "kindar" ... (hash ile atanır)
  puan,               // 0-100, yalnızca SEÇİM veya DETERMİNİST OLAY değiştirir (drift yok)
  kanal: {            // bu ilişkinin sağladığı somut kaldıraç
    firsat,           // yüksek puanda açılan avantaj (indirim, öncelik, bilgi...)
    tehdit            // düşük puanda tetiklenen olay (manşet, transfer talebi, oy kaybı...)
  },
  hafiza: [],         // geçmiş etkileşimler (deterministik olay günlüğü)
  iyilikDefteri: 0    // + ise sana borçlu, - ise sen borçlusun
}
```

### Kurallar
- **Puan değişimi yalnızca 2 kaynaktan gelir:** (a) oyuncunun seçimi,
  (b) deterministik olay (eşik/hafta/sonuç tetikli). Zaman geçtikçe kendi
  başına inip çıkmaz.
- **Eşikler olay tetikler:** puan `<30` → kriz olayı (tehdit kanalı açılır),
  puan `>70` → fırsat olayı (firsat kanalı açılır). Eşikler deterministik.
- **İyilik defteri = deterministik borç.** Birine iyilik yaparsan (borç ver,
  oynatma sözü tut, kıyak) `iyilikDefteri` artar; ileride bunu "çağırabilirsin"
  (favor kullan). Söz tutmazsan azalır + tehdit olayı.
- **Autoplay-nötr uyum:** dokunmazsan puan sabit kalır; sadece ana senaryo
  yayları (kızın düğünü gibi scriptli zincirler) ilerler.

---

## 2. SEKANSLAR

Her sekans şu formatta: **Amaç · Varlıklar · Etkileşimler (seçimler) ·
Bağlantılar (X→Y) · Kural uyumu.**

### 2.1 Oyuncularla İlişki (Soyunma Odası) — EN YÜKSEK ETKİ
- **Amaç:** Kadro sadece stat değil; her oyuncu başkanla ilişkisi olan bir
  karakter. Soyunma odası morali sahaya yansır.
- **Varlıklar:** Her oyuncuda `iliski` + `rol` (lider/genç/yıldız/yedek) +
  `klik` (soyunma odası grubu).
- **Etkileşimler:**
  - **Söz ver:** oynatma sözü / zam sözü / transfer etmeme sözü. Tutarsan
    ilişki + iyilikDefteri artar; tutmazsan düşer + manşet olayı.
  - **Kaptanlık ata:** (zaten var — Batuhan Ünal önerisi). Doğru lider →
    soyunma odası kliklerini toplar; yanlış seçim → hizip.
  - **Kişisel jest:** sakatlıkta ziyaret, prim, doğum günü. Küçük ilişki artışı.
  - **Klik yönetimi:** bir oyuncuya kıyak → rakip klik küser (bağlantı!).
- **Bağlantılar:**
  - Oyuncu ilişkisi ↑ → soyunma odası morali ↑ → **form ↑ → maç sonucu ↑**
  - Oyuncu ilişkisi ↓ → transfer talebi / basına konuşma → **manşet → taraftar
    & güven olayı**
  - Sözleşme yenilemede yüksek ilişki → **indirim (kasa avantajı)**
- **Kural uyumu:** ilişki değişimi yalnız söz/jest seçimlerinden ve maç sonucu
  gibi deterministik olaylardan. İhmal → sessiz düşüş değil, "oyuncu huzursuz"
  olayı üretir.

### 2.2 Teknik Direktörle İlişki — MERKEZ (çünkü sahada TD oynatır)
- **Amaç:** Sen başkansın, o sahada. "TD'ye telkin" (zaten var) bu ilişkiye
  bağlanır. Uyum yüksekse telkinlerin tutar.
- **Varlıklar:** TD'de `iliski` + `felsefe` (hücumcu/defansif/genç-veren) +
  `ego`.
- **Etkileşimler:**
  - **Telkin (maç içi, zaten var):** ilişki yüksek → telkin etkisi güçlü;
    düşük → TD dinlemez.
  - **Transfer dayatma:** aldığın oyuncuyu oynatmıyor → ikilem: *baskı yap*
    (ilişki↓, oyuncu oynar) / *güven* (ilişki↑, oyuncu bekler) / *kov*.
  - **TD değiştir:** kötü sonuç + düşük ilişki → kovma. Ama sık değiştirme →
    soyunma odası & kongre güveni olayı.
- **Bağlantılar:**
  - TD ilişkisi → oyuncu oynatma kararları → **oyuncu ilişkileri (2.1)** →
    performans
  - TD felsefesi ↔ senin transfer politikan uyumu → sezon içi istikrar
- **Kural uyumu:** kovma/tutma deterministik eşiklerle (sonuç serisi + ilişki),
  rastgele değil.

### 2.3 Diğer Kulüp Başkanları + Lig Politikası
- **Amaç:** Her rakip kulübün başkanı bir karakter. Transfer pazarı + lig
  siyaseti bu ilişkilerle döner. Bu, oyuna bir "üst siyaset" katmanı katar.
- **Varlıklar:** Her rakip başkanda `iliski` + `kisilik` (dost/kindar/fırsatçı/
  centilmen) + `husumet` (tarihsel derbi rakipliği).
- **Etkileşimler:**
  - **Transfer pazarlığı:** adil davran → ilişki↑; kazık at → kısa vade kâr,
    ilişki↓.
  - **Takas / ödünç oyuncu:** yüksek ilişki → sana **önce teklif gelir,
    indirimli**; düşük → oyuncularını kaçırır, fiyat şişirir.
  - **Basın atışması:** derbi öncesi savaş aç → ilişki↓ ama **taraftar coşar**
    (risk/ödül).
  - **Başkanlar oylaması (Kongre üstü lig meclisi):** yayın geliri paylaşımı,
    kural değişikliği oyları → **ittifak kur, oy topla**. İlişkiler = oylar.
- **Bağlantılar:**
  - Başkan ilişkileri → **transfer pazarı avantajı** + **lig politikası oyları**
    → kulüp geliri/gücü
  - Husumet → **derbi haftası özel sekansı** (baskı, moral, manşet)
- **Kural uyumu:** her başkanın kişiliği hash ile sabit; teklif/oy sonuçları
  deterministik.

### 2.4 Menajerlerle İlişki
- **Amaç:** Menajerler oyuncu havuzunun kapısı. Sosyal sermaye burada nakde döner.
- **Varlıklar:** Menajerde `iliski` + `portfoy` (temsil ettiği oyuncular).
- **Etkileşimler:**
  - **Komisyon pazarlığı:** ilişki yüksek → indirim + **gizli bilgi** (falanca
    satılık); düşük → komisyon şişer, seni oyalar.
  - **Süper menajer:** biriyle iyi ol → tüm portföyüne erişim açılır.
- **Bağlantılar:**
  - **Sosyal göstergesi ↑ (özel hayat) → menajer ikna kolaylığı** (özel hayat
    → transfer bağlantısı!)
  - Menajer ilişkisi → transfer maliyeti + erişim → kadro gücü
- **Kural uyumu:** portföy ve fiyatlar deterministik; ilişki seçimlerle değişir.

### 2.5 Medya & Gazetecilerle İlişki (Deniz Aksu buraya)
- **Amaç:** Manşetler taraftarı, oyuncuyu ve kongreyi etkiler. Basını yönet.
- **Varlıklar:** Her gazetecide `iliski` + `gundem` (neyin peşinde).
- **Etkileşimler:**
  - **Basın toplantısı (haftalık):** gelen soruya cevap tonu — *savunmacı /
    agresif / kurnaz* → **manşet tonu** belirlenir.
  - **Sızıntı yönetimi:** kötü olay patladığında gazeteci dostun → yumuşatır
    (**iyilik defterinden harca**).
  - **Özel röportaj:** ilişki yatırımı, uzun vadeli koruma.
- **Bağlantılar:**
  - Medya ilişkisi → **manşet tonu → taraftar morali + oyuncu morali (2.1) +
    kongre algısı (2.6)**
  - Skandal (2.8) olduğunda medya dostu = hasar azaltma
- **Kural uyumu:** manşet, olaya ve ilişki eşiğine göre deterministik seçilir.

### 2.6 Kongre / Kurul / Taraftar Grupları (SİYASET & SEÇİM)
- **Amaç:** Sen seçilmiş bir başkansın. Güven oyu (zaten var: %50 altı → koltuk
  sallanır) bu sistemin kalbi. Oyunun "kaybetme" koşulu buradan gelir.
- **Varlıklar:** Kongre üyeleri (seçmen blokları) + Taraftar grupları (ultras)
  + Yönetim kurulu üyeleri. Her birinde `iliski` + `talep`.
- **Etkileşimler:**
  - **Vaat ver / tut:** sezon başı vaatler (şampiyonluk, yıldız transfer, bilet
    fiyatı). Tutarsan güven↑; tutmazsan **seçim döneminde bedel**.
  - **Taraftar talebi:** karşıla → coşku; yok say → protesto **olayı** (negatif
    pasif değil, olay).
  - **Seçim/yeniden aday olma:** dönem sonu kampanya sekansı — vaat karnen +
    ilişkiler oyları belirler.
- **Bağlantılar:**
  - Sonuçlar + vaatler → **kongre güveni → koltuk güvenliği → oyun sonu
    (kovulma)**
  - Taraftar coşkusu → bilet/kombine geliri → kasa
- **Kural uyumu:** güven ve oy hesabı deterministik (sonuç + vaat + ilişki).

### 2.7 Sponsorlar & İş Dünyası (Rıfat Bey buraya)
- **Amaç:** Kasanın dış musluğu. Etik ikilemlerin sahnesi.
- **Varlıklar:** Sponsorlar (göğüs/kol/stat ismi) + iş dostları. `iliski` +
  `sartlar` (performans bonusları).
- **Etkileşimler:**
  - **Anlaşma seç:** güvenli marka (az para, itibar↑) vs **karanlık sponsor**
    (kumar/kripto — çok para, itibar & taraftar riski). Risk/ödül.
  - **İş dostundan kredi/kefil:** dar günde kasa, ama **iyilik defterine borç**.
- **Bağlantılar:**
  - Sponsor → **kasa → transfer bütçesi → saha gücü**
  - Karanlık sponsor → ifşa olursa → **medya (2.5) + taraftar (2.6) olayı**
- **Kural uyumu:** bonus tetikleri performansa bağlı deterministik.

### 2.8 Özel Hayat & Aile (mevcut ekranı derinleştir)
- **Amaç:** Zaten güçlü (ev/enerji/stres/sosyal + haftalık program + 14 ikilem).
  Eksik halkaları bağla.
- **Etkileşimler / eklemeler:**
  - **Çocuklara isim üret** (şu an "undefined" görünüyor — bug). `hash(seed,
    "cocuk", i)` ile deterministik isim. İlişki ağındaki "undefined·Kızı"
    da düzelir.
  - **Sağlık yayı:** yaş + stres yüksekse → check-up olayı (Dr. Vural zaten
    var) → **enerji tavanı** belirler.
  - **Hanedan/miras:** çocuklar büyür → biri **gelecek başkan adayı** (kulübü
    devralır), biri **futbolcu** olabilir. Uzun kariyer ödülü.
- **Bağlantılar:**
  - Özel gauge'lar (ev/enerji/stres/sosyal) → **haftalık kapasite** (kaç iş
    yapabilirsin, sorgu hakkı) → **kulüp kararlarının kalitesi**
  - Sosyal → menajer/başkan ikna kolaylığı (2.3, 2.4)
- **Kural uyumu:** mevcut garantiler korunur; eklemeler nötr varsayılanla doğar.

### 2.9 İtibar / Kariyer / Miras (META)
- **Amaç:** Uzun vadeli hedef ve tekrar oynanabilirlik.
- **Etkileşimler:**
  - **Başkanlık seviyeleri → yetenek ağacı:** Çaylak → Mahallenin Başkanı → …
    her seviye bir pasif açar: *İkna Ustası* (+ikna), *Cimri* (borç yönetimi),
    *Baba* (genç oyuncularla ilişki +).
  - **Kariyer & Rekorlar (menüde var):** kupalar, rekor transferler, en uzun
    görev süresi, kaç kulüp gezildi.
  - **Çoklu kulüp kariyeri:** başarısız → küçük kulüpten teklif; efsane → dev
    kulüp çağırır.
- **Bağlantılar:** seviye → yetenekler → tüm sekanslara küçük çarpanlar.
- **Kural uyumu:** XP ve seviye deterministik (dengeli hafta/ikilem/davet puanı,
  zaten böyle).

---

## 3. BAĞLANTI HARİTASI (tek bakışta)

```
ÖZEL HAYAT (ev/enerji/stres/sosyal)
        │  (haftalık kapasite: kaç iş, sorgu hakkı)
        ▼
   KARAR KALİTESİ ──────────────┐
        │                       │
        ▼                       ▼
   İLİŞKİLER  ───────────►  İYİLİK / TEHDİT
 (oyuncu, TD, başkan,          │
  menajer, medya,              ▼
  sponsor, kongre)     KULÜP KAYNAKLARI (kasa, kadro, bütçe)
        │                       │
        ▼                       ▼
   SOYUNMA ODASI MORALİ ──►  SAHA PERFORMANSI (form, sonuç)
        │                       │
        └──────────┬────────────┘
                   ▼
        TARAFTAR + KONGRE GÜVENİ
                   │  (%50 altı → koltuk sallanır)
                   ▼
           OYUN SONU / YENİDEN SEÇİM
```

Kural: **her ok çift yönlü düşünülmeli.** Sosyal yüksekse menajer ikna olur
(özel→kulüp); kötü sonuç eşi de üzer (kulüp→özel). Sistemler birbirine
dokundukça oyun canlanır.

---

## 4. ÖNERİLEN İNŞA SIRASI (fazlar)

- **Faz 1 — Temel + en yüksek etki:** Ortak İlişki Motoru (Bölüm 1) +
  Oyuncularla İlişki (2.1). Bir sistem doğru kurulunca gerisi aynı motoru
  kullanır.
- **Faz 2 — Saha döngüsü:** Teknik Direktör (2.2) + Medya (2.5). Telkin ve
  manşet zaten var, ilişkiye bağla.
- **Faz 3 — Transfer ekosistemi:** Rakip Başkanlar (2.3) + Menajerler (2.4).
- **Faz 4 — Siyaset:** Kongre/Taraftar/Seçim (2.6) + Sponsorlar (2.7).
- **Faz 5 — Meta:** Kariyer/Miras/Yetenek ağacı (2.9) + Özel Hayat derinleştirme
  (2.8, çocuk isim bug'ı Faz 1'de düzeltilebilir).

---

## 5. CLAUDE CODE'A NOTLAR (uygulama)

- Her sekansı **ayrı commit + kendi testi** ile ekle (mevcut `.mjs` harness).
- **Determinizm testi (her sekans için zorunlu):** aynı kayıt + 12 hafta tick →
  ilgili gauge/ilişki puanları **bit bit aynı** olmalı (senin mevcut kanıt
  yönteminle aynı).
- **Autoplay-nötr testi:** oyuncu hiçbir seçim yapmazsa, sekansın eklediği tüm
  değerlerin net değişimi **0** olmalı.
- **Negatif-pasif testi:** bir ilişki ihmal edildiğinde bir gauge'ın düştüğünü
  DEĞİL, bir **olay/manşet** üretildiğini doğrula.
- Ortak motoru (Bölüm 1) tek bir modüle koy; her sekans onu import etsin —
  ilişki mantığı kopyalanmasın.
- Yeni alanlar eski kayıtta yoksa **lazy init** ile nötr doğsun (kayıt
  uyumluluğu).
