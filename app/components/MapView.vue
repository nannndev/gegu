<script setup lang="ts">
import type { RegionCollection, RegionItem } from '~/types/game'
import type { RegionMark } from '~/composables/useLeafletMap'

const emit = defineEmits<{
  pick: [item: RegionItem]
  miss: []
  ready: []
}>()

const game = useGameStore()
const {
  collection,
  worldContext,
  localContext,
  loadKecamatanCity,
  loadRegionSet,
} = useGeoData()
const { mode: viewMode, setMode, modes } = useMapViewMode()
const container = ref<HTMLElement | null>(null)
const viewMenuOpen = ref(false)

/**
 * Mode campuran mengganti level tiap ronde, jadi koleksi yang digambar tidak
 * bisa memakai `collection` global — poligon provinsi dan kecamatan akan
 * saling menimpa. Koleksi khusus mode ini disimpan sendiri dan ditukar
 * mengikuti level target ronde berjalan.
 */
const isMixed = computed(() => game.datasetScope === 'id-mixed')
const mixedCollection = ref<RegionCollection | null>(null)

/** Scope efektif untuk styling: mode campuran memakai gaya level aktifnya. */
const scope = computed(() => {
  if (!isMixed.value) return game.datasetScope
  const level = game.currentTarget?.level
  if (level === 'district') return 'id-kecamatan'
  if (level === 'country') return 'id-kabupaten'
  return 'id-provinces'
})

const activeCollection = computed(() => (isMixed.value ? mixedCollection.value : collection.value))

/**
 * Id target yang koleksinya sudah selesai dimuat. Induk memakai ini untuk
 * menunda penggambaran ronde: memuat koleksi itu async, jadi tanpa penanda
 * ini `mark()` dan framing bisa berjalan sebelum layer-nya ada.
 */
const mixedReadyFor = ref<string | null>(null)

async function syncMixedCollection() {
  const target = game.currentTarget
  if (!isMixed.value || !target) return

  mixedReadyFor.value = null
  let next: RegionCollection
  if (target.level === 'district' && target.cityId) {
    next = await loadKecamatanCity(target.cityId)
  }
  else if (target.level === 'country') {
    next = await loadRegionSet('province', 'id-kabupaten')
  }
  else {
    next = await loadRegionSet('province', 'id-provinces')
  }

  // Ronde bisa sudah berganti selama await; jangan timpa koleksi yang lebih baru.
  if (game.currentTarget?.id !== target.id) return
  mixedCollection.value = next
  // Tunggu satu tick supaya layer Leaflet sudah dibangun dari koleksi baru.
  await nextTick()
  mixedReadyFor.value = target.id
}

watch(() => game.currentTarget?.id, syncMixedCollection, { immediate: true })

/** Siap digambar: mode biasa selalu siap, mode campuran menunggu koleksinya. */
const roundReady = computed(() =>
  !isMixed.value || mixedReadyFor.value === game.currentTarget?.id,
)

const activePoolIds = computed(() => {
  // Mode campuran: koleksi yang dimuat berisi seluruh wilayah di level itu,
  // tapi hanya yang ada di pool sesi ini yang boleh diklik.
  if (game.pool && game.pool.length) {
    return new Set(game.pool.map(p => p.id))
  }
  return null
})

const map = useLeafletMap(container, activeCollection, {
  onRegionClick: item => emit('pick', item),
  onMissClick: () => emit('miss'),
  scope,
  worldContext,
  localContext,
  activePoolIds,
  viewMode,
})

/** Latar terang perlu warna kontrol yang gelap, dan sebaliknya. */
const isLightView = computed(() => viewMode.value === 'blueprint')
const canvasColor = computed(() => mapTheme(viewMode.value).canvas)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && viewMenuOpen.value) {
    e.stopPropagation()
    viewMenuOpen.value = false
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown, true))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, true))

function chooseView(id: typeof modes[number]['id']) {
  setMode(id)
  viewMenuOpen.value = false
}

watch(map.ready, (v) => {
  if (v) emit('ready')
})

function zoomIn() {
  map.zoomIn()
}

function zoomOut() {
  map.zoomOut()
}

function resetView() {
  map.resetView()
}

// Parent controls highlight, zoom, and interactions
defineExpose({
  mark: (id: string, kind: RegionMark) => map.mark(id, kind),
  resetStyles: () => map.resetStyles(),
  fitRegion: (id: string) => map.fitRegion(id),
  fitPool: (items: RegionItem[]) => map.fitPool(items),
  fitSameLevel: (target: RegionItem) => map.fitSameLevel(target),
  resetView,
  zoomIn,
  zoomOut,
  setInteractive: (v: boolean) => { map.interactive.value = v },
  invalidate: () => map.invalidate(),
  roundReady,
})
</script>

