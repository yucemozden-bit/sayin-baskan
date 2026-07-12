# SAYIN BAŞKAN — Futbol Kulübü Başkanlığı Oyunu

## Vizyon
Oyuncu bir futbol kulübünün **başkanıdır** (menajer değil). Takımı sahada yönetmez;
kulübü yönetir: bütçe, sponsorlar, tesisler, transfer onayları, teknik direktör
ataması, taraftar/kongre ilişkileri. Uzun vadeli hedef: Godot'a taşınıp **Steam**'de
yayınlanacak. Şu anki aşama: HTML/CSS/JS ile oynanabilir prototip (tasarım dokümanı işlevi görür).

## Çekirdek döngü (KODLANDI — src/ altında modüler MVP; testler tests/ altında)
- Haftalık maçlar simüle edilir (oyuncu maçı oynamaz, sonucu yaşar).
- Gelir: bilet, kombine, büfe, sponsor, yayın, ikramiye. Gider: maaşlar, işletme, faiz.
- **Üye Güveni** (0-100): sonuçlar, memnuniyet, borç durumuna göre haftalık değişir.
- **Kongre seçimi**: 3 sezonda bir. Oy = güven + vaat durumu + sportif sonuç. %50 altı = oyun sonu.
- **Seçim vaatleri**: her dönem başında 3 seçenekten biri (terfi, borçsuz kulüp,
  stadyum yatırımı, kadro değeri +%40). Tutulursa +oy, tutulmazsa -oy.
- Küme düşme oyunu bitirmez ama sportif bir sonuçtur: ertesi sezon **2. Lig** başlar
  (zayıf rakipler + düşük yayın/sponsor/bilet geliri + en değerli oyuncu üst lige gider).
  Hedef terfi (ilk 3); dönersen ekonomi ve beklenti eski çıtasına oturur. `G.lig` (1/2)
  kulüp tier'ından (küçük/orta/büyük) ayrıdır. İflas (kasa < -1M) oyunu bitirir.
- Referans mekanikler eski prototipte mevcut (aşağıda "Eski prototip" notu).

## Ekran haritası (mevcut durum)
- [x] **açılış/kapı** — kulüp seçimi + mod + "Devam Et" (src/ui/clubSelect.js)
- [x] **setup** — kariyer kuruluşu: başkan adı, kulüp adı, renk, şehir, zorluk (src/ui/setup.js)
- [x] **makam odası** — vaat seçimi + GM direktif diyaloğu (src/ui/promiseSelect.js)
- [x] **kokpit / kadro / transfer / tesisler / finans / medya / kongre / veri / kulüp / inbox / ayarlar**
- [x] **maç günü / sezon sonu / seçim gecesi / kariyer sonu** sahneleri
- Yeni ekran, kullanıcı onayı olmadan eklenmez; ekranlar inceleme dosyalarıyla revize edilir.

## Görsel dil
- Palet: gece laciverti zemin (#070b14), panel #0e1526, çizgi #1c2740,
  metin #dbe2f0, soluk #5f6b85, **başkanlık altını #d4a940 / #f0cd6e**.
- Başlıklar: Georgia/serif, harf aralıklı, BÜYÜK HARF. Gövde: system-ui.
- Atmosfer: gece stadyumu, projektör parlamaları, vinyet. Ciddi, "yönetim kurulu" havası.
- Görseller `assets/img/` altından kullanılabilir; yoksa SVG ile çizilir.
- Yeni CSS değişkeni eklemeden önce :root'takileri kullan.

## Kod kuralları
- Saf HTML/CSS/JS (ES modülleri). Framework yok, build yok. **http üzerinden açılır**
  (`node serve.js` → http://localhost:8080; file:// çalışmaz — fetch + modüller).
- Yapı: `src/main.js` (faz yönlendirici + dispatch) · `src/ui/AD.js` (her ekran ayrı dosya)
  · `src/engines/` (ekonomi/piyasa/sponsor/seçim...) · `src/data/*.json` · `tests/*.mjs`.
- Türkçe UI metinleri, Türkçe yorumlar. Değişken adları İngilizce olabilir.
- **RNG determinizmi kutsal**: seed'li ana akışa (core/rng) haftalık döngüde YENİ çekiliş
  eklenmez; prosedürel içerik hash-tabanlı yerel RNG ile üretilir (bkz. sponsorGen/market).
- Kayıt: localStorage OTOKAYIT (her DEVAM'da) + açılışta "Devam Et"; JSON dışa/içe aktarma.
- KURAL: hiçbir ekranda scroll yok — `fitVaat()` sahneyi ölçekleyip sığdırır.
- Testler: `node tests/AD.test.mjs` (bağımsız betikler, "SONUÇ: X geçti, Y kaldı").
- Eski tek-dosya iskelet `bib/eski-iskelet/` altında (referans; index artık kullanmıyor).

## Çalışma şekli (önemli)
- Kullanıcı kısa yazar, çalışan prototip ister, hatayı hemen fark eder.
- **Ekran ekran ilerlenir**: bir ekran bitmeden sonrakine geçilmez, kapsam
  kendiliğinden genişletilmez. Önce ne yapılacağı kısaca teyit edilir.
- Her değişiklikten sonra sayfanın hatasız açıldığı kontrol edilir.

## Steam / hukuk notları
- Gerçek kulüp/oyuncu adı, logosu, benzerliği KULLANILMAZ (lisans). Kurgusal isimler.
- Telifli görsel asset kullanılmaz; CC0/ücretsiz lisanslı veya AI üretimi
  (Steam'de "pre-generated AI" beyanı gerekir; kod asistanı kullanımı beyan gerektirmez).

## Eski prototip (referans)
Menajer temalı eski tek-dosya prototip (kulup-yonetim-v8/v9.html) ekonomi
formülleri, sponsor/tesis/kadro sistemleri ve SVG stadyum için referans kaynağıdır.
Kullanıcıda mevcut; istenirse formüller oradan taşınır. Model birebir kopyalanmaz —
bu proje başkanlık kurgusuyla sıfırdan tasarlanıyor.
