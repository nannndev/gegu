# PRD — GeoGuess: Game Tebak Wilayah (Web-Based)

**Version:** 1.0
**Owner:** Nande (Yubiteck)
**Status:** Draft — ready for implementation
**Target reader:** Coding agent / developer

---

## 1. Ringkasan

Web game untuk tebak-tebakan wilayah geografis dunia dengan interaksi **klik di peta**. Pemain diberi nama wilayah lalu mengklik lokasi yang benar di peta interaktif, atau sebaliknya (outline wilayah menyala, pemain menebak namanya). Tujuan: seru-seruan + edukatif.

**Scope MVP:** Level negara sedunia. Provinsi (drill-down per negara, mulai Indonesia) = fase berikutnya, bukan MVP.

---

## 2. Goals & Non-Goals

### Goals (MVP)
- Peta dunia interaktif dengan outline tiap negara (GeoJSON).
- 2 mode permainan dalam satu menu.
- Sistem skor, streak, dan feedback visual (benar/salah).
- Jalan di browser tanpa backend (fully client-side).
- Ringan & responsif (desktop + mobile).

### Non-Goals (MVP)
- Tidak ada Google Street View / GeoGuessr-style foto lokasi.
- Tidak ada backend/database/login.
- Tidak ada multiplayer real-time.
- Tidak ada level provinsi (disiapkan arsitekturnya, tapi tidak diimplementasi dulu).

---

## 3. Target Platform & Constraints

- **Platform:** Web (desktop & mobile browser modern: Chrome, Firefox, Safari, Edge).
- **Deployment:** Static hosting (Vercel/Netlify/GitHub Pages).
- **Bahasa UI:** Bilingual — default Indonesia, ada toggle EN (opsional MVP, nice-to-have).
- **Offline-friendly:** GeoJSON di-bundle lokal (jangan fetch tiap load), supaya cepat & tidak tergantung API eksternal.

---

## 4. Tech Stack

| Layer | Pilihan | Alasan |
|---|---|---|
| Framework | **Nuxt 4** (Vue 3) | Sesuai stack Nande; struktur `app/` baru, auto-import, mudah deploy |
| Rendering mode | **SPA / `ssr: false`** untuk halaman game | Leaflet butuh `window`; game tidak butuh SEO. Alternatif: SSR on tapi map di-mount client-only (lihat 4.1) |
| Map engine | **Leaflet.js** | Gratis, ringan, GeoJSON support native, event klik mudah |
| Tiles | OpenStreetMap / CartoDB Positron | Gratis, tanpa API key. CartoDB light lebih clean utk game |
| Data boundary | **GeoJSON world countries** | Natural Earth 1:110m (ringan) atau world-countries dataset |
| Data atribut | **REST Countries API** (opsional, cache lokal) | Nama, bendera, ibukota, region — untuk clue tambahan |
| State | **Pinia** (`@pinia/nuxt`) | Kelola skor, mode, ronde |
| Styling | **Tailwind** (`@nuxtjs/tailwindcss`) atau UnoCSS | Cepat, konsisten |

### 4.1 Catatan penting Nuxt 4 + Leaflet (SSR gotcha)

Leaflet mengakses `window`/`document` saat import → **error kalau di-render di server**. Wajib salah satu strategi ini:

- **Strategi A (paling simpel, rekomendasi MVP):** set `ssr: false` di `nuxt.config.ts` → aplikasi jadi SPA penuh. Game tidak butuh SEO, jadi ini aman.
- **Strategi B (SSR tetap on):** bungkus komponen peta dalam `<ClientOnly>` dan import Leaflet secara dinamis di dalam `onMounted`:
  ```ts
  onMounted(async () => {
    const L = await import('leaflet')
    await import('leaflet/dist/leaflet.css')
    // init map di sini
  })
  ```
- Jangan `import 'leaflet'` di top-level file yang ikut ke-SSR.
- CSS Leaflet: import via `onMounted` (Strategi B) atau daftarkan di `nuxt.config.ts` → `css: ['leaflet/dist/leaflet.css']` (aman, CSS tidak sentuh `window`).
- **Opsi paket siap-pakai:** `@nuxtjs/leaflet` atau `vue-leaflet` (`@vue-leaflet/vue-leaflet`) sudah handle client-only. Boleh dipakai, tapi untuk kontrol event klik per-layer yang presisi, Leaflet murni sering lebih fleksibel.

