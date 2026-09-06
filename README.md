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

- **Mode A — Cari di Peta:** nama negara ditampilkan, pemain mengklik lokasinya di peta.
- **Mode B — Tebak Nama:** satu negara disorot dan peta auto-zoom ke situ, pemain memilih namanya dari 4 opsi.

Satu sesi = 10 ronde. Benar `= 10 + (streak × 2)` poin; salah tidak mengurangi skor tapi memutus streak. Negara tidak berulang dalam satu sesi.

## Catatan arsitektur

- **`ssr: false`.** Leaflet menyentuh `window` saat init, dan game tidak butuh SEO — jadi aplikasi dijalankan sebagai SPA (Strategi A di PRD §4.1). Leaflet juga di-import dinamis di dalam `onMounted`, tidak pernah di top-level.
- **Tanpa tile layer.** Polygon GeoJSON sudah cukup sebagai peta. Basemap ber-label justru membocorkan jawaban, dan tanpa tile game jalan sepenuhnya offline.
- **Data di-bundle, bukan di-fetch.** `app/assets/data/countries.geo.json` ikut ke dalam bundle lewat dynamic import, jadi tidak ada request runtime ke API luar.
- **Engine agnostik terhadap level.** `loadRegionSet(level, code)` di `app/composables/useGeoData.ts` adalah satu-satunya tempat yang tahu sumber data. Level provinsi (PRD §9) cukup menambah entri di sana — tidak ada logika khusus negara di engine.

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
├── composables/      useGeoData (load & cache) · useLeafletMap (peta, style, event)
├── stores/game.ts    skor, streak, ronde, anti-repeat, pilihan ganda
├── types/game.ts
└── assets/data/      countries.geo.json
docs/                 PRD
scripts/              build-geodata.mjs
```

## Status MVP

Semua acceptance criteria PRD §10 terpenuhi. Backlog yang belum dikerjakan: toggle bahasa ID/EN, mode hardcore, leaderboard localStorage, sound effect, share skor, level provinsi.
