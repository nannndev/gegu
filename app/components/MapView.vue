<script setup lang="ts">
import type { RegionItem } from '~/types/game'
import type { RegionMark } from '~/composables/useLeafletMap'

const emit = defineEmits<{
  pick: [item: RegionItem]
  miss: []
  ready: []
}>()

const game = useGameStore()
const { collection, worldContext } = useGeoData()
const container = ref<HTMLElement | null>(null)
const scope = computed(() => game.datasetScope)

const activePoolIds = computed(() => {
  if (game.pool && game.pool.length) {
    return new Set(game.pool.map(p => p.id))
  }
  return null
})

const map = useLeafletMap(container, collection, {
  onRegionClick: item => emit('pick', item),
  onMissClick: () => emit('miss'),
  scope,
  worldContext,
  activePoolIds,
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

// Parent controls highlight, zoom, and interactions
defineExpose({
  mark: (id: string, kind: RegionMark) => map.mark(id, kind),
  resetStyles: () => map.resetStyles(),
  fitRegion: (id: string) => map.fitRegion(id),
  fitPool: (items: RegionItem[]) => map.fitPool(items),
  resetView,
  zoomIn,
  zoomOut,
  setInteractive: (v: boolean) => { map.interactive.value = v },
  invalidate: () => map.invalidate(),
})
</script>

<template>
  <div class="relative h-full w-full select-none">
    <div ref="container" class="h-full w-full cursor-crosshair bg-zinc-950" />

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

    <!-- Floating Map Controls (shadcn icon button group) -->
    <div
      v-if="map.ready.value"
      class="pointer-events-auto absolute bottom-24 right-4 z-[1050] flex flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-900/90 p-1 shadow-md backdrop-blur-md sm:bottom-20"
    >
      <button
        type="button"
        title="Zoom In"
        aria-label="Zoom In"
        class="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 active:scale-95"
        @click="zoomIn"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <div class="h-px bg-zinc-800" />

      <button
        type="button"
        title="Zoom Out"
        aria-label="Zoom Out"
        class="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 active:scale-95"
        @click="zoomOut"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <div class="h-px bg-zinc-800" />

      <button
        type="button"
        title="Reset Camera"
        aria-label="Reset Camera"
        class="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 active:scale-95"
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
