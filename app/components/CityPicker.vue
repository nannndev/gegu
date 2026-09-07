<script setup lang="ts">
import type { KecamatanCity } from '~/composables/useGeoData'

/**
 * Pemilih kabupaten/kota untuk mode kecamatan. Daftarnya 514 item, jadi
 * `<select>` biasa tidak terpakai — ini combobox dengan pencarian, hasil
 * dikelompokkan per provinsi, dan navigasi keyboard penuh.
 */
const props = defineProps<{
  cities: KecamatanCity[]
  /** Tidak dipakai di dalam; provinsi difilter oleh induk. */
  provinces?: string[]
  selectedId: string | null
  /** Provinsi yang sedang difilter; kosong berarti semua provinsi. */
  province: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  select: [cityId: string]
}>()

const open = ref(false)
const query = ref('')
const activeIndex = ref(0)
const rootEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const listEl = ref<HTMLElement | null>(null)

const selected = computed(() => props.cities.find(c => c.id === props.selectedId) ?? null)

/** Nama tanpa prefix administratif, untuk tampilan yang lebih ringkas. */
function shortName(city: string) {
  return city.replace(/^(Kabupaten|Kota)( Administrasi)? /, '')
}

function kind(city: string) {
  return /^Kota/.test(city) ? 'Kota' : 'Kab.'
}

/**
 * Hasil pencarian. Tanpa query, hanya provinsi terpilih yang ditampilkan —
 * dengan query, pencarian menembus semua provinsi supaya pemain tidak perlu
 * tahu sebuah kota ada di provinsi mana.
 */
const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.cities.filter(c => c.province === props.province)

  const scored: { city: KecamatanCity, rank: number }[] = []
  for (const c of props.cities) {
    const short = shortName(c.city).toLowerCase()
    const full = c.city.toLowerCase()
    const prov = c.province.toLowerCase()

    // Prioritaskan yang namanya diawali kata kunci, lalu yang mengandungnya.
    let rank = -1
    if (short.startsWith(q)) rank = 0
    else if (short.includes(q)) rank = 1
    else if (full.includes(q)) rank = 2
    else if (prov.includes(q)) rank = 3
    if (rank >= 0) scored.push({ city: c, rank })
  }
  return scored
    .sort((a, b) => a.rank - b.rank || a.city.city.localeCompare(b.city.city))
    .slice(0, 60)
    .map(s => s.city)
})

/** Hasil dikelompokkan per provinsi supaya konteksnya jelas saat mencari. */
const grouped = computed(() => {
  const groups: { province: string, cities: KecamatanCity[] }[] = []
  for (const c of results.value) {
    const last = groups[groups.length - 1]
    if (last && last.province === c.province) last.cities.push(c)
    else groups.push({ province: c.province, cities: [c] })
  }
  return groups
})

const totalKecamatan = computed(() =>
  results.value.reduce((sum, c) => sum + c.count, 0),
)

watch(results, () => { activeIndex.value = 0 })

function openMenu() {
  if (props.disabled) return
  open.value = true
  nextTick(() => inputEl.value?.focus())
}

function closeMenu() {
  open.value = false
  query.value = ''
}

function choose(city: KecamatanCity) {
  // Provinsi mengikuti kota yang dipilih; induknya yang menyelaraskan, jadi
  // tidak ada dua event yang bisa saling mendahului.
  emit('select', city.id)
  closeMenu()
}

/** Gulirkan item aktif agar selalu terlihat saat navigasi keyboard. */
function scrollActiveIntoView() {
  nextTick(() => {
    listEl.value?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  })
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value) {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault()
      openMenu()
    }
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    closeMenu()
    return
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const step = e.key === 'ArrowDown' ? 1 : -1
    const n = results.value.length
    if (!n) return
    activeIndex.value = (activeIndex.value + step + n) % n
    scrollActiveIntoView()
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    const city = results.value[activeIndex.value]
    if (city) choose(city)
  }
}

/** Indeks datar untuk menandai item aktif di dalam tampilan berkelompok. */
function flatIndex(province: string, cityId: string) {
  return results.value.findIndex(c => c.id === cityId && c.province === province)
}

function onDocumentClick(e: MouseEvent) {
  if (!open.value) return
  if (!rootEl.value?.contains(e.target as Node)) closeMenu()
}

onMounted(() => document.addEventListener('mousedown', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentClick))
</script>

<template>
  <div ref="rootEl" class="relative">
    <!-- Tombol pemicu: menampilkan pilihan saat ini -->
    <button
      type="button"
      class="focusable flex w-full items-center justify-between gap-2 rounded-lg border border-sky-500/40 bg-slate-950 px-3 py-2 text-left transition hover:border-sky-400/70 disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="open ? closeMenu() : openMenu()"
      @keydown="onKeydown"
    >
      <span class="min-w-0 flex-1">
        <span class="block truncate text-xs font-semibold text-sky-100">
          {{ selected ? shortName(selected.city) : 'Pilih kabupaten/kota' }}
        </span>
        <span v-if="selected" class="block truncate text-[10px] text-slate-400">
          {{ kind(selected.city) }} · {{ selected.province }} · {{ selected.count }} kecamatan
        </span>
      </span>
      <svg
        xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-sky-300 transition-transform"
        :class="open ? 'rotate-180' : ''" viewBox="0 0 20 20" fill="currentColor"
      >
        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-white/[0.08] bg-slate-900 shadow-2xl"
      >
        <div class="border-b border-white/[0.06] p-2">
          <input
            ref="inputEl"
            v-model="query"
            type="text"
            placeholder="Cari kota, kabupaten, atau provinsi…"
            aria-label="Cari kabupaten atau kota"
            class="focusable w-full rounded-lg border border-white/[0.08] bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400"
            @keydown="onKeydown"
          >
          <p class="mt-1.5 px-0.5 text-[10px] text-slate-500">
            <template v-if="query">
              {{ results.length }} hasil · {{ totalKecamatan }} kecamatan
            </template>
            <template v-else>
              {{ province }} · {{ results.length }} kab/kota · ketik untuk cari se-Indonesia
            </template>
          </p>
        </div>

        <div ref="listEl" role="listbox" class="max-h-72 overflow-y-auto overscroll-contain py-1">
          <p v-if="!results.length" class="px-3 py-6 text-center text-[11px] text-slate-500">
            Tidak ada yang cocok dengan “{{ query }}”.
          </p>

          <template v-for="group in grouped" :key="group.province">
            <p class="sticky top-0 bg-slate-900/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
              {{ group.province }}
            </p>
            <button
              v-for="c in group.cities"
              :key="c.id"
              type="button"
              role="option"
              :aria-selected="c.id === selectedId"
              :data-active="flatIndex(group.province, c.id) === activeIndex"
              class="flex w-full items-center gap-2 px-3 py-1.5 text-left transition"
              :class="[
                flatIndex(group.province, c.id) === activeIndex ? 'bg-white/[0.07]' : '',
                c.id === selectedId ? 'text-sky-300' : 'text-slate-200',
              ]"
              @click="choose(c)"
              @mouseenter="activeIndex = flatIndex(group.province, c.id)"
            >
              <span class="w-8 shrink-0 text-[10px] font-medium text-slate-500">{{ kind(c.city) }}</span>
              <span class="min-w-0 flex-1 truncate text-[11px] font-medium">{{ shortName(c.city) }}</span>
              <span class="shrink-0 text-[10px] tabular-nums text-slate-500">{{ c.count }}</span>
            </button>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>
