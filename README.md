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

Cakupannya bisa dunia (175 negara), 38 provinsi, kab/kota satu provinsi, kecamatan satu kota, campuran multi-tingkat, 50 state AS beserta countynya, 16 negeri Malaysia, 47 prefektur Jepang, 110 provinsi Italia, atau 16 negara bagian Jerman. Panjang sesi 5–20 ronde tergantung besar pool. Benar `= 10 + (streak × 2)` poin; salah tidak mengurangi skor tapi memutus streak. Di Mode A, tebakan yang masih dalam radius cakupan dibayar sebagian (maksimal separuh poin penuh). Wilayah tidak berulang dalam satu sesi.

**Tantangan harian** (`app/utils/daily.ts`) mengundi satu konfigurasi per tanggal lewat PRNG ber-seed, jadi semua pemain dapat soal yang sama di hari yang sama tanpa perlu server.

**Poin nyaris-kena.** Di Mode A, tebakan yang meleset tapi masih dalam radius cakupan dibayar sebagian — mengklik provinsi sebelah bukan hal yang sama dengan mengklik benua yang salah. Jaraknya diukur antar pusat wilayah dan ditampilkan di kartu umpan balik.

**Petunjuk berjatah.** Dua–tiga petunjuk per sesi; 50:50 di Mode B, penyempitan peta di Mode A. Ronde yang dibantu dibayar separuh.

**Latihan yang salah.** Setelah sesi selesai, satu tombol mengulang hanya wilayah yang tadi meleset.

## Catatan arsitektur

- **`ssr: false`.** Leaflet menyentuh `window` saat init, dan game tidak butuh SEO — jadi aplikasi dijalankan sebagai SPA (Strategi A di PRD §4.1). Leaflet juga di-import dinamis di dalam `onMounted`, tidak pernah di top-level.
- **Data di-bundle, bukan di-fetch.** GeoJSON ikut ke dalam bundle lewat dynamic import, jadi tidak ada request runtime ke API luar. Kecamatan dipecah satu file per kabupaten/kota supaya hanya kota terpilih yang diunduh.
- **Engine agnostik terhadap level.** `loadRegionSet(level, code)` di `app/composables/useGeoData.ts` adalah satu-satunya tempat yang tahu sumber data.
- **Variant `dark` berbasis kelas, bukan `prefers-color-scheme`.** Tailwind v4 secara default mengompilasi `dark:` menjadi media query, yang membuat tombol ganti tema tidak berefek. `main.css` mendeklarasikan `@custom-variant dark (&:where(.dark, .dark *))` supaya kelas `.dark` di `<html>` jadi sumber kebenaran; skrip inline di `nuxt.config.ts` memasang kelas itu sebelum paint pertama agar tidak berkedip.
- **Aturan CSS di `main.css` berada di luar `@layer`,** jadi selalu menang atas utility Tailwind. Karena itu `.seg-item` hanya memasang `color` lewat `:not([aria-checked='true'])`, dan badge di atas tombol beraksen memakai `.shadcn-kbd-on-accent` — bukan utility `text-white` yang akan kalah.
- **Mode hardcore melucuti petunjuk, bukan menambah soal.** Yang dimatikan adalah empat hal yang selama ini menjawab sebagian soal secara gratis: daratan tetangga (patokan posisi), warna bendera di scope dunia (praktis menyebut nama negaranya), chip benua/provinsi di bilah soal, dan zoom-pan. Waktunya 7 detik, skornya ×1,5 — pengali itu perlu karena rekor dipecah per cakupan, bukan per kesulitan, jadi tanpanya sesi hardcore selalu kalah di papan yang sama. Penyembunyiannya menolkan opacity, bukan membuang layer: `mark()` masih harus bisa memunculkan jawaban yang benar setelah ronde terjawab, dan wilayah tersembunyi ditolak dari hover & klik supaya menyapu kursor tidak jadi cara gratis menemukannya.
- **Kamera terkunci menuntut framing memesan ruang bilah soal.** `promptReserve()` mengukur tinggi `[data-prompt-bar]` dari DOM — bukan angka tetap, karena Mode B punya empat tombol pilihan dan Mode A tidak. Di mode normal wilayah yang tertutup bilah bisa digeser keluar pemain; di hardcore tidak, padahal bentuk itulah seluruh soalnya. Pengukurannya ditunda satu `nextTick` di `play.vue` supaya yang terukur bilah ronde ini, bukan ronde sebelumnya.
- **Radius nyaris-kena hidup di `scopeProfile`, bukan satu angka global.** Nilainya harus sekelas jarak antar wilayah tetangga di cakupan itu: 200 km di peta dunia berarti negara sebelah, tapi di peta kecamatan Jakarta itu menjangkau seluruh Jawa Barat — mengklik asal di mana pun akan selalu dibayar. Peluruhannya dipangkatkan (1,8), bukan linier: pada peluruhan linier, meleset setengah radius masih membayar 50%, cukup besar untuk membuat menembak ke tengah peta jadi strategi yang masuk akal. Plafonnya setengah poin penuh supaya tebakan yang kena tetap menang telak, dan streak tetap putus — yang dibayar kedekatannya, bukan kebenarannya.
- **Petunjuk Mode A menyempit menurut bentuk pool, bukan selalu lewat region.** Di cakupan satu kota, `region` tiap kecamatan adalah kotanya sendiri: seluruh pool punya nilai yang sama, jadi menyaring dengannya tidak membuang apa pun dan petunjuknya terasa rusak. `spotlightFor()` memakai region hanya kalau itu memangkas setidaknya 30% pool, kalau tidak jatuh ke pemangkasan separuh acak. Wilayah yang dikesampingkan diredupkan, bukan disembunyikan — yang dibeli pemain adalah penyempitan pencarian, dan itu hanya terbaca kalau yang dibuang masih terlihat samar. Tetap bisa diklik: petunjuk mempersempit tebakan, bukan melarangnya.
- **Jatah petunjuk per sesi, bukan per ronde.** Petunjuk yang selalu tersedia berhenti jadi keputusan — pemain tinggal menekannya tiap ronde dan soalnya berubah jadi latihan mengklik. Hardcore tidak dapat jatah sama sekali: seluruh mode itu ada untuk melucuti petunjuk, jadi menjualnya kembali membatalkan maksudnya.
- **Coretan 50:50 tinggal di store, bukan di `PromptBar`.** Bilah itu dibongkar-pasang `<Transition>` tiap kali jawaban masuk, jadi state di dalamnya tidak bertahan sampai ronde usai.
- **`zoomSnap: 0.1`, bukan default Leaflet.** Default `zoomSnap: 1` membulatkan tiap `fitBounds` ke tingkat zoom bulat ke bawah, dan satu tingkat zoom itu 2× skala — wilayah soal bisa berakhir mengisi separuh layar. Paling parah di cakupan yang bentuknya tidak sebangun dengan layar (Jepang memanjang, Malaysia terbelah laut). Profil di `scopeProfile` pun sudah menulis minZoom pecahan (1,8 · 2,5 · 3,5) yang tanpa ini tidak pernah berlaku.
- **Pulau terpencil dibuang dari dataset, bukan disembunyikan di peta** (`dropRemoteIslands()` di `build-jp.mjs`). Kepulauan Ogasawara milik Tokyo ada 1.000 km di Pasifik: beberapa piksel di layar, tidak pernah jadi jawaban, tapi ikut menarik `fitBounds` sampai seluruh Jepang mengecil. Dibuang di tahap build karena ini soal data, bukan soal render — peta tidak perlu tahu pulau mana yang layak diabaikan.
- **Nama wilayah diambil dari kolom bahasa yang tepat, bukan `name`.** Kolom `name` Natural Earth mencampur bahasa dan memuat salah eja — untuk Italia: "Aoste" (Prancis), "Turin" (Inggris), "Crotene" dan "Oristrano" yang seharusnya Crotone dan Oristano. `build-it.mjs` memakai `name_it`, dan punya penjaga yang menggagalkan build kalau nama provinsi persis sama dengan nama regionnya — pola yang menandai sumbernya mengisi kolom yang salah (terjadi di Bolzano & Genova).
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

