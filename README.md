# GeoGuess

Game tebak wilayah dunia berbasis peta interaktif. Nuxt 4 + Leaflet + Pinia, jalan penuh di sisi klien tanpa backend.

PRD lengkap: [`docs/PRD-geo-guesser.md`](docs/PRD-geo-guesser.md).

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build produksi
npm run generate   # static — siap deploy ke Vercel/Netlify/GitHub Pages
```

## Mode permainan

- **Mode A — Cari di Peta:** nama wilayah ditampilkan, pemain mengklik lokasinya di peta.
- **Mode B — Tebak Nama:** satu wilayah disorot dan peta auto-zoom ke situ, pemain memilih namanya dari 4 opsi.

Cakupannya bisa dunia (175 negara), 38 provinsi, kab/kota satu provinsi, kecamatan satu kota, atau campuran multi-tingkat. Panjang sesi 5–20 ronde tergantung besar pool. Benar `= 10 + (streak × 2)` poin; salah tidak mengurangi skor tapi memutus streak. Wilayah tidak berulang dalam satu sesi.

**Tantangan harian** (`app/utils/daily.ts`) mengundi satu konfigurasi per tanggal lewat PRNG ber-seed, jadi semua pemain dapat soal yang sama di hari yang sama tanpa perlu server.

## Catatan arsitektur

- **`ssr: false`.** Leaflet menyentuh `window` saat init, dan game tidak butuh SEO — jadi aplikasi dijalankan sebagai SPA (Strategi A di PRD §4.1). Leaflet juga di-import dinamis di dalam `onMounted`, tidak pernah di top-level.
- **Data di-bundle, bukan di-fetch.** GeoJSON ikut ke dalam bundle lewat dynamic import, jadi tidak ada request runtime ke API luar. Kecamatan dipecah satu file per kabupaten/kota supaya hanya kota terpilih yang diunduh.
- **Engine agnostik terhadap level.** `loadRegionSet(level, code)` di `app/composables/useGeoData.ts` adalah satu-satunya tempat yang tahu sumber data.
- **Variant `dark` berbasis kelas, bukan `prefers-color-scheme`.** Tailwind v4 secara default mengompilasi `dark:` menjadi media query, yang membuat tombol ganti tema tidak berefek. `main.css` mendeklarasikan `@custom-variant dark (&:where(.dark, .dark *))` supaya kelas `.dark` di `<html>` jadi sumber kebenaran; skrip inline di `nuxt.config.ts` memasang kelas itu sebelum paint pertama agar tidak berkedip.
- **Aturan CSS di `main.css` berada di luar `@layer`,** jadi selalu menang atas utility Tailwind. Karena itu `.seg-item` hanya memasang `color` lewat `:not([aria-checked='true'])`, dan badge di atas tombol beraksen memakai `.shadcn-kbd-on-accent` — bukan utility `text-white` yang akan kalah.
- **Rekor dipecah per cakupan** (`app/utils/stats.ts`). Satu angka global tidak bermakna: sesi 8 kecamatan dan sesi 20 negara menghasilkan skor di skala yang berbeda jauh.
- **Latar menu = peta dunia SVG inline** (`WorldMapBackdrop.vue`), tiap negara diisi warna dominan benderanya dari `utils/flagPalette.ts`. Digambar manual dengan proyeksi equirectangular, bukan lewat Leaflet: latarnya statis dan tidak interaktif, jadi memuat mesin peta penuh untuk satu gambar diam berlebihan. GeoJSON-nya sudah ada di memori (`worldContext`) sejak dataset pertama dimuat — jadi latar ini nol tambahan unduhan. Cincin poligon dengan bbox < 0,6 derajat² dibuang, **kecuali cincin terbesar tiap negara** supaya negara mungil seperti Luxembourg tidak hilang.
- **Permukaan kartu sengaja tembus pandang** supaya peta terbaca menembusnya. Keterbacaan dijaga oleh `backdrop-filter: blur() saturate()` plus highlight `inset`, bukan oleh opasitas. Kilau spekularnya dipasang lewat `background-image`, bukan pseudo-element — pseudo-element menuntut isi kartu diangkat `z-index` dan itu memerangkap dropdown `SearchSelect` di stacking context anak. Karena itu juga semua permukaan memakai `background-color`, bukan shorthand `background` yang akan menghapus `background-image`.

## Data peta

`app/assets/data/countries.geo.json` (175 negara, ~190 KB) diturunkan dari Natural Earth `ne_110m_admin_0_countries`. Untuk membangun ulang:

```bash
curl -sL -o /tmp/ne110.geojson \
  https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson
node scripts/build-geodata.mjs
```

Script tersebut memangkas properti ke `name` / `name_id` / `iso_a2` / `region` / `subregion`, membulatkan koordinat ke 3 desimal, dan membuang Antarktika.

## Struktur

```
app/
├── pages/            index (menu) · play (game) · result (skor)
├── components/       MapView · GameHud · PromptBar · FeedbackToast
│                     SearchSelect · CityPicker · ThemeToggle
├── composables/      useGeoData (load & cache) · useLeafletMap (peta, style, event)
│                     useGameSetup (state menu) · useTheme · useMapView · useAudio
├── stores/game.ts    skor, streak, ronde, anti-repeat, pilihan ganda
├── utils/            stats (rekor per cakupan) · daily (tantangan harian)
│                     geo · flagPalette
├── types/game.ts
└── assets/data/      countries · provinces · kabupaten · kecamatan/
docs/                 PRD
scripts/              build-geodata.mjs
```

## Status

Semua acceptance criteria PRD §10 terpenuhi, plus level provinsi/kab/kecamatan, sound effect, share skor, tema terang-gelap, dan tantangan harian. Backlog: toggle bahasa ID/EN, mode hardcore, leaderboard daring.
