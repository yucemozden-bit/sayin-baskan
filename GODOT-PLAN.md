# SAYIN BAŞKAN → GODOT TAŞIMA PLANI (keşif)

> Amaç: HTML/JS prototipi **tasarım dokümanı** olarak olgunlaştıktan sonra oyunu
> Godot 4.x'e taşıyıp Steam'de yayınlamak. Bu doküman taşıma stratejisini,
> birebir eşlemeleri ve risklere karşı önlemleri kayda geçirir.

## 1) Sürüm ve dil kararı
- **Godot 4.3+ (stable)**. 4.x'in Control/Theme sistemi bu oyunun panel-ağırlıklı
  UI'ı için biçilmiş kaftan; 3.x'e gitmek için hiçbir sebep yok.
- **GDScript** (C# değil). Tek kişilik iş akışında iterasyon hızı öncelikli;
  simülasyon hesapları hafif (haftada birkaç bin aritmetik işlem), C#'ın
  performans avantajına ihtiyaç yok. GodotSteam da GDScript ile sorunsuz.

## 2) Mimari eşleme (JS → Godot)
| Prototipte | Godot'ta |
|---|---|
| `G` state nesnesi | `GameState.gd` **autoload** (tek gerçek kaynak; Dictionary tabanlı kalır) |
| `src/actions.js` (saf fonksiyonlar) | `game/actions/*.gd` — `static func` modülleri, aynı imzalar |
| `src/engines/*` | `game/engines/*.gd` birebir |
| `src/core/rng.js` (mulberry32) | `game/core/rng.gd` — **birebir port** (aşağıda determinizm bölümü) |
| `mh32`/`h32` string hash'leri | `game/core/hash.gd` — birebir port |
| `src/data/*.json` | `res://data/*.json` aynen; `JSON.parse_string` |
| Ekran sistemi (`go("AD")`, `render()`) | `SceneManager` autoload + ekran başına bir **Control sahnesi** (`scr_title.tscn`, `scr_office.tscn`…) |
| HTML şablon string'leri | Control düğümleri + `Theme` resource (kod-üretimli listeler için `VBoxContainer` fabrikaları) |
| CSS `:root` paleti | `theme/baskan.theme` — aynı renkler: zemin `#070b14`, panel `#0e1526`, çizgi `#1c2740`, metin `#dbe2f0`, soluk `#5f6b85`, altın `#d4a940`/`#f0cd6e` |
| SVG avatar/arma üretimi | Godot SVG import (statik) — deterministik avatarlar için `Polygon2D`/`draw_*` ile aynı hash→renk/stil mantığı |
| `localStorage` otokayıt | `user://save/auto.json` — aynı serialize şeması (`stateVersion` + `migrateLoaded` portu) |
| `fitVaat()` no-scroll ölçekleyici | Godot'ta gereksiz: `Container` + anchor sistemi; tasarım çözünürlüğü 1920×1080, `content_scale_mode = canvas_items` |
| `node tests/*.mjs` | **GUT** test framework — aynı test isimleri, aynı bantlar |

## 3) DETERMİNİZM SÖZLEŞMESİ (en kritik taşıma riski)
Prototipin kutsal kuralı Godot'ta da geçerli: ana RNG akışı hafta simülasyonunda
sabit; prosedürel içerik yerel hash RNG kullanır.

- **mulberry32 birebir port**: GDScript `int` 64-bit — her adımda `& 0xFFFFFFFF`
  maskele. Bölme `/ 4294967296.0` float64; IEEE754 aynı → aynı seed aynı sayı dizisi.
- **Yuvarlama tuzağı**: JS `Math.round(-0.5) = -0`, GDScript `round(-0.5) = -1`.
  Tüm yuvarlamalar tek yardımcıya toplanır: `Num.jround(x)` (JS davranışını taklit:
  `floor(x + 0.5)`).
- **Sort kararlılığı**: JS `sort` stable; Godot `Array.sort_custom` stable DEĞİL.
  Her sıralamaya deterministik son-anahtar (id) eklenir.
- **String hash**: `charCodeAt` ↔ `unicode_at` — Türkçe karakterlerde aynı code
  point'i verir; `>>> 0` yerine `& 0xFFFFFFFF`.
- **GOLDEN MASTER testi** (portun doğruluk kanıtı): JS tarafında
  `setSeed(4242) → 34 hafta → fingerprint JSON` dök (`tests/derin.test.mjs`
  fingerprint fonksiyonu hazır). GDScript aynı seed'le AYNI fingerprint'i
  üretmek zorunda. Bu test yeşilse motor portu bitmiştir — tartışmasız.

## 4) Taşıma sırası (faz faz — her faz kendi testiyle kapanır)
1. **Çekirdek**: `rng.gd`, `hash.gd`, `config.gd` (TUNING/DIFFICULTY/TIERS) +
   golden-master fixture üretimi JS'ten. *Kapanış: rastgele sayı dizisi ve hash
   değerleri JS çıktısıyla birebir.*
2. **Motor**: `engines/*` + `actions.gd` (UI'sız, headless). *Kapanış: golden
   master fingerprint eşleşir; GUT'a taşınan bant testleri (autoplay/balance)
   yeşil.*
3. **Kabuk**: SceneManager + Theme + title ekranı. *Kapanış: görsel dil onayı.*
4. **Ekranlar**: prototipteki sırayla (title→setup→office→…) — HTML'deki her
   panelin Control karşılığı. Prototip ekran görüntüleri referans.
5. **Kayıt + Steam**: `user://` kayıt, GodotSteam (achievements ↔ `achUnlocked`,
   Rich Presence hafta/sezon). Steam sayfası: "pre-generated AI assets" beyanı
   (görsel üretilirse), kurgusal isim garantisi.

## 5) Şimdiden (prototipte) korunacak disiplinler
Bunlar zaten CLAUDE.md kuralı — Godot'a bedava taşınma garantisi:
- `actions.js` DOM'a dokunmaz (headless test edilebilir) → GDScript'e mekanik çeviri.
- UI dosyaları yalnız string üretir → Control ağacına çeviri şablonu bellidir.
- JSON veri şemaları donuk; `stateVersion`/`migrateLoaded` göçü Godot'ta da aynı.
- Testler davranış sözleşmesi: her bant/kural GUT'a birebir taşınır.

## 6) Bilinçli ERTELENEN kararlar
- Dil desteği (TR dışında EN?) — Steam görünürlüğü için muhtemelen gerekli;
  taşımada `tr()` çağrılarıyla hazırlanır, çeviri sonra.
- Ses/müzik üretimi (CC0 havuz veya sipariş) — faz 3'te seçilir.
- Mobil/konsol portu — kapsam dışı; Steam masaüstü tek hedef.

## 7) İlk somut adım (başlama işareti geldiğinde)
`godot/` klasöründe boş proje + faz 1 (rng/hash/config portu + golden master).
Tahmini eforlar: faz 1-2 motor portu işin ~%40'ı, ekranlar ~%50, Steam ~%10.
