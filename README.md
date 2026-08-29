# AutoRAG — Yerel Otomobil Bilgi ve Piyasa Asistanı

AutoRAG, otomobiller hakkında Türkçe soruları **yerel veri kaynaklarına dayanarak** yanıtlayan bitirme projesi prototipidir. Araç teknik verilerini, örnek piyasa kayıtlarını ve genel otomotiv bilgi bankasını tarar; yanıtın sonunda kullanılan kaynağı gösterir.

> Bu proje yatırım, satış veya ekspertiz tavsiyesi değildir. Piyasa sonuçları anlık ilan verisi değil, uygulamaya yüklenmiş kayıtların istatistiksel özetidir.

## Proje amacı

Amaç; bir dil modelinin genel bilgisini tek başına kullanmak yerine, seçili otomotiv verisini soruyla ilişkilendirip (Retrieve), bu bağlamla yanıt üretmektir (Augment + Generate). Bu yaklaşım RAG — *Retrieval-Augmented Generation* olarak adlandırılır.

Uygulama şu soru tiplerini hedefler:

- `2018 Passat ile 2016 Jetta özelliklerini karşılaştır.`
- `2021 Corolla'nın yakıt tüketimi ve piyasa aralığı nedir?`
- `DSG şanzıman nedir, ikinci elde neye bakmalıyım?`
- `Elektrikli araç alırken nelere dikkat edilmelidir?`

## Özellikler

- Türkçe, mobil uyumlu sohbet arayüzü
- 25 yaygın araç için teknik özellik sorgulama
- Araç karşılaştırma
- CSV tabanlı piyasa min–maks–ortalama hesaplama
- Genel otomotiv bilgi bankası: şanzıman, bakım, lastik, fren, DPF, hibrit/elektrik, sigorta ve ikinci el araç alma
- Yanıtta kaynak başlığını gösterme
- Harici bağımlılık olmadan çalışma
- İsteğe bağlı Microsoft Foundry Local ile yerel LLM kullanımı

## Mimari

```text
Kullanıcı sorusu
      |
      v
Anahtar kelime tabanlı yerel getirme katmanı
      |-----------------------------|
      v                             v
Araç teknik verisi            Genel otomotiv bilgisi
Piyasa CSV kayıtları                  |
      |-----------------------------|
                    v
        Kaynaklı yanıt / Foundry Local LLM
                    v
              Tarayıcı arayüzü
```

Varsayılan modda sistem, kolay denetlenebilen yerel arama ve şablonlu yanıt üretimi kullanır. Foundry Local yapılandırıldığında aynı bağlam, yerel LLM'e gönderilir ve daha doğal yanıt üretilebilir.

## Gereksinimler

