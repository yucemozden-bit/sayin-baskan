# SAYIN BAŞKAN — Futbol Kulübü Başkanlığı Oyunu

## Vizyon
Oyuncu bir futbol kulübünün **başkanıdır** (menajer değil). Takımı sahada yönetmez;
kulübü yönetir: bütçe, sponsorlar, tesisler, transfer onayları, teknik direktör
ataması, taraftar/kongre ilişkileri. Uzun vadeli hedef: Godot'a taşınıp **Steam**'de
yayınlanacak. Şu anki aşama: HTML/CSS/JS ile oynanabilir prototip (tasarım dokümanı işlevi görür).

## Çekirdek döngü (tasarım hedefi — henüz kodlanmadı)
- Haftalık maçlar simüle edilir (oyuncu maçı oynamaz, sonucu yaşar).
- Gelir: bilet, kombine, büfe, sponsor, yayın, ikramiye. Gider: maaşlar, işletme, faiz.
- **Üye Güveni** (0-100): sonuçlar, memnuniyet, borç durumuna göre haftalık değişir.
- **Kongre seçimi**: 3 sezonda bir. Oy = güven + vaat durumu + sportif sonuç. %50 altı = oyun sonu.
- **Seçim vaatleri**: her dönem başında 3 seçenekten biri (terfi, borçsuz kulüp,
  stadyum yatırımı, kadro değeri +%40). Tutulursa +oy, tutulmazsa -oy.
- Küme düşme oyunu bitirmez, güveni sarsar. İflas (kasa < -1M) oyunu bitirir.
- Referans mekanikler eski prototipte mevcut (aşağıda "Eski prototip" notu).

## Ekran haritası
- [x] **title** — açılış (arma, menü: Yeni Kariyer / Devam Et / Ayarlar)
- [ ] **setup** — kariyer kuruluşu (başkan adı, kulüp adı, renkler, şehir, zorluk)
- [ ] **office** — makam odası / ana merkez (haftalık döngünün merkezi)
- [ ] diğerleri birlikte tasarlanacak — SIRAYLA gidilir, kullanıcı onayı olmadan
  yeni ekran eklenmez.

## Görsel dil
- Palet: gece laciverti zemin (#070b14), panel #0e1526, çizgi #1c2740,
  metin #dbe2f0, soluk #5f6b85, **başkanlık altını #d4a940 / #f0cd6e**.
- Başlıklar: Georgia/serif, harf aralıklı, BÜYÜK HARF. Gövde: system-ui.
- Atmosfer: gece stadyumu, projektör parlamaları, vinyet. Ciddi, "yönetim kurulu" havası.
- Görseller `assets/img/` altından kullanılabilir; yoksa SVG ile çizilir.
- Yeni CSS değişkeni eklemeden önce :root'takileri kullan.

## Kod kuralları
- Saf HTML/CSS/JS. Framework yok, build adımı yok. `index.html` çift tıkla açılır.
- Ekran sistemi: her ekran `<section class="screen" id="scr-AD">`, geçiş `go("AD")`
  (js/screens.js). Her yeni ekranın JS'i ayrı dosya: `js/AD.js`.
- Türkçe UI metinleri, Türkçe yorumlar. Değişken adları İngilizce olabilir.
- localStorage kayıt sistemi ileride eklenecek ("Devam Et" o zaman aktifleşir).

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
