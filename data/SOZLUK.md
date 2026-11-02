# Veri Sözlüğü (Data Dictionary) - `data/oturumlar.csv`

Bu doküman, Data On-Call v2 kapsamında toplanan oyuncu oturum verilerinin (`data/oturumlar.csv`) şemasını, her sütunun tanımını, izin verilen değerlerini ve model özellikleri (features) ile analiz alanları arasındaki ayrımı tanımlar.

---

## 1. KVKK ve Gizlilik Bildirimi (Privacy Notice)
- **Kişisel Veri İçermez:** Sistem hiçbir isim, e-posta, telefon numarası, IP adresi, cihaz kimliği, donanım parmak izi, tarayıcı başlığı veya coğrafi konum bilgisi toplamaz ve saklamaz.
- **Rastgele Oturum Kimliği:** `oturum` kolonu, istemci tarafında `crypto.getRandomValues` kullanılarak üretilen rastgele onaltılık (hex) bir dizedir. Oyuncunun kimliği veya ortamı ile hiçbir matematiksel ya da mantıksal bağıntısı yoktur.
- **Kullanım Amacı:** Yalnızca makine öğrenmesi modeli eğitimi (riskli karar tahmini) ve eğitimsel oyun akış analizi amacıyla anonim olarak işlenir.

---

## 2. Model Özellikleri (Features) vs. Analiz Alanları

| Kategori | Kolonlar | Açıklama |
|---|---|---|
| **Model Özellikleri (Features)** | `seviye`, `hedef`, `sahne_no`, `onceki_ipucu_sayisi`, `onceki_riskli_sayisi`, `onceki_timeout_sayisi`, `onceki_karar_suresi_sn` | Sahnenin **başında** bilinen değerlerdir. Model tahmin anında yalnızca bu özellikleri kullanır. Mevcut sahneye ait hiçbir veri model girdisi olamaz (veri sızıntısını önler). |
| **Hedef Etiket (Label)** | `secim_riskli` | Modelin tahmin etmeyi hedeflediği ikili sınıflandırma çıktısı (`0` veya `1`). |
| **Analiz Alanları (Non-Feature)** | `ipucu_bu_sahne`, `karar_suresi_sn` | **Logged for analysis, NOT a model feature (describes the current scene).** Yalnızca karar sonrasında gözlemlenip sonradan analiz için günlüğe yazılır; model girdisi olarak kesinlikle kullanılamaz. |
| **Üstveri (Metadata)** | `oturum`, `kaynak` | Oturum gruplama ve veri kaynağı doğrulama için kullanılır. |

---

## 3. Kolon Tanımları ve Değer Aralıkları

### 1. `oturum`
- **Tanım:** Oturum başına istemcide oluşturulan benzersiz rastgele kimlik.
- **Rol:** Üstveri (Gruplama / Grouped CV ayrımı için).
- **Tip / Birim:** Karakter dizisi (hex string, 16–64 karakter).
- **İzin Verilen Değerler:** Küçük harf onaltılık karakterler (`^[a-f0-9]{16,64}$`).
- **Toplanma Şekli:** Oyun başlangıcında istemcide `crypto.getRandomValues` ile türetilir.

### 2. `sahne_no`
- **Tanım:** Kararın ait olduğu sahne sıra numarası.
- **Rol:** **Model Girdisi (Feature)**.
- **Tip / Birim:** Tamsayı (Ordinal Integer).
- **İzin Verilen Değerler:** `1`, `2`, `3`.
- **Toplanma Şekli:** Oyun akışında mevcut sahne indeksi + 1.

### 3. `seviye`
- **Tanım:** Oyuncunun giriş ekranında seçtiği deneyim düzeyi.
- **Rol:** **Model Girdisi (Feature)**.
- **Tip / Birim:** Kategorik tamsayı kodu.
- **İzin Verilen Değerler:**
  - `0`: Beginner (Başlangıç)
  - `1`: Experienced (Deneyimli)
- **Toplanma Şekli:** Giriş (Intake) ekranı seçimi.

### 4. `hedef`
- **Tanım:** Oyuncunun giriş ekranında seçtiği öğrenme hedefi.
- **Rol:** **Model Girdisi (Feature)**.
- **Tip / Birim:** Kategorik tamsayı kodu.
- **İzin Verilen Değerler:**
  - `0`: Internship prep (Staj mülakatlarına hazırlık)
  - `1`: Keep up with trends (Güncel pratikleri takip etme)
  - `2`: Use AI effectively (Yapay zekayı güvenle kullanma)