- Windows 10/11, macOS veya Linux
- [Node.js](https://nodejs.org/) 20+ (bu projede Node.js 24 ile test edilmiştir)
- Tarayıcı
- Opsiyonel: Microsoft Foundry Local

## Kurulum ve çalıştırma

```powershell
# Proje dizinine gidin
cd autorag-local

# Harici npm paketi gerekmez
npm start
```

Tarayıcıdan aşağıdaki adresi açın:

```text
http://127.0.0.1:3000
```

Geliştirme sırasında otomatik yeniden başlatma için:

```powershell
npm run dev
```

## Foundry Local ile yerel LLM (opsiyonel)

1. Foundry Local'ı sisteminize kurun.
2. Yerel OpenAI-uyumlu sunucuyu çalıştırın ve kullanılacak modeli seçin.
3. Aşağıdaki ortam değişkenlerini kendi uç noktanıza göre tanımlayın:

```powershell
$env:FOUNDRY_LOCAL_URL = "http://127.0.0.1:5273/v1"
$env:FOUNDRY_MODEL = "MODEL_ADI"
npm start
```

Uygulama bağlantı kurulamazsa hata vermek yerine yerel arama modunda yanıtlamaya devam eder. Uç nokta ve model adı Foundry Local sürümüne göre değişebilir.

## Veri kaynakları

| Dosya | İçerik | Kullanım |
|---|---|---|
| `data/vehicles.json` | Marka, model, yıl, motor, tüketim, güvenlik ve notlar | Teknik soru ve karşılaştırma |
| `data/market_prices.csv` | Tarihli kilometre/fiyat kayıtları | Piyasa aralığı hesabı |
| `data/general_auto_knowledge.json` | Genel otomotiv konu kartları | Model bağımsız sorular |

### Yeni araç ekleme

`data/vehicles.json` içine aşağıdaki biçimde bir nesne ekleyin:

```json
{
  "id": "marka-model-yil-paket",
  "brand": "Marka",
  "model": "Model",
  "year": 2024,
  "trim": "Paket",
  "bodyType": "SUV",
  "fuel": "Benzin",
  "transmission": "Otomatik",
  "engine": "1.5 L turbo",
  "power": "150 hp",
  "torque": "250 Nm",
  "consumption": "6.0 L/100 km (karma)",
  "trunk": "500 L",
  "safety": "Güvenlik donanımı",
  "features": "Öne çıkan donanımlar",
  "notes": "Kontrol edilmesi gerekenler",
  "source": "Kaynak adı ve tarihi"
}
```

Piyasa kaydı için `market_prices.csv` dosyasına şu düzenle satır ekleyin:

```csv
brand,model,year,trim,km,priceTry,recordedAt,source
Marka,Model,2024,Paket,45000,1500000,2026-08-29,Kendi doğrulanmış veri kaynağım
```

Dosyayı değiştirdikten sonra sunucuyu yeniden başlatın. Gerçek proje sunumunda teknik değerleri üreticinin güncel broşüründen, piyasa verilerini ise kullanım hakkı olan/açık kaynaklardan doğrulayın.

## Proje yapısı

```text
autorag-local/
├── data/
│   ├── vehicles.json                 # Araç teknik veri seti
│   ├── market_prices.csv             # Örnek piyasa kayıtları
│   └── general_auto_knowledge.json   # Genel otomotiv bilgi bankası
├── public/
│   ├── index.html                    # Arayüz iskeleti
│   ├── styles.css                    # Arayüz tasarımı
│   └── app.js                        # Tarayıcı tarafı sohbet akışı
├── server.mjs                        # HTTP API, getirme ve yanıt mantığı
├── package.json
├── LICENSE
└── README.md
```

## API

### `POST /api/chat`

İstek:

```json
{ "question": "2021 Corolla özellikleri neler?" }
```

Yanıt; metin, çalışma modu ve kullanılan kaynakları içerir.

### `GET /api/vehicles`

Yüklü araç teknik verilerini JSON olarak döndürür.

## GitHub'a yükleme

1. GitHub'da boş bir depo oluşturun; örneğin `autorag-local`.
2. ZIP dosyasını çıkarın ve proje klasöründe terminal açın.
3. Aşağıdaki komutları çalıştırın. `KULLANICI_ADI` kısmını GitHub kullanıcı adınızla değiştirin.

```powershell
git init
git add .
git commit -m "Initial commit: AutoRAG local automotive assistant"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADI/autorag-local.git
git push -u origin main
```

Alternatif olarak GitHub deposunda **Add file → Upload files** seçeneğiyle ZIP'i çıkardıktan sonra tüm proje dosyalarını yükleyebilirsiniz. `.env` gibi kişisel ayar dosyalarını paylaşmayın; yalnızca örnek olarak verilen `.env.example` dosyası depoda kalmalıdır.

## Sınırlılıklar ve sonraki geliştirmeler

Bu sürüm bir MVP'dir. Arama yöntemi açıklanabilirlik için anahtar kelime puanlaması kullanır; her şeyi bilen bir yapay zekâ değildir. Geliştirme fikirleri:

1. Yönetim paneli ile CSV/Excel yükleme
2. Embedding modeli ve vektör veritabanı (SQLite/Chroma) ile anlamsal arama
3. Foundry Local üzerinden Phi ailesi gibi yerel bir modelle üretken yanıtlar
4. Kaynak URL'si, veri tarihi ve güven skoru gösterimi
5. Kullanıcıların bütçe, yakıt, vites ve kasa tipiyle araç önerisi alabilmesi
6. Test veri seti ve sorgu değerlendirme metrikleri

## Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır.
