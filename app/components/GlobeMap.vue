<script setup lang="ts">
import type { RegionItem } from '~/types/game'
import type { RegionMark } from '~/composables/useLeafletMap'

const emit = defineEmits<{
  pick: [item: RegionItem, distanceKm?: number]
  miss: []
  ready: []
}>()

const game = useGameStore()
const { collection, worldContext } = useGeoData()
const { isDark } = useTheme()
const { setMode } = useMapViewMode()
const { t } = useI18n()

const container = ref<HTMLElement | null>(null)

// Globe hanya dipasang di cakupan dunia; `worldContext` jadi cadangan kalau
// `collection` sempat null saat mount (seharusnya sudah terisi oleh play/chain).
const activeCollection = computed(() => collection.value ?? worldContext.value)

const hardcore = computed(() => game.isHardcore)
const soloTargetId = computed(() =>
  hardcore.value && game.mode === 'B' ? game.currentTarget?.id ?? null : null,
)
const targetId = computed(() => game.currentTarget?.id ?? null)
const activePoolIds = computed(() =>
  game.pool?.length ? new Set(game.pool.map(p => p.id)) : null,
)
const spotlightIds = computed(() =>
  game.spotlightIds.length ? new Set(game.spotlightIds) : null,
)

const map = useGlobeMap(container, activeCollection, {
  onRegionClick: (item, distanceKm) => emit('pick', item, distanceKm),
  onMissClick: () => emit('miss'),
  targetId,
  isDark,
  hardcore,
  soloTargetId,
  activePoolIds,
  spotlightIds,
})

// WebGL tidak tersedia / modul gagal dimuat → kembali ke peta 2D.
watch(map.failed, (f) => {
  if (f) setMode('vector')
})

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

defineExpose({
  mark: (id: string, kind: RegionMark) => map.mark(id, kind),
  heat: (id: string, t: number) => map.heat(id, t),
  resetStyles: () => map.resetStyles(),
  fitRegion: (id: string) => map.fitRegion(id),
  fitPool: (items: RegionItem[]) => map.fitPool(items),
  fitSameLevel: (target: RegionItem) => map.fitSameLevel(target),
  resetView,
  zoomIn,
  zoomOut,
  setInteractive: (v: boolean) => { map.interactive.value = v },
  invalidate: () => map.invalidate(),
  roundReady: true,
})
</script>

<template>
  <div class="relative h-full w-full select-none">
    <div ref="container" class="h-full w-full cursor-crosshair" />

    <!-- Loading State -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      leave-active-class="transition duration-200 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="!map.ready.value && !map.failed.value"
        class="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-slate-50/80 dark:bg-slate-950/75 backdrop-blur-sm text-xs"
      >
        <div class="h-6 w-6 rounded-full border-2 border-sky-500/20 border-t-sky-500 dark:border-t-sky-400 animate-spin" />
        <p class="font-medium text-slate-600 dark:text-slate-200">{{ t('map.loading') }}</p>
      </div>
    </Transition>

    <!-- Pemilih mode tampilan peta (kiri bawah) -->
    <MapViewPicker v-if="map.ready.value" :allow-globe="true" />

    <!--
      Kontrol zoom hilang saat kamera dikunci: tombol yang terlihat tapi tidak
      berefek lebih membingungkan daripada tombol yang memang tidak ada.
    -->
    <div
      v-if="map.ready.value && !hardcore"
      class="pointer-events-auto absolute bottom-24 right-4 z-[1050] flex flex-col gap-1 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-1 shadow-md backdrop-blur-md sm:bottom-20"
    >
      <button
        type="button"
        :title="t('map.zoomIn')"
        :aria-label="t('map.zoomIn')"
        class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white active:scale-95"
        @click="zoomIn"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <div class="h-px bg-slate-200 dark:bg-slate-800" />

      <button
        type="button"
        :title="t('map.zoomOut')"
        :aria-label="t('map.zoomOut')"
        class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white active:scale-95"
        @click="zoomOut"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <div class="h-px bg-slate-200 dark:bg-slate-800" />

      <button
        type="button"
        :title="t('map.resetCamera')"
        :aria-label="t('map.resetCamera')"
        class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white active:scale-95"
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