<template>
  <div class="relative h-full w-full select-none">
    <div
      ref="container"
      class="h-full w-full cursor-crosshair transition-colors"
      :data-view="viewMode"
      :style="{ '--map-canvas': canvasColor }"
    />

    <!-- Loading State -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      leave-active-class="transition duration-200 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="!map.ready.value"
        class="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-zinc-950/80 backdrop-blur-sm text-xs text-zinc-400"
      >
        <div class="h-6 w-6 rounded-full border-2 border-zinc-700 border-t-zinc-200 animate-spin" />
        <p class="font-medium text-zinc-300">Loading vector map...</p>
      </div>
    </Transition>

    <!-- Pemilih mode tampilan peta. Ditaruh di kiri bawah: bilah atas dipakai
         HUD skor/exit (z lebih tinggi), dan kanan bawah dipakai kontrol zoom. -->
    <div v-if="map.ready.value" class="absolute bottom-24 left-4 z-[1150] sm:bottom-20">
      <button
        type="button"
        aria-label="Mode tampilan peta"
        :aria-expanded="viewMenuOpen"
        class="focusable flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold shadow-md backdrop-blur-md transition"
        :class="isLightView
          ? 'border-slate-300 bg-white/90 text-slate-700 hover:bg-white'
          : 'border-zinc-800 bg-zinc-900/90 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'"
        @click="viewMenuOpen = !viewMenuOpen"
      >
        <span aria-hidden="true">{{ modes.find(m => m.id === viewMode)?.icon }}</span>
        <span>{{ modes.find(m => m.id === viewMode)?.label }}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 transition-transform"
          :class="viewMenuOpen ? '' : 'rotate-180'"
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>

      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 translate-y-1"
        leave-active-class="transition duration-100 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="viewMenuOpen"
          class="absolute bottom-full left-0 mb-1.5 w-52 overflow-hidden rounded-xl border shadow-xl backdrop-blur-md"
          :class="isLightView ? 'border-slate-300 bg-white/95' : 'border-zinc-800 bg-zinc-900/95'"
        >
          <button
            v-for="m in modes"
            :key="m.id"
            type="button"
            class="focusable flex w-full items-start gap-2.5 px-3 py-2 text-left transition"
            :class="[
              m.id === viewMode
                ? (isLightView ? 'bg-blue-50' : 'bg-sky-500/15')
                : (isLightView ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'),
            ]"
            :aria-pressed="m.id === viewMode"
            @click="chooseView(m.id)"
          >
            <span class="mt-px text-sm" aria-hidden="true">{{ m.icon }}</span>
            <span class="min-w-0 flex-1">
              <span
                class="block text-[11px] font-semibold"
                :class="m.id === viewMode
                  ? (isLightView ? 'text-blue-700' : 'text-sky-300')
                  : (isLightView ? 'text-slate-700' : 'text-zinc-200')"
              >{{ m.label }}</span>
              <span class="block text-[10px]" :class="isLightView ? 'text-slate-500' : 'text-zinc-500'">{{ m.hint }}</span>
            </span>
            <span
              v-if="m.id === viewMode"
              class="mt-0.5 text-[10px] font-bold"
              :class="isLightView ? 'text-blue-600' : 'text-sky-400'"
              aria-hidden="true"
            >✓</span>
          </button>
        </div>
      </Transition>
    </div>

    <!-- Floating Map Controls (shadcn icon button group) -->
    <div
      v-if="map.ready.value"
      class="pointer-events-auto absolute bottom-24 right-4 z-[1050] flex flex-col gap-1 rounded-lg border p-1 shadow-md backdrop-blur-md sm:bottom-20"
      :class="isLightView ? 'border-slate-300 bg-white/90' : 'border-zinc-800 bg-zinc-900/90'"
    >
      <button
        type="button"
        title="Zoom In"
        aria-label="Zoom In"
        class="flex h-7 w-7 items-center justify-center rounded-md transition active:scale-95"
        :class="isLightView
          ? 'text-slate-500 hover:bg-slate-200 hover:text-slate-900'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'"
        @click="zoomIn"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <div class="h-px" :class="isLightView ? 'bg-slate-300' : 'bg-zinc-800'" />

      <button
        type="button"
        title="Zoom Out"
        aria-label="Zoom Out"
        class="flex h-7 w-7 items-center justify-center rounded-md transition active:scale-95"
        :class="isLightView
          ? 'text-slate-500 hover:bg-slate-200 hover:text-slate-900'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'"
        @click="zoomOut"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <div class="h-px" :class="isLightView ? 'bg-slate-300' : 'bg-zinc-800'" />

      <button
        type="button"
        title="Reset Camera"
        aria-label="Reset Camera"
        class="flex h-7 w-7 items-center justify-center rounded-md transition active:scale-95"
        :class="isLightView
          ? 'text-slate-500 hover:bg-slate-200 hover:text-slate-900'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'"
        @click="resetView"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </button>
    </div>
  </div>
</template>
