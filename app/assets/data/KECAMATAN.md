# Data Kecamatan Indonesia

6.644 kecamatan di 514 kabupaten/kota (38 provinsi), dipecah satu file per
kabupaten/kota di `kecamatan/` supaya game hanya mengunduh wilayah yang sedang
dimainkan (median ~20 KB per file, bukan ~10 MB sekaligus).

- `kecamatan/index.json` — daftar provinsi + kabupaten/kota beserta jumlah
  kecamatannya.
- `kecamatan/<kode>.geo.json` — kecamatan satu kabupaten/kota. Kode = kode
  wilayah Kemendagri dengan titik jadi tanda hubung (`34-04` = Kabupaten Sleman).

Regenerasi: `node scripts/build-kecamatan.mjs [gadm.json] [wilayah.sql]`
(generator mengosongkan `kecamatan/` lebih dulu, jadi catatan ini disimpan di
luar direktori itu).

## Sumber & lisensi

**Geometri — GADM 4.1 level-3** ([gadm.org](https://gadm.org))

> ⚠️ **Redistribusi tidak diizinkan tanpa izin GADM.** Lisensi GADM hanya
> mengizinkan penggunaan akademik dan non-komersial. File di `kecamatan/`
> adalah turunan dari data GADM, jadi batasan yang sama berlaku.
>
> Kalau proyek ini nanti dipublikasikan atau dikomersialkan, ganti sumber
> geometrinya lebih dulu — misalnya OpenStreetMap (ODbL, boleh redistribusi
> dengan atribusi; ada ~6.484 relasi kecamatan untuk Indonesia).
> `scripts/build-kecamatan.mjs` memisahkan pembacaan sumber dari penulisan
> output, jadi penggantian sumber tidak mengubah kode game.

Unduhan: `https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_IDN_3.json.zip`

**Nama wilayah — Kepmendagri No 300.2.2-2138 Tahun 2025**
via [cahyadsn/wilayah](https://github.com/cahyadsn/wilayah) (MIT).

Nama di GADM ditulis tanpa spasi (`AronganLambalek`) dan sebagian sudah usang,
jadi dicocokkan ke nama resmi per kabupaten dalam dua tahap: nama yang persis
sama mengklaim kodenya lebih dulu, baru sisanya lewat jarak Levenshtein
(`Menddoyo` → `Mendoyo`). Urutan ini penting — kalau typo dicocokkan lebih dulu,
ia bisa mengklaim nama yang benar dan dua kecamatan berakhir bernama sama.
Dari 6.644 kecamatan, 6.528 memakai nama resmi; 129 sisanya tidak punya padanan
dan dipakai apa adanya setelah dipecah dari CamelCase.

Fitur yang GADM catat dua kali dengan ejaan berbeda (`SetiaBudi` + `Setiabudi`)
digabung poligonnya, bukan dibuang.

## Kabupaten yang berganti nama

Beberapa kabupaten sudah berganti nama sejak GADM 4.1, dan nama lamanya kini
dipakai wilayah lain: `Pontianak` (kini Mempawah), `Maluku Tenggara Barat`
(kini Kepulauan Tanimbar), dan `Banjar` yang ada di Jawa Barat maupun
Kalimantan Selatan. Semuanya dipetakan lewat `KAB_ALIAS` di generator — tanpa
itu satu wilayah menimpa wilayah lain dan hilang tanpa jejak.

Dua pengaman di generator mencegah itu terulang: padanan dengan nol kecocokan
nama kecamatan ditolak, dan dua wilayah yang menulis ke file sama membuat build
gagal keras.

## Pemekaran wilayah

GADM 4.1 masih memakai batas sebelum pemekaran, jadi kecamatan yang kini milik
kabupaten baru masih tercatat di induk lamanya — Pangandaran menumpuk di Ciamis,
Malaka di Belu, Konawe Kepulauan di Konawe. Generator memindahkannya ke
kabupaten yang benar berdasarkan daftar resmi, dan membuat file baru untuk
kabupaten yang belum ada di GADM sama sekali. Tanpa langkah ini, 20 kabupaten
tidak muncul di game dan 130 kecamatan tampil di wilayah yang salah.

Pemindahan hanya dilakukan kalau nama kecamatannya persis ada di daftar resmi
dan tidak dipakai kabupaten lain, supaya nama yang ambigu tidak salah pindah.

## Catatan akurasi

Jumlah kabupaten/kota kini pas 514, sama dengan daftar resmi. Untuk kecamatan
masih ada selisih: 6.644 dari 7.265 (kurang 621). Penyebabnya GADM 4.1 dirilis
2022 sementara daftar resmi per 2025 — kecamatan hasil pemekaran setelah itu
belum punya geometri. Terkonsentrasi di provinsi baru Papua (Papua Pegunungan
kurang 93, Papua Barat Daya 58, Papua Tengah 57) yang menyumbang ~40% selisih.
Sisanya tersebar 1–46 per provinsi; 5 provinsi sudah lengkap.

Enam belas kabupaten punya sedikit kelebihan (1–4 kecamatan) dari nama historis
GADM yang tidak ada di daftar resmi, mis. `Sangalla` di Tana Toraja. Tidak ada
nama duplikat dalam satu kabupaten.

Selisih ini baru bisa ditutup dengan sumber geometri yang lebih baru. GADM masih
di versi 4.1 (belum ada 4.2/5.0), dan OSM justru lebih sedikit — 6.484 relasi
`admin_level=7`.
