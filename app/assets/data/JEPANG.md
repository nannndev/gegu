# Data Jepang

47 prefektur di `jp-prefectures.geo.json`, ~212 KB.

Regenerasi:

```bash
curl -sL -o /tmp/ne1.geojson \
  https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
node scripts/build-jp.mjs
```

## Sumber & lisensi

**Natural Earth 1:10m admin-1 states/provinces** ([naturalearthdata.com](https://www.naturalearthdata.com))

> **Public domain.** Boleh diredistribusi, dimodifikasi, dan dipakai komersial;
> atribusi tidak diwajibkan.

Sumber yang sama dengan Malaysia, dan alasannya sama: direktori ini ikut
dipublikasikan bersama aplikasi, jadi sumber yang melarang redistribusi (GADM)
bukan pilihan. Lihat [`MALAYSIA.md`](MALAYSIA.md) untuk perbandingan lengkap.

## Kenapa Jepang, bukan Inggris atau Italia

Dipilih setelah membandingkan kandidat langsung dari datanya:

| Negara | Wilayah | Wilayah < 0,25° | Catatan |
|---|---|---|---|
| **Jepang** | 47 prefektur | **0** | Terkecil (Ōsaka) masih 0,72° |
| Italia | 110 provinsi | 0 | Layak, tapi jauh lebih sulit dari dugaan |
| Spanyol | 52 provinsi | 2 | Ceuta & Melilla sangat kecil |
| Inggris | 232 distrik | **86** | Borough London mustahil diklik |

Natural Earth tidak memberi "4 negara bagian Britania" atau 20 region Italia —
yang tersedia adalah tingkat di bawahnya. Untuk Inggris itu berarti 232 distrik
dengan 86 di antaranya terlalu kecil untuk diklik pada zoom seluruh negara.

## Catatan data

Properti dipangkas ke `id` / `name` / `name_id` / `region` / `country` /
`iso_a2`; `id` memakai kode ISO 3166-2 (`JP-01`…`JP-47`).

**Makron dipertahankan** (Ōsaka, Kyōto, Hokkaidō) karena itu ejaan yang benar
dan nama di sini tidak pernah diketik — Mode A dijawab dengan mengklik peta,
Mode B dengan pilihan ganda.

Tiga tambalan kecil terhadap sumber, semuanya di generator:

- **Region Saga & Nagasaki kosong** di Natural Earth; keduanya diisi `Kyushu`.
  Tanpa ini dua prefektur hilang dari filter wilayah.
- **`name_id` Tokyo & Hokkaido kosong**; diisi tanpa awalan "Prefektur" karena
  Hokkaido satuannya memang bukan prefektur (`Circuit`/道) dan Tokyo lazim
  disebut tanpa awalan itu.

Generator gagal keras kalau jumlahnya bukan 47 atau ada prefektur tanpa region.

## Pulau terpencil dibuang

Ini yang paling berpengaruh ke tampilan. **Tokyo secara administratif mencakup
Kepulauan Ogasawara**, ±1.000 km di Pasifik — Tokyo daratan di 35°LU, pulaunya
sampai 24°LU dan 154°BT. Pulau-pulau itu cuma beberapa piksel di layar dan
tidak pernah jadi jawaban, tapi ikut dihitung `fitBounds`: kameranya memuat
lautan kosong dan seluruh Jepang mengecil sampai prefekturnya sulit diklik.

`dropRemoteIslands()` membuang cincin yang pusatnya lebih dari 3,5° dari badan
utama prefekturnya — 28 cincin total (Tokyo 15, Okinawa 11, Hokkaido 2).
Kotak pembatasnya menyusut dari 31,0° × 21,3° jadi 21,3° × 20,8°, dan Jepang
di layar naik dari 52% ke 82% tinggi viewport.

Badan utama ditentukan dari cincin dengan bbox terbesar, bukan cincin pertama:
urutan cincin di GeoJSON tidak menjamin daratan utama ada di depan.

## Kenapa `local: true`

Sama seperti Malaysia: kepulauannya memanjang, jadi kamera difit ke isi
koleksi alih-alih memakai zoom tetap. Lihat [`MALAYSIA.md`](MALAYSIA.md).