**Lisensi tiap dataset berbeda, dan itu menentukan sumbernya.** Direktori ini ikut dipublikasikan bersama aplikasi, jadi sumber yang melarang redistribusi tidak bisa dipakai untuk dataset baru. Kecamatan Indonesia memakai GADM dan **tidak** boleh diredistribusi ([`KECAMATAN.md`](app/assets/data/KECAMATAN.md)); county AS memakai US Census (public domain); negeri Malaysia, prefektur Jepang, provinsi Italia, dan negara bagian Jerman memakai Natural Earth (public domain, [`MALAYSIA.md`](app/assets/data/MALAYSIA.md) · [`JEPANG.md`](app/assets/data/JEPANG.md) · [`ITALIA.md`](app/assets/data/ITALIA.md) · [`DEUTSCHLAND.md`](app/assets/data/DEUTSCHLAND.md)). Untuk Malaysia, repo GeoJSON populer di GitHub sengaja dihindari — kebanyakan tanpa lisensi atau diam-diam turunan GADM.

**Tekstur globe** (`public/textures/earth-blue-marble.jpg`) adalah foto NASA Blue Marble (domain publik), diambil dari contoh paket `three-globe` (MIT) dan diperkecil ke 2048×1024 (~350 KB). Dipakai sebagai permukaan globe 3D saat bermain; mode hardcore tetap memakai bola polos karena foto satelit memperlihatkan garis pantai.

## Struktur

```
app/
├── pages/            index (menu) · play (game) · result (skor)
├── components/       MapView · GameHud · PromptBar · FeedbackToast
│                     TimerRing · RoundTrack · HintButton · ShortcutSheet
│                     SearchSelect · CityPicker · ThemeToggle
├── composables/      useGeoData (load & cache) · useLeafletMap (peta, style, event)
│                     useGameSetup (state menu) · useTheme · useMapView · useAudio
├── stores/game.ts    skor, streak, ronde, anti-repeat, pilihan ganda, petunjuk
├── utils/            stats (rekor per cakupan) · daily (tantangan harian)
│                     distance (poin nyaris-kena) · hints (jatah & sorotan)
│                     geo · flagPalette
├── types/game.ts
└── assets/data/      countries · provinces · kabupaten · kecamatan/
                      us-states · us-county/ · my-states · jp-prefectures · it-provinces · de-states
docs/                 PRD
scripts/              build-geodata.mjs · build-us.mjs · build-my.mjs
                      build-jp.mjs · build-it.mjs · build-de.mjs
```

## Status

Semua acceptance criteria PRD §10 terpenuhi, plus level provinsi/kab/kecamatan, cakupan Amerika Serikat (state & county), Malaysia (negeri), Jepang (prefektur), Italia (provinsi), Jerman (negara bagian), toggle bahasa ID/EN, mode hardcore, sound effect, share skor, tema terang-gelap, dan tantangan harian. Backlog tersisa: leaderboard daring — satu-satunya item yang butuh backend, jadi menunggu `ssr: false` digeser ke hybrid rendering.