- **Toplanma Şekli:** Giriş (Intake) ekranı seçimi.

### 5. `onceki_ipucu_sayisi`
- **Tanım:** Bu sahneye gelene kadar önceki sahnelerde açılan toplam ipucu adedi.
- **Rol:** **Model Girdisi (Feature)**.
- **Tip / Birim:** Tamsayı (Adet).
- **İzin Verilen Değerler:** `0` ile `3` arası tamsayı (Sahne 1 için her zaman `0`).
- **Toplanma Şekli:** Sahne başlangıcında birikimli toplamdan okunur.

### 6. `onceki_riskli_sayisi`
- **Tanım:** Bu sahneye gelene kadar önceki sahnelerde yapılan toplam riskli karar ve zaman aşımı sayısı.
- **Rol:** **Model Girdisi (Feature)**.
- **Tip / Birim:** Tamsayı (Adet).
- **İzin Verilen Değerler:** `0` ile `3` arası tamsayı (Sahne 1 için her zaman `0`).
- **Toplanma Şekli:** Sahne başlangıcında geçmiş kararların risk kontrolünden hesaplanır.

### 7. `onceki_timeout_sayisi`
- **Tanım:** Bu sahneye gelene kadar önceki sahnelerde sürenin dolmasıyla oluşan zaman aşımı adedi.
- **Rol:** **Model Girdisi (Feature)**.
- **Tip / Birim:** Tamsayı (Adet).
- **İzin Verilen Değerler:** `0` ile `3` arası tamsayı (Sahne 1 için her zaman `0`).
- **Toplanma Şekli:** Sahne başlangıcında geçmiş zaman aşımlarından sayılır.

### 8. `onceki_karar_suresi_sn`
- **Tanım:** Bir önceki sahnede karara varılana kadar geçen süre (saniye cinsinden).
- **Rol:** **Model Girdisi (Feature)**.
- **Tip / Birim:** Ondalıklı / Gerçel sayı (Saniye).
- **İzin Verilen Değerler:** $\ge 0.0$ (Sahne 1 için her zaman `0.0`).
- **Toplanma Şekli:** Önceki sahnenin ölçülen karar süresi aktarılır.

### 9. `ipucu_bu_sahne`
- **Tanım:** Bu sahnede ipucu düğmesine basılıp basılmadığı.
- **Rol:** **logged for analysis, NOT a model feature (describes the current scene).**
- **Tip / Birim:** İkili tamsayı göstergesi (Binary Flag).
- **İzin Verilen Değerler:**
  - `0`: Bu sahnede ipucu açılmadı
  - `1`: Bu sahnede ipucu açıldı
- **Toplanma Şekli:** İstemcide sahne sırasında ipucu butonunun durumu.

### 10. `karar_suresi_sn`
- **Tanım:** Bu sahnede kart görüntülendikten kararın verilmesine (veya timeout olmasına) kadar geçen net süre.
- **Rol:** **logged for analysis, NOT a model feature (describes the current scene).**
- **Tip / Birim:** Ondalıklı / Gerçel sayı (Saniye, 2 ondalık basamaklı veya kayan nokta).
- **İzin Verilen Değerler:** $\ge 0.0$ (Maksimum pratik sınır $\approx 600.0$).
- **Toplanma Şekli:** Sahne yüklenişi ile karar anı arasındaki zaman damgası farkı (`(Date.now() - startTime) / 1000`).

### 11. `secim_riskli`
- **Tanım:** Oyuncunun bu sahnedeki kararının riskli olup olmadığı (veya sürenin dolup dolmadığı).
- **Rol:** **Hedef Etiket (Supervised Target Label)**.
- **Tip / Birim:** İkili tamsayı göstergesi (Binary Flag).
- **İzin Verilen Değerler:**
  - `0`: Güvenli / İyi seçenek seçildi (`isGood === true`)
  - `1`: Riskli seçenek seçildi (`isGood === false`) veya zaman aşımı (`timedOut === true`)
- **Toplanma Şekli:** Karar verildiğinde kural motoru tarafından işaretlenir.

### 12. `kaynak`
- **Tanım:** Veri satırının kayıt kaynağı türü.
- **Rol:** Üstveri (Veri güvenilirliği doğrulaması).
- **Tip / Birim:** Karakter dizisi (Sabit metin).
- **İzin Verilen Değerler:** Yalnızca `"gercek"` (normal oyun oynanışı).
- **Toplanma Şekli:** İstemci telemetri servisi tarafından sabit atanır.
