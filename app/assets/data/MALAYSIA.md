# Data Malaysia

16 negeri & wilayah persekutuan (13 negeri + 3 wilayah persekutuan) di
`my-states.geo.json`, ~98 KB.

Regenerasi:

```bash
curl -sL -o /tmp/ne10_admin1.json \
  https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
node scripts/build-my.mjs
```

## Sumber & lisensi

**Natural Earth 1:10m admin-1 states/provinces** ([naturalearthdata.com](https://www.naturalearthdata.com))

> **Public domain.** Boleh diredistribusi, dimodifikasi, dan dipakai komersial;
> atribusi tidak diwajibkan. Ini lisensi paling longgar di antara semua dataset
> di repo ini — berbeda dari kecamatan Indonesia yang memakai GADM dan **tidak**
> boleh diredistribusi (lihat [`KECAMATAN.md`](KECAMATAN.md)).

Natural Earth dipilih justru karena itu: file di direktori ini ikut
dipublikasikan bersama aplikasinya, jadi sumber yang melarang redistribusi
bukan pilihan. Kandidat lain yang ditolak:

- **GADM** — melarang redistribusi, sama seperti di kasus kecamatan.
- **Repo GeoJSON Malaysia di GitHub** (`nullifye/malaysia.geojson` dan
  turunannya) — tidak mencantumkan lisensi sama sekali, jadi tidak ada hak
  redistribusi. Sebagian lain diturunkan dari GADM tanpa menyebutkannya.
- **data.gov.my** — lisensinya CC BY 4.0 dan memadai, tapi tidak ditemukan
  dataset poligon batas wilayah di katalognya.

Natural Earth juga sudah berbentuk GeoJSON, jadi generatornya tidak butuh
mapshaper seperti `build-us.mjs`.

## Catatan data

Properti dipangkas ke `id` / `name` / `name_id` / `abbr` / `region` / `kind` /
`country` / `iso_a2`, dan koordinat dibulatkan 3 desimal (±100 m) — jauh lebih
halus daripada yang bisa dibedakan pada zoom negeri, tapi memangkas ukuran file
lebih dari separuh.

`id` diturunkan dari kode ISO 3166-2 (`MY-01`…`MY-16`), bukan `adm1_code` yang
tidak stabil antar rilis Natural Earth.

**`region` diisi sendiri, tidak diambil dari sumber.** Natural Earth
mengosongkan kolom itu untuk seluruh Malaysia, padahal filter "mau fokus di
mana" membutuhkannya. Pembagiannya (`REGION_BY_ISO` di generator) mengikuti
pembagian yang dipakai sehari-hari: Semenanjung dibelah Utara/Tengah/Selatan
plus Pantai Timur, dan Borneo berdiri sendiri karena terpisah laut.

Generator gagal keras kalau jumlahnya bukan 16 atau ada negeri yang belum
terpetakan ke region — dataset yang diam-diam berkurang lebih berbahaya
daripada build yang berhenti.

## Kenapa `local: true` di scopeProfile

Berbeda dari provinsi Indonesia atau state AS yang memakai kamera tetap,
`my-states` difit ke isi koleksinya. Semenanjung dan Borneo terpisah ±600 km
Laut China Selatan, jadi kotak pembatas negaranya jauh lebih lebar daripada
daratannya; zoom tetap menyisakan laut kosong di kiri-kanan dan membuat
negerinya mengecil sampai bentuknya tidak terbaca.

## Belum ada: tingkat daerah

Natural Earth tidak punya admin-2 untuk Malaysia sama sekali — layer
`ne_10m_admin_2_counties` isinya 3.224 county dan semuanya Amerika Serikat.

Kalau nanti tingkat daerah (~158 daerah) mau ditambahkan, sumber yang paling
masuk akal adalah **OpenStreetMap** lewat Overpass (`admin_level=6`, ODbL —
boleh diredistribusi dengan atribusi). Dua hal yang perlu disiapkan:
nama daerah di OSM sering bukan Latin (hanya ±28 dari 158 punya `name:en`;
Kelantan memakai tulisan Jawi), jadi butuh pencocokan lewat tag `wikidata`
yang ada di 151 dari 158; dan kalau data OSM ikut di-bundle, file datanya
sendiri jadi berlisensi ODbL — kewajiban itu menempel ke file datanya, bukan
ke kode aplikasinya.
