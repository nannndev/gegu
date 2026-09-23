# Data Jerman

16 negara bagian di `de-states.geo.json`, ~219 KB, dikelompokkan ke 4 penjuru.

Regenerasi:

```bash
curl -sL -o /tmp/ne1.geojson \
  https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
node scripts/build-de.mjs
```

## Sumber & lisensi

**Natural Earth 1:10m admin-1 states/provinces** ([naturalearthdata.com](https://www.naturalearthdata.com))

> **Public domain.** Boleh diredistribusi, dimodifikasi, dan dipakai komersial;
> atribusi tidak diwajibkan.

Sumber yang sama dengan Malaysia, Jepang, dan Italia. Lihat [`MALAYSIA.md`](MALAYSIA.md)
untuk perbandingan lengkap dengan kandidat lain yang ditolak.

## Negara bagian, bukan negara

Natural Earth memberi tepat 16 Bundesländer untuk Jerman — jumlahnya persis
seperti yang orang duga, tidak seperti Italia yang provinsinya jauh lebih
banyak daripada regionnya. Jadi ini soal setingkat "hafal 16 negara bagian",
sepadan dengan negeri Malaysia.

## Nama diambil dari `name`

Kolom `name` Natural Earth untuk Jerman sudah berbahasa Jerman (Bayern,
Sachsen, Rheinland-Pfalz, …) — bukan exonim Inggris yang justru tidak tersedia
di sumbernya. `name_de` menyimpan bentuk panjang resmi ("Freie Hansestadt
Bremen"), tapi `name` lebih ringkas dan konsisten, jadi `name` yang dipakai.
`name_id` diisi sama dengan namanya, persis pendekatan Italia.

## Region diisi manual lewat kode ISO

Natural Earth membiarkan kolom `region` kosong untuk semua negara bagian
Jerman. Jerman tidak punya tingkat administratif resmi antara negara bagian
dan negara, jadi pembagiannya memakai empat penjuru mata angin yang lazim
dipakai sehari-hari (Nord/Ost/West/Süd), dipetakan dari kode ISO 3166-2:

| Region | Negara bagian |
|---|---|
| North (5) | Schleswig-Holstein, Hamburg, Bremen, Niedersachsen, Mecklenburg-Vorpommern |
| East (5) | Berlin, Brandenburg, Sachsen, Sachsen-Anhalt, Thüringen |
| West (4) | Nordrhein-Westfalen, Hessen, Rheinland-Pfalz, Saarland |
| South (2) | Bayern, Baden-Württemberg |

Labelnya sengaja bahasa Inggris (North/East/West/South) supaya singkat dan
tidak menyebut nama negaranya dua kali di "Jerman · {region}".

## Catatan geometri

Kotak pembatasnya kompak dan hampir bujur sangkar, jadi `dropRemoteIslands()`
tidak diperlukan — pulau seperti Rügen, Sylt, dan Helgoland semuanya dekat
daratan utama.

Jarak antar negara bagian bertetangga: median 91 km, terdekat 28 km
(Berlin–Brandenburg), terjauh 178 km (Bayern–Baden-Württemberg). `nearMissKm`
diisi 180 km — kira-kira "satu sampai dua negara bagian meleset".
