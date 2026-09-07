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
/** Kalau ruang di bawah trigger sempit, dropdown dibuka ke atas. */
const dropUp = ref(false)
/** Tinggi list dibatasi sisa ruang viewport biar tidak terpotong. */
const menuMaxHeight = ref(288)

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
  nextTick(() => {
    // Ukur ruang tersisa di viewport: buka ke atas kalau ruang bawah sempit,
    // dan batasi tinggi list supaya tidak keluar layar.
    const el = rootEl.value
    if (el) {
      const rect = el.getBoundingClientRect()
      const below = window.innerHeight - rect.bottom
      dropUp.value = below < 240
      menuMaxHeight.value = Math.max(160, Math.min(288, (dropUp.value ? rect.top - 8 : below) - 8))
    }
    inputEl.value?.focus()
  })
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
    <!-- Trigger button -->
    <button
      type="button"
      class="focusable flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 px-3.5 py-2.5 text-left shadow-sm transition hover:border-sky-500/50 dark:hover:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="open ? closeMenu() : openMenu()"
      @keydown="onKeydown"
    >
      <span class="min-w-0 flex-1">
        <span class="block truncate text-xs font-bold text-slate-900 dark:text-slate-100">
          {{ selected ? shortName(selected.city) : 'Pilih kabupaten / kota…' }}
        </span>
        <span v-if="selected" class="block truncate text-[11px] text-slate-500 dark:text-slate-400">
          {{ kind(selected.city) }} · {{ selected.province }} · <strong class="font-semibold text-sky-600 dark:text-sky-400">{{ selected.count }} kecamatan</strong>
        </span>
      </span>
      <div class="flex items-center gap-1 text-slate-400 dark:text-slate-500">
        <span v-if="!selected" class="text-[11px]">Cari…</span>
        <svg
          xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 transition-transform"
          :class="open ? 'rotate-180 text-sky-500' : ''" viewBox="0 0 20 20" fill="currentColor"
        >
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </div>
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1 scale-95"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="open"
        class="absolute z-50 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-xl"
        :class="dropUp ? 'bottom-full mb-1.5' : 'mt-1.5'"
      >
        <div class="border-b border-slate-200/80 dark:border-white/10 p-2.5">
          <div class="relative">
            <input
              ref="inputEl"
              v-model="query"
              type="text"
              placeholder="Ketik nama kota, kabupaten, atau provinsi…"
              aria-label="Cari kabupaten atau kota"
              class="focusable w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 py-2 pl-8 pr-3 text-xs text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 focus:border-sky-500 dark:focus:border-sky-400"
              @keydown="onKeydown"
            >
            <svg xmlns="http://www.w3.org/2000/svg" class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
            </svg>
          </div>
          <p class="mt-1.5 px-0.5 text-[10px] text-slate-500 dark:text-slate-400">
            <template v-if="query">
              {{ results.length }} hasil ditemukan · {{ totalKecamatan }} kecamatan
            </template>
            <template v-else>
              {{ province }} · {{ results.length }} kab/kota · ketik untuk cari se-Indonesia
            </template>
          </p>
        </div>

        <div ref="listEl" role="listbox" class="overflow-y-auto overscroll-contain py-1" :style="{ maxHeight: `${menuMaxHeight}px` }">
          <p v-if="!results.length" class="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            Tidak ada yang cocok dengan “{{ query }}”.
          </p>

          <template v-for="group in grouped" :key="group.province">
            <p class="sticky top-0 bg-slate-100/95 dark:bg-slate-800/95 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 backdrop-blur">
              {{ group.province }}
            </p>
            <button
              v-for="c in group.cities"
              :key="c.id"
              type="button"
              role="option"
              :aria-selected="c.id === selectedId"
              :data-active="flatIndex(group.province, c.id) === activeIndex"
              class="flex w-full items-center gap-2 px-3 py-2 text-left transition"
              :class="[
                flatIndex(group.province, c.id) === activeIndex ? 'bg-sky-50 dark:bg-sky-950/40' : '',
                c.id === selectedId ? 'bg-sky-100/80 dark:bg-sky-900/40 font-bold text-sky-700 dark:text-sky-300' : 'text-slate-700 dark:text-slate-200',
              ]"
              @click="choose(c)"
              @mouseenter="activeIndex = flatIndex(group.province, c.id)"
            >
              <span class="w-8 shrink-0 text-[10px] font-semibold text-slate-400 dark:text-slate-500">{{ kind(c.city) }}</span>
              <span class="min-w-0 flex-1 truncate text-xs">{{ shortName(c.city) }}</span>
              <span class="shrink-0 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono tabular-nums text-slate-600 dark:text-slate-400">
                {{ c.count }} kec.
              </span>
              <span v-if="c.id === selectedId" class="shrink-0 text-xs font-bold text-sky-500" aria-hidden="true">✓</span>
            </button>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>
