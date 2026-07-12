# KULÜP BAŞKANLIĞI — v4.0 "DERİNLİK & İÇERİK" KATMANI
## Karakterler · Şablon Kütüphaneleri · Takvim · Stil Rehberi · Veri Dosyaları · Onboarding

> Katman mantığı: **v2 Bible** = matematik/motorlar · **v3 Ek** = FM hileleri + UI + akış · **v4 (bu)** = oyunu *dolduran* her şey.
> Referanslar: `§Bible-X`, `§v3-X`. Bu dosya olmadan oyun çalışır ama boş hisseder; bununla **yaşar**.

## İçindekiler
1. Sezon takvimi & özel haftalar
2. Karakter sistemi (kurul, menajerler, taraftar grupları, gazeteciler)
3. Derbi & rekabet sistemi
4. Genç takım günü (youth intake) — FM'in en sevilen günü
5. Hakem/VAR & disiplin olayları
6. Sponsor markaları & anlaşma çeşitleri
7. Şablon kütüphaneleri (manşet ×40, ticker ×30, inbox ×25, demeç cevapları)
8. Genişletilmiş olay havuzu (+18 olay, tam sayılarla)
9. Başarım (achievement) sistemi — 30 başarım
10. Görsel stil rehberi (renk/tipografi/spacing/bileşen tokenleri)
11. Ses tasarımı listesi
12. Onboarding & öğretici akışı (ilk 30 dakika)
13. Zorluk presetleri (tam sayısal) + dengeleme test senaryoları
14. Veri dosyaları (data/*.json tam örnekler)
15. Uzun oyun (10+ sezon) — miras, efsane statüsü, oyun sonu ekranı

---

# 1. SEZON TAKVİMİ & ÖZEL HAFTALAR

34 haftalık lig omurgasının üstüne **tema haftaları** biner. Her tema, inbox üretimini ve olay ağırlıklarını değiştirir → sezon tekdüze akmaz, "mevsimleri" olur.

| Hafta | Tema | Ne olur |
|---|---|---|
| 0 | **Sezon Açılışı** | Medya tahmini yayınlanır (§v3-A7), kombine satış raporu, vaat hatırlatması |
| 1-4 | Balayı | Olay olasılığı ×0.7; yeni transferler tanıtım haberleri |
| 8 | **İlk Derbi** | §3; tüm hafta derbi manşetleri, bilet geliri ×1.8 |
| 12 | **Kurul Sunumu I** | §v3-A9 sahnesi |
| 16-17 | **Devre Arası** | Pencere açılır; devre karnesi inbox'a; TD değerlendirme fırsatı |
| 17 | **Genç Takım Günü** | §4 — akademi çıktısı sahnesi |
| 21 | İkinci Derbi | deplasman versiyonu |
| 24 | **Kongre Haftası** (sadece seçim sezonu) | rakip aday resmileşir, demeç yoğunluğu ×2 |
| 28-34 | **Sprint** | Sıralamaya göre anlatı kilitlenir: şampiyonluk yarışı / küme hattı / Avrupa kovalaması; olay olasılığı ×1.3 |
| 30 | Kurul Sunumu II | |
| 34 | **Final Günü** | Son maç sahnesi genişletilmiş (H fazları ×1.5 süre); sezon sonu törenine akar |

**Kupa turları:** hafta 6, 11, 15, 22, 26, 31 (tek maç, araya sıkışır → kondisyon baskısı gerçek olur).
**Avrupa:** kalifiye sezonlarda hafta 5-27 arasına 8-12 maç serpilir → dar kadro cezası burada patlar (§Bible-5.2 Kondisyon).
**Milli ara:** hafta 7, 13, 27 — maç yok, `onIntlDuty` yıldızlar gider, %8 sakat dönme riski (inbox draması: "Yıldızın milli takımda sakatlandı").

---

# 2. KARAKTER SİSTEMİ

Oyunda konuşan herkes **kalıcı, isimli, hafızalı** karakter. Jenerik "bir gazeteci" yok; *aynı* gazeteci 5 sezon boyunca seninle uğraşır. Bu, FM'in dünyayı canlı gösteren en ucuz ve en etkili numarasıdır.

### 2.1 Kurul üyeleri (5 kişi, oyun başında üretilir)
```js
BoardMember = { name, archetype, loyalty:0-100, weight }  // weight: guven hesabındaki oyu
```
| Arketip | Derdi | Guven hedefine katkısı |
|---|---|---|
| **Hesap Adamı** | mali disiplin | mali gauge ×; borç artışında loyalty −hızlı |
| **Eski Futbolcu** | sportif başarı + altyapı | sportif + genç oyun süresi |
| **Politikacı** | taraftar + medya imajı | taraftar + medya tonu |
| **Sponsor Kralı** | ticari gelir + marka | ticari büyüme |
| **Nostaljik** | gelenek; TD/yıldız satışına alerjik | kimya + kulüp efsanelerine muamele |
`guven_hedef` artık ağırlıklı kurul ortalaması: `Σ(loyalty×weight)`. Kurul sunumunda (§v3-A9) taahhüdünü **hangi üyeye göre** seçmek stratejidir. Bir üyeyle arayı düzeltirken diğerini küstürebilirsin — 5 kişilik mini-politika.

### 2.2 Menajerler (8-10 kişilik havuz)
| Tip | Pazarlık davranışı |
|---|---|
| **Köpekbalığı** | imza parası ×1.6, her sezonu yeniden açar, sızıntı sever |
| **Beyefendi** | makul, uzun vade, sadık müvekkil |
| **Aile üyesi** (baba/abi) | duygusal, oynama süresi garantisi ister |
| **Portföyc**ü | çok müvekkil; onunla iyi ilişki → hedef listesi genişler (ilişki 0-100, her anlaşmada +10) |
Menajer ilişkisi kalıcı: kötü kopan pazarlık → o menajerin *tüm* müvekkilleri sana ×1.15 pahalı.

### 2.3 Taraftar grupları (2-3 tribün grubu, isimli)
```
grup = { name:"Kapalı Çarşı", radikallik:0-100, memnuniyet:0-100, boyut }
```
- Radikal grup: fiyat/küme/yıldız satışına sert tepki, boykotu **onlar** başlatır; ama derbi galibiyetinde ev avantajını en çok onlar büyütür.
- Ilımlı grup: mali disiplin ve tesis yatırımını takdir eder.
- İnbox'a **imzalı** mektuplar yazarlar; seçimde grup memnuniyetleri taraftar bileşenine ağırlıklı girer.

### 2.4 Gazeteciler (3 kalıcı imza)
| İmza | Ton | Özellik |
|---|---|---|
| **Yandaş** | +1 | başarını büyütür; ona özel demeç verirsen medya tonu + |
| **Muhalif** | −1.5 | tutulmayan vaatlerin arşivcisi; seçim yılında en tehlikeli kalem |
| **Tarafsız analist** | 0 | xG/istatistik haberleri; dürüst ayna |
Manşet üretici (§v3-D2) şablonu imzaya göre seçer. Muhalifi **susturamazsın** ama iyi mali karne onun elinden koz alır.

---

# 3. DERBİ & REKABET SİSTEMİ

Oyun başında lig içinden 1 **ezeli rakip** + 1 **bölgesel rakip** atanır.
- Derbi haftası: bilet ×1.8, tüm oyuncularda `önemliMaçPerformansı` gizli niteliği devreye girer (±%5 bireysel), Alevlenebilir tipler kırmızı riski ×1.6.
- **Derbi karnesi ayrı tutulur** ve seçimde küçük ama görünür bir duygu kalemidir: dönemde derbi mağlubiyeti > galibiyeti ise taraftar bileşenine −4 ("derbi kaybeden başkan" damgası); üstünlük +4.
- Ezeli rakibin **başkanı da karakterdir**: transferde araya girer (§v3-G rakip kulüp olasılığı onun için ×2), medyada laf sokar, senin seçiminde rakip adaya açık destek verebilir (rakip çekicilik +3).

---

# 4. GENÇ TAKIM GÜNÜ (hafta 17)

FM'de yılın en sevilen inbox mesajı youth intake'tir. Bizde tam sahne:
```
1. Akademi direktörü raporu gelir: bu yılın "mahsulü" — floor(akademi/2) genç
2. Her genç kartı tek tek açılır (kart çevirme animasyonu): 
   görünen aralık (scout sisli), potansiyel YILDIZ derecesi (☆-☆☆☆☆☆), kişilik cümlesi
3. %10 şans: "ALTIN ÇOCUK" — potansiyel 85+ (tüm medya yazar, menajerler üşüşür)
4. Karar: A takıma al / akademide bırak / profesyonel sözleşme (maaş küçük ama kilitler)
```
Altın çocuk çıkarsa 2 sezon içinde büyük kulüpler teklif yağdırır → "sat/tut" gerilimi kendi kendine yazılır. Akademi seviyesi hem adet hem **potansiyel dağılımını** yükseltir: `potansiyel ~ N(50+akademi×3, 12)`.

---

# 5. HAKEM/VAR & DİSİPLİN

Her maçta %10: **tartışmalı karar** olayı (VAR iptali, penaltı). Sonuca xG üzerinden küçük etki zaten var; asıl mekanik **sonrası**:
- İnbox: "Tartışmalı penaltı — basın açıklaması yapacak mısın?" → §v3-F Ateşli ton fırsatı.
- Ateşli seçersen: taraftar +6 (bayrak açarlar), %30 PFDK para cezası (kasa −0.5..2mn), medya tonu −1.
- Sezonda 3+ Ateşli demeç → "kavgacı başkan" etiketi: hakem kararları aleyhine %2 bias (evet, acımasız — gerçekçi).

---

# 6. SPONSOR MARKALARI & ANLAŞMA ÇEŞİTLERİ

Jenerik sektör markaları üretilir (data/sponsors.json): havayolu, bahis(!), banka, enerji içeceği, inşaat, kripto.
| Tür | Getiri | Bedel |
|---|---|---|
| Standart (banka/havayolu) | orta | yok |
| **Bahis** | ×1.4 gelir | taraftar −3, itibar −2 (aile kulübü imajı); Ilımlı grup mektup yazar |
| **Kripto** | ×1.6 ilk sezon | %25 şans: sponsor batar → gelir kesilir + itibar −5 (haber patlaması) |
| **Yerel esnaf paketi** | ×0.6 | taraftar +3 ("bizim kulüp") |
Naming rights (stadyum ≥7): büyük para, ama Nostaljik kurul üyesi loyalty −15 ve radikal grup −8 ("Stadın adı satılmaz!"). Her sponsor kararı kimlik kararıdır.

---

# 7. ŞABLON KÜTÜPHANELERİ (üretim içeriği)

### 7.1 Manşetler (etiket → havuz; slotlar: {oyuncu} {td} {rakip} {sıra} {vaat} {borç})
**ŞAMPİYONLUK_YARIŞI:** "Zirve senin evin mi?" · "{oyuncu} durdurulamıyor: {n} maçta {g} gol" · "Matematik başladı: {kalan} maç, {fark} puan" · "{rakip} kayıp verdi, fırsat haftası"
**KRİZ_KULÜBÜ:** "Soyunma odasında {oyuncu} depremi" · "{td} için geri sayım mı?" · "Tribünden ilk ıslıklar" · "Başkan {ad}: sessizlik mi strateji mi?"
**BORÇ_BATAĞI:** "Maaşlar gecikti iddiası" · "Faiz canavarı: haftada {x}mn eriyor" · "Transfer tahtası kapıda mı?"
**SEÇİM_SATHI:** "{rakip_aday}: '{tutulmayan_vaat} nerede?'" · "Kongre kulisleri hareketli" · "Anket: başkana destek %{p}"
**YENİDEN_DOĞUŞ:** "Küllerinden: {n} maçlık seri" · "Taraftar geri döndü: doluluk %{d}"
**ALTYAPI_DEVRİMİ:** "{genç}: {yaş} yaşında ilk 11'de" · "Akademiden altın nesil mi geliyor?"
**NORMAL:** "Ligde sakin hafta" · "{oyuncu} sözleşme masasında" · "Tesislerde çalışmalar sürüyor"
(+ her havuza 2-3 yedek; toplam ~40. Aynı şablon 6 hafta içinde tekrar seçilmez.)

### 7.2 Maç ticker'ı (pozisyon şablonları, ×30)
Gol: "{dk}' GOOOL! {oyuncu} köşeye bıraktı" / "{dk}' {oyuncu} kafayla ağlarla buluşturdu" / "{dk}' penaltı gole çevrildi: {oyuncu}"
Kaçan: "{dk}' {oyuncu} direkten döndü!" / "{dk}' kaleci köşeden çıkardı, inanılmaz" / "{dk}' boş kale... auta!"
Kart: "{dk}' {oyuncu} oyundan atıldı — on kişiler!" · Tansiyon: "{dk}' tribünler ayakta, tempo yükseliyor"
VAR: "{dk}' VAR inceliyor... gol İPTAL" (bu satır her zaman 2sn gecikmeli yazılır — gerilim)

### 7.3 Inbox gövde şablonları (×25, imzalı)
CFO: "Başkanım, {ay} nakit projeksiyonu ekte. {gelir}mn gelir / {gider}mn gider. {yorum}" (yorum: 3 varyant duruma göre)
Akademi dir.: "{genç} antrenmanda gözlerimizi doldurdu. A takım denemesi öneririm."
Taraftar grubu ({grup_adı}): "Sayın Başkan, {konu} hakkında tribünün sesi..."
Menajer ({tip}): tipine göre 2'şer varyant · TD: taktik/transfer/tesis talep mektupları ×3
Kurul üyesi fısıltısı: "{üye} son toplantıda {konu} konusunda rahatsızlığını dile getirdi." (loyalty<40'ta tetiklenir)

### 7.4 Demeç cevap havuzları
Her ton (§v3-F) × her bağlam (derbi öncesi / kriz / zafer / hakem / rakip aday) = 2'şer hazır cümle → 40 satır. Oyuncu cümleyi seçmez, **tonu** seçer; cümleyi motor atar (çeşitlilik hissi, karar yükü düşük).

---

# 8. GENİŞLETİLMİŞ OLAY HAVUZU (+18)

Format: `ad | tetik | seçenekler [etkiler]`
1. **Maaş gecikmesi dedikodusu** | kasa<5mn | Açıkla[itibar−2, dedikodu biter] / Sessiz kal[%40 büyür: tüm moral−4]
2. **Belediye arsa teklifi** | rastgele %3 | Kabul[antrenman maliyeti −%30 bu dönem] / Red
3. **Efsane futbolcu vefatı** | %1 | Anma organizasyonu[taraftar+4, kasa−0.3] / Sade mesaj[+1]
4. **Yıldızın gece hayatı haberi** | Alevlenebilir tip varsa %4 | Ceza kes[disiplin: kimya+2, o oyuncu moral−8] / Kol kanat ger[oyuncu moral+5, medya tonu−1]
5. **Kombine karaborsası** | doluluk>%95 | Elektronik bilet yatırımı[kasa−2, taraftar+3] / Görmezden gel
6. **Rakipten TD'ne teklif** | TD skoru>75 | Zam yap[wage×1.3, kalır] / Bırak[TD gider, uyum sıfırlanır]
7. **Genç yıldıza AB kulübü kancası** | altın çocuk varsa | Sat[büyük kâr, taraftar−8, akademi imajı−] / Tut+zam / Satış payıyla sat[orta kâr, taraftar−4]
8. **Stat çatısı arızası** | stadyum<4, kış | Acil onarım[−1.5mn] / Ertele[%20 maç günü geliri−, güvenlik haberi itibar−3]
9. **Şike iddiası (asılsız)** | %1, itibar<40 | Hukuki savaş[kasa−1, %80 aklanma→itibar+5] / Sessizlik[itibar−4 kalıcı sis]
10. **Taraftar bağış kampanyası** | BORÇ_BATAĞI etiketi | Kabul[kasa+2..5, ama guven−3: "yönetemiyor" algısı] / Reddet[gurur: taraftar+2]
11. **Ünlü dizi kulübü çekim yapmak istiyor** | %2 | İzin ver[marka+%5, kasa+1, Nostaljik üye −5 loyalty] / Reddet
12. **Toplu sakatlık (grip salgını)** | kış haftaları %3 | Kadro rotasyonu zorunlu 2 hafta [Uygunluk −0.08]
13. **Eski başkan röportajı** | seçim sezonu | Cevap ver[F motoru] / Sessiz[rakip çekicilik +1]
14. **Forma tasarımı krizi** | yeni sezon | Klasik[taraftar+2] / Modern[genç taban+, radikal grup−3] / Taraftar oylaması[+4, üretim gecikir: forma geliri 4 hafta −%20]
15. **Scout'un gizli cevheri** | scout≥6 | Hemen al (sis yüksek, ucuz)[kumar] / Rapor bekle[1 ay, fiyat %20 artabilir]
16. **Kupa maçı seyircisiz cezası** | Ateşli demeç ×3 sonrası | (otomatik) bilet geliri o maç 0
17. **Yerel rakip küme düştü** | bölgesel rakip 17-18. | taraftar+3 (acı tatlı), derbi geliri gelecek sezon yok −
18. **Asistan raporu: TD-yıldız soğukluğu** | oyuncuYonetimi<55 | Araya gir[%50 düzelir / %50 ikisi de −moral] / Karışma[%30 medyaya sızar]

---

# 9. BAŞARIM SİSTEMİ (30)

Kategoriler: **Koltuk** (5 dönem seçil · %70+ oyla seçil · muhalefetten dön) · **Saha** (namağlup şampiyonluk · 3 kupa üst üste · derbide 5'te 5) · **Kasa** (borcu sıfırla · maaş/gelir<%45 bir sezon · 100mn transfer kârı) · **Ocak** (altyapıdan 5 oyuncu ilk 11'de · altın çocuğu efsane yap[90+ ov] · akademi sv10) · **Kimlik** (bahis sponsoru olmadan büyük kulüp ol · stadı taraftar oylamasıyla adlandır · müzeyi aç) · **Acı** (kümeye düş ve 2 sezonda şampiyon ol · seçimi %1 farkla kaybet · iflas eşiğinden şampiyonluğa).
Başarımlar profile işlenir; New Game+ başlangıç bonusu açar (örn. "Efsane Başkan" → yeni oyunda itibar +5 başlar).

---

# 10. GÖRSEL STİL REHBERİ (token'lar)

```css
/* Zemin: gece maçı atmosferi — koyu ama SİYAH DEĞİL (projektör altındaki çim gecesi) */
--bg-0:#0E1420; --bg-1:#151D2E; --bg-2:#1C2740;         /* katman yükseldikçe açılır */
--ink-1:#EDF1F7; --ink-2:#9FACC4; --ink-3:#5E6C87;
--club:#D4A62A(varsayılan altın — kulüp seçiminde kulüp renginden yeniden türetilir)
--pos:#3FBF7F; --neg:#E05252; --warn:#E0A030; --info:#4E8FD9;
--radius:10px; --radius-card:14px;
--space: 4/8/12/16/24/32;                                 /* 4px taban ritim */
--shadow-card: 0 4px 16px rgba(0,0,0,.35);
```
**Tipografi:** Başlık = dar, yüksek kondanse grotesk (skor tabelası ruhu; ör. "Archivo Expanded/Barlow Condensed" sınıfı) — SADECE skor, gauge sayıları, ekran başlıkları. Gövde = okunur hümanist sans. Veri/tablolar = tabular-nums zorunlu (sayılar titremesin).
**İmza görsel öğe:** *stadyum skorbordu estetiği* — gauge'lar ve skorlar hafif LED-nokta dokusuyla çizilir; oyunun hatırlanacağı tek risk bu, gerisi disiplinli ve sakin.
**Bileşen kuralları:** kart iç boşluk 16, kartlar arası 12; bir ekranda en fazla 2 vurgu rengi anı; kritik olay kartı tam ekran + kırmızı vinyet (§v3-J); pozitif/negatif renkler asla metin gövdesinde, sadece delta rozetlerinde.

---

# 11. SES TASARIMI (minimal, 12 ses)

tık (nav) · DEVAM (kalın tık) · inbox düşüş (kağıt) · gol (kısa tribün patlaması) · kaçan (of! nidası) · kart (düdük) · kriz kartı (bas vuruş) · kasa+ (madeni) · kasa− (boğuk) · seçim sayım (kalp ritmi loop, yavaşlar) · zafer (tribün marşı 3sn) · yenilgi (uğultu söner).
Ambiyans: maç ekranında düşük tribün uğultusu (momentum şeridiyle şiddeti oynar). Hepsi kapatılabilir; varsayılan %60.

---

# 12. ONBOARDING (ilk 30 dakika)

Öğretici ayrı mod DEĞİL; ilk sezonun kendisi öğretir (FM ilkesi):
```
Hafta 0: Kulüp seçimi → SADECE Orta kulüp önerilir işaretle (Küçük=zor, Büyük=borç uzmanlığı)
         Vaat ekranı: ilk oyunda max 2 vaat + zorluk 4-5 kartlarda "iddialı" uyarı rozeti
Hafta 1-3: her yeni ekran ilk açılışta TEK cümlelik ipucu balonu (toplam 8 balon, bir daha çıkmaz)
Hafta 4: ilk aksiyonlu inbox garantili kolay karar (bilet fiyatı mektubu)
Hafta 8: ilk derbi → maç günü fazları burada tanıtılır
Hafta 12: ilk kurul sunumu → guven mekaniği anlatılır (tek balon)
Devre arası: "danışman" karakteri (genel menajer) ilk pencereyi adım adım yorumlar
```
Danışman sonrasında da kalır: her büyük karardan önce tek satır görüş verir (kapatılabilir). Görüşü %85 makul, %15 yanılır — kör güven cezalandırılır.

---

# 13. ZORLUK PRESETLERİ + TEST SENARYOLARI

| Parametre | Kolay | Normal | Zor | Efsane |
|---|---|---|---|---|
| faiz taban | 0.24 | 0.32 | 0.38 | 0.44 |
| şans bandı | ±0.05 | ±0.08 | ±0.10 | ±0.10 |
| olay/tick | %8 | %12 | %15 | %18 |
| rakip AI transfer zekası | pasif | orta | agresif | agresif+ |
| beklenti sertliği (delta katsayısı) | ×4 | ×6 | ×8 | ×10 |
| sis tabanı | 6 | 10 | 12 | 14 |
| seçim eşiği | %47 | %50 | %52 | %55 |

**Denge test senaryoları (otomatik sim ile koşulmalı):**
T1 Popülist: fiyat 0.6 + 3 yıldız borçla → beklenen: S1-2 oy yüksek, S3 mali çöküş, seçim kaybı ≥%70 olasılık.
T2 Cimri: hiç transfer, borç kapat → beklenen: S1 taraftar düşer ama seçim kazanma ~%55 (son sezon ağırlığı çalışıyor mu?).
T3 Dengeli: 1 akıllı transfer + tesis → kazanma %60-70 bandı.
T4 Küçük kulüp merdiveni: 3 dönemde Orta'ya terfi mümkün ama garantisiz olmalı.
Her senaryo 500 sim; bant dışıysa CFG katsayıları oynanır (önce INERTIA ve seçim ağırlıkları DEĞİL, gelir/faiz katsayıları).

---

# 14. VERİ DOSYALARI (data/*.json örnek şemalar)

```
data/
  teams.json      → 18 takım: {id, name:"Yeşilyurt SK", city, colors:[hex,hex], baseStrength, rival:bool}
                    (isimler kurgusal: Kartalspor, Boğaziçi FK, Anadolu Gücü, Liman SK, Bozkır 1923...)
  names.json      → { first:[...200 Türk erkek adı], last:[...200 soyad], foreign:{br:[],ar:[],eu:[]} }
                    oyuncu üretimi: %70 yerli, %30 yabancı havuzdan
  coaches.json    → 12 TD: {name, archetype:"oyun kurucu|savunmacı|motivatör|genç işçisi", stats{...}, wage, minReputation}
  agents.json     → 10 menajer {name, type(§2.2), clients:[playerId]}
  sponsors.json   → 14 marka {name:"AeroTürk", sector, tier, riskProfile}
  media.json      → 3 gazeteci + tüm şablon havuzları (§7) — şablonlar KODDA DEĞİL veride (kolay genişletme)
  events.json     → olay havuzu (§Bible-14 + §8) aynı format
  boardnames.json → kurul üyesi isim/arketip havuzu
  achievements.json → 30 başarım {id, koşul(DSL string), ödül}
```
Koşul DSL örneği: `"season.champion && season.losses==0"` → basit eval'siz parser (güvenli).

---

# 15. UZUN OYUN & MİRAS (10+ sezon)

- **Efsane statüsü:** 4+ dönem seçilirsen "kulüp tarihinin en uzun süreli başkanı" anlatısı; müzede büstün (görsel).
- **Nesil değişimi:** altın çocukların kariyeri yaşlanınca kapanır → jübile sahnesi (taraftar +5, duygu anı); jübile yapmadan satarsan Nostaljik üye ve radikal grup affetmez.
- **Kulüp seviye atlama** (§Bible-20): Küçük→Orta→Büyük geçişinde tierBase gelirler, beklenti ve rakip kalitesi kademeli yükselir (şok değil, 1 sezon geçiş).
- **Oyun sonu ekranı** (kariyer kapanınca — 2 seçim kaybı veya emeklilik seçimi):
```
KARİYER KARNESİ: dönem sayısı, kupa vitrini, toplam oy ortalaması, borç grafiği (ilk gün→son gün),
yetiştirilen yıldızlar, en unutulmaz 5 an (olay logundan otomatik seçilir: en yüksek |etki|li anlar),
tek cümlelik tarih yazımı: "Tarih onu {etiket} olarak hatırlayacak" 
   etiket = karneden: "Kurtarıcı" / "Şampiyonlar Çağının Mimarı" / "Popülist" / "Muhasebeci" / "Efsane"
```
Bu son cümle, oyuncunun 10 sezonluk tüm kararlarının tek satırlık aynasıdır — oyunun gerçek final ödülü.

---

## Üç dosyanın birlikte kullanımı (VS'ye talimat önerisi)
> "Bu 3 dökümanı oku: Bible (motorlar), v3 (UI+akış), v4 (içerik+veri). §v4-K... yok — modül sırası §v3-K'da. Önce data/*.json dosyalarını v4-§14 şemasına göre üret, sonra motorları kur, UI'yı v3-C + v4-§10 stil token'larıyla giydir. Denge testlerini v4-§13 senaryolarıyla koş."