> **Catatan data:** Simpan file GeoJSON di `app/assets/data/countries.geo.json` (atau `public/data/` kalau mau di-fetch runtime). Sumber rekomendasi: Natural Earth `ne_110m_admin_0_countries` (resolusi 110m = cukup untuk game, ukuran kecil). Untuk resolusi lebih halus pakai 50m, tapi hati-hati ukuran file. Di Nuxt 4 default source dir adalah `app/`.

---

## 5. Game Modes

### Mode A — "Find on Map" (Cari di Peta)
1. Sistem tampilkan nama negara acak (mis. "Klik: **Brazil**").
2. Pemain klik area di peta.
3. Sistem cek: apakah titik klik berada di dalam polygon negara target?
   - **Benar** → highlight negara hijau, +skor, next round.
   - **Salah** → highlight negara yang diklik merah + tampilkan negara benar (hijau), streak reset.

### Mode B — "Name the Region" (Tebak Nama)
1. Sistem highlight outline satu negara acak (warna mencolok, auto-zoom ke bounding box negara itu).
2. Tampilkan 4 pilihan nama negara (multiple choice).
3. Pemain klik jawaban.
   - **Benar** → +skor, next.
   - **Salah** → tandai jawaban benar, streak reset.

### Menu / Mode Selector
- Landing screen: pilih **Mode A** atau **Mode B**.
- Opsi tambahan (nice-to-have): filter region (All / Asia / Europe / Africa / Americas / Oceania) untuk memperkecil scope.

---

## 6. Core Mechanics & Rules

### Skor
- Jawaban benar: **+10 poin**.
- Bonus streak: **+2 poin per streak** (streak ke-3 = +6 bonus, dst). Contoh formula: `poin = 10 + (streak * 2)`.
- Jawaban salah: skor tidak berkurang, tapi **streak reset ke 0**.

### Nyawa / Ronde
- Pilih salah satu model (rekomendasi: **model ronde**):
  - **Model ronde:** 10 ronde per sesi, di akhir tampilkan skor total + akurasi (%).
  - **Model nyawa:** 3 nyawa, salah = kurang 1 nyawa, habis = game over. (alternatif)
- MVP pakai **model ronde (10 ronde)**.

### Timer (nice-to-have)
- Timer per ronde (mis. 15 detik). Habis waktu = dianggap salah.
- Bisa di-toggle on/off.

### Anti-repeat
- Dalam satu sesi, negara yang sudah muncul tidak diulang sampai pool habis.

---

## 7. Detail Teknis Penting

### 7.1 Deteksi klik dalam polygon (Mode A)
- Gunakan **point-in-polygon**. Dua opsi:
  - Manfaatkan event Leaflet: pasang `layer.on('click')` di tiap feature GeoJSON — Leaflet otomatis tahu polygon mana yang diklik. **Ini cara termudah**, tidak perlu hitung manual.
  - Alternatif manual: library `@turf/boolean-point-in-polygon` kalau butuh kontrol lebih.
- Rekomendasi MVP: pakai event `click` per-layer bawaan Leaflet.

### 7.2 Highlight & styling
- Style default negara: fill abu-abu terang, border tipis.
- Hover: fill sedikit lebih gelap (feedback interaktif).
- Benar: fill hijau (`#22c55e`).
- Salah: fill merah (`#ef4444`).
- Target (Mode B): fill kuning/oranye mencolok.
- Reset style tiap ganti ronde.

### 7.3 Auto-zoom (Mode B)
- Saat highlight negara, `map.fitBounds(layer.getBounds())` dengan padding, supaya negara kecil tetap kelihatan.

### 7.4 Struktur data negara
Tiap feature GeoJSON minimal punya properties:
```json
{
  "name": "Brazil",
  "name_id": "Brasil",       // nama Indonesia (opsional, utk bilingual)
  "iso_a2": "BR",
  "region": "Americas"
}
```
Kalau GeoJSON sumber tidak punya `name_id`, buat mapping terpisah atau skip bilingual di MVP.

### 7.5 Generate pilihan ganda (Mode B)
- Ambil 1 jawaban benar + 3 distractor acak dari negara lain (idealnya dari region yang sama biar menantang).

---

## 8. Struktur Proyek / Komponen (Nuxt 4)

