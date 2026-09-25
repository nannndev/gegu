import type { Position } from 'geojson'
import type { RegionCollection, RegionFeature } from '~/types/game'
import { regionId } from '~/composables/useGeoData'

/**
 * Fakta singkat sebuah wilayah, diturunkan dari file peta yang sudah dimuat —
 * tidak ada data tambahan yang perlu dikirim. Yang tersedia di semua dataset
 * cuma dua hal: wilayah induknya dan tetangga yang berbatasan langsung.
 */
export interface RegionFact {
  /** Wilayah induk: subkawasan negara, provinsi kabupaten, kota kecamatan. */
  parent: string
  /** Nama wilayah yang berbatasan, urut abjad. */
  neighbors: string[]
}

/**
 * Presisi pembulatan titik. Dua wilayah bertetangga berbagi garis batas yang
 * sama di file sumbernya, tapi hasil penyederhanaan geometri bisa menggeser
 * titiknya sedikit — tiga desimal (±100 m) cukup longgar untuk menyatukannya
 * tanpa menyambungkan wilayah yang cuma berdekatan.
 */
const PRECISION = 1e3
/** Minimal titik bersama; satu titik saja bisa berarti sekadar bersentuhan sudut. */
const MIN_SHARED = 2

function ringsOf(f: RegionFeature): Position[][] {
  const g = f.geometry
  if (g.type === 'Polygon') return g.coordinates
  if (g.type === 'MultiPolygon') return g.coordinates.flat()
  return []
}

/** Peta tetangga per koleksi; dihitung sekali, dipakai ulang tiap ronde. */
const cache = new WeakMap<RegionCollection, Map<string, string[]>>()

function neighborMap(collection: RegionCollection): Map<string, string[]> {
  const hit = cache.get(collection)
  if (hit) return hit

  // Titik → wilayah yang memilikinya. Satu kali lewat semua koordinat,
  // bukan membandingkan tiap pasang wilayah.
  const owners = new Map<string, Set<string>>()
  for (const f of collection.features) {
    const id = regionId(f)
    for (const ring of ringsOf(f)) {
      for (const [x, y] of ring) {
        const key = `${Math.round(x! * PRECISION)},${Math.round(y! * PRECISION)}`
        let set = owners.get(key)
        if (!set) owners.set(key, (set = new Set()))
        set.add(id)
      }
    }
  }

  const shared = new Map<string, Map<string, number>>()
  for (const set of owners.values()) {
    if (set.size < 2) continue
    for (const a of set) {
      const row = shared.get(a) ?? new Map<string, number>()
      shared.set(a, row)
      for (const b of set) if (a !== b) row.set(b, (row.get(b) ?? 0) + 1)
    }
  }

  const out = new Map<string, string[]>()
  for (const [id, row] of shared) {
    out.set(id, [...row].filter(([, n]) => n >= MIN_SHARED).map(([b]) => b))
  }
  cache.set(collection, out)
  return out
}

/** `null` kalau wilayahnya tidak ada di koleksi. */
export function regionFact(collection: RegionCollection, id: string): RegionFact | null {
  const feature = collection.features.find(f => regionId(f) === id)
  if (!feature) return null
  const p = feature.properties
  const nameById = new Map(collection.features.map(f => [regionId(f), f.properties.name]))
  const neighbors = (neighborMap(collection).get(id) ?? [])
    .map(n => nameById.get(n))
    .filter((n): n is string => Boolean(n))
    .sort((a, b) => a.localeCompare(b))
  return { parent: p.subregion ?? p.region, neighbors }
}

/** Id tetangga langsung; dipakai mode belajar untuk menyorotnya di peta. */
export function neighborIds(collection: RegionCollection, id: string): string[] {
  return neighborMap(collection).get(id) ?? []
}
