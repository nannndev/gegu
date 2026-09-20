# Data Italia

110 provinsi di `it-provinces.geo.json`, ~313 KB, dikelompokkan ke 20 region.

Regenerasi:

```bash
curl -sL -o /tmp/ne1.geojson \
  https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
node scripts/build-it.mjs
```

## Sumber & lisensi

**Natural Earth 1:10m admin-1 states/provinces** ([naturalearthdata.com](https://www.naturalearthdata.com))

> **Public domain.** Boleh diredistribusi, dimodifikasi, dan dipakai komersial;
> atribusi tidak diwajibkan.

Sumber yang sama dengan Malaysia dan Jepang. Lihat [`MALAYSIA.md`](MALAYSIA.md)
untuk perbandingan lengkap dengan kandidat lain yang ditolak.

## Provinsi, bukan region

Natural Earth memberi tingkat **provinsi** (110), bukan 20 region yang lebih
terkenal itu. Jadi ini soal yang lebih sulit daripada yang orang duga saat
memilih "Italia" — Lombardia punya 12 provinsi sendiri.

Ke-20 region tetap terpakai sebagai pengelompokan di filter "mau fokus di
mana", jadi pemain yang cuma hafal region bisa mempersempit ke satu region
dan main di situ.

## Nama diambil dari `name_it`, bukan `name`

Ini tambalan terpenting di generator. Kolom `name` di Natural Earth untuk
Italia **mencampur bahasa dan memuat salah eja**:

| `name` di sumber | Seharusnya | Masalah |
|---|---|---|
| Aoste | Aosta | bahasa Prancis |
| Turin | Torino | bahasa Inggris |
| Crotene | Crotone | salah eja |
| Oristrano | Oristano | salah eja |

`name_it` benar di semua 110 provinsi kecuali dua, dan itu dipakai sebagai
sumber nama. Dua sisanya ditambal lewat kode ISO:

- **IT-BZ** → `name_it` berisi "Trentino-Alto Adige" (nama regionnya), bukan
  "Bolzano".
- **IT-GE** → `name_it` berisi "Liguria" (nama regionnya), bukan "Genova".

Generator punya penjaga otomatis untuk pola itu: **nama provinsi yang persis
sama dengan nama regionnya** membuat build gagal, kecuali kode ISO-nya sudah
terdaftar di `NAME_PATCH`. Kalau rilis Natural Earth berikutnya menambah kasus
serupa, build berhenti alih-alih diam-diam menulis nama region sebagai nama
provinsi.

`name_id` sengaja diisi sama dengan nama Italianya. Kolom `name_id` di sumber
justru memuat terjemahan setengah jalan ("Pesaro dan Urbino", "Monza dan
Brianza") yang lebih buruk daripada nama aslinya.

## Catatan geometri

Kotak pembatasnya 11,9° × 11,6° — hampir bujur sangkar, jadi tidak ada masalah
framing seperti Jepang. Tidak ada cincin terpencil (>3,5° dari badan utama),
jadi `dropRemoteIslands()` tidak diperlukan di sini.

Jarak antar provinsi bertetangga: median 39 km, terdekat 9 km. `nearMissKm`
diisi 90 km — lebih ketat daripada Jepang (150) karena provinsi Italia jauh
lebih rapat daripada prefektur.