```
app/
├── pages/
│   ├── index.vue           // Home: pilih mode, scope region, mulai
│   ├── play.vue            // Game screen (query ?mode=A|B)
│   └── result.vue          // Skor total, akurasi, main lagi
├── components/
│   ├── MapView.vue         // Leaflet map + GeoJSON layer (client-only)
│   ├── GameHud.vue         // skor, streak, ronde, timer
│   ├── PromptBar.vue       // "Klik: Brazil" (A) / pilihan ganda (B)
│   └── FeedbackToast.vue   // benar/salah
├── stores/
│   └── game.ts             // Pinia store
├── composables/
│   ├── useGeoData.ts       // load & cache GeoJSON
│   └── useLeafletMap.ts    // init map, style, fitBounds, event klik
├── assets/data/
│   └── countries.geo.json
└── nuxt.config.ts
```

- Komponen `MapView.vue` **wajib** di-mount client-only (`<ClientOnly>` atau `ssr: false` global).
- Pinia store `game.ts` (`useGameStore`):
  - state: `mode`, `regionFilter`, `score`, `streak`, `currentRound`, `totalRounds`, `currentTarget`, `usedCountries[]`, `history[]`.
  - actions: `startGame(mode)`, `submitAnswer(...)`, `nextRound()`, `resetGame()`.
- Navigasi antar screen pakai `navigateTo()` / `<NuxtLink>`. State ronde disimpan di store (bukan query) supaya persist saat pindah page.

---

## 9. Arsitektur untuk Ekspansi (Provinsi — fase 2)

Rancang data layer supaya bisa drill-down:
- Struktur folder data: `/data/world/countries.geo.json`, `/data/id/provinces.geo.json`, dst.
- Konsep "level": `world` → `country` → `province`. Game engine seharusnya agnostik terhadap level — cukup ganti sumber GeoJSON + label.
- **Jangan hardcode** logika khusus negara di engine; buat generic `loadRegionSet(level, code)`.

> Ini hanya arsitektur; **jangan implementasi provinsi di MVP.**

---

## 10. Acceptance Criteria (MVP Done)

- [ ] Peta dunia render dengan semua negara ter-outline.
- [ ] Home screen bisa pilih Mode A / Mode B.
- [ ] Mode A: klik peta terdeteksi benar/salah dengan feedback warna.
- [ ] Mode B: outline highlight + auto-zoom + 4 pilihan ganda berfungsi.
- [ ] Skor & streak update dengan benar; streak reset saat salah.
- [ ] 10 ronde per sesi, lalu result screen tampil (skor + akurasi %).
- [ ] Tidak ada negara berulang dalam satu sesi.
- [ ] Responsif di mobile (peta bisa di-pan/zoom dengan sentuhan).
- [ ] Semua data GeoJSON di-bundle lokal (tidak fetch API tiap load).

---

## 11. Nice-to-Have (Backlog)

- Toggle bahasa ID/EN.
- Filter region.
- Timer per ronde + toggle.
- Mode "hardcore" (tanpa border negara terlihat / peta blank).
- Leaderboard lokal (localStorage — **catatan:** localStorage tidak jalan di Claude Artifacts, tapi jalan normal di deployment sungguhan).
- Sound effect benar/salah.
- Share hasil skor.
- Level provinsi (Indonesia dulu).

---

## 12. Sumber Data & Referensi (untuk agent)

- GeoJSON world countries (Natural Earth): cari dataset `ne_110m_admin_0_countries` versi GeoJSON, atau paket npm `world-countries` / `world-atlas`.
- Leaflet docs: leaflet event `click` per layer, `L.geoJSON`, `fitBounds`.
- REST Countries API (opsional, untuk clue/bendera): `restcountries.com` — cache responsnya lokal agar tidak bergantung uptime API.

---

## 13. Milestone Saran

1. **M1 — Setup:** Init Nuxt 4 + `@pinia/nuxt` + Tailwind + Leaflet (client-only) + render peta + GeoJSON negara. Pastikan tidak ada SSR error `window is not defined`.
2. **M2 — Mode A:** klik-deteksi + skor + feedback.
3. **M3 — Mode B:** highlight + zoom + pilihan ganda.
4. **M4 — Flow:** home → game (10 ronde) → result → main lagi.
5. **M5 — Polish:** responsif mobile, styling, streak bonus, anti-repeat.
6. **M6 (opsional):** nice-to-have dari backlog.
