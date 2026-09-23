<script setup lang="ts">
import type { MapViewMode } from '~/composables/useMapView'

/**
 * Pemilih mode tampilan peta (kiri bawah). Dipakai bersama oleh MapView
 * (Leaflet 2D) dan GlobeMap (3D), supaya menu & state-nya tidak diduplikasi.
 */
const props = withDefaults(defineProps<{
  /** Bolehkan opsi globe 3D? Hanya cakupan dunia yang menyediakannya. */
  allowGlobe?: boolean
}>(), {
  allowGlobe: false,
})

const { mode, setMode, modes } = useMapViewMode()
const { t } = useI18n()

const open = ref(false)

const active = computed(() => modes.find(m => m.id === mode.value))
const visibleModes = computed(() =>
  props.allowGlobe ? modes : modes.filter(m => m.id !== 'globe'),
)

function choose(id: MapViewMode) {
  setMode(id)
  open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    e.stopPropagation()
    open.value = false
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown, true))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, true))
</script>

<template>
  <div class="absolute bottom-24 left-4 z-[1150] sm:bottom-20">
    <button
      type="button"
      :aria-label="t('map.viewLabel')"
      :aria-expanded="open"
      class="focusable flex items-center gap-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 shadow-md backdrop-blur-md transition hover:bg-slate-100 dark:hover:bg-slate-800"
      @click="open = !open"
    >
      <span aria-hidden="true">{{ active?.icon }}</span>
      <span>{{ active ? t(active.labelKey) : '' }}</span>
      <svg
        xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-slate-400 transition-transform"
        :class="open ? '' : 'rotate-180'"
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
        v-if="open"
        class="absolute bottom-full left-0 mb-1.5 w-52 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-xl backdrop-blur-md p-1"
      >
        <button
          v-for="m in visibleModes"
          :key="m.id"
          type="button"
          class="focusable flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition"
          :class="[
            m.id === mode
              ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80',
          ]"
          :aria-pressed="m.id === mode"
          @click="choose(m.id)"
        >
          <span class="mt-px text-sm" aria-hidden="true">{{ m.icon }}</span>
          <span class="min-w-0 flex-1">
            <span class="block text-[11px] font-semibold">{{ t(m.labelKey) }}</span>
            <span class="block text-[10px] text-slate-400 dark:text-slate-500">{{ t(m.hintKey) }}</span>
          </span>
          <span
            v-if="m.id === mode"
            class="mt-0.5 text-[10px] font-bold text-sky-500"
            aria-hidden="true"
          >✓</span>
        </button>
      </div>
    </Transition>
  </div>
</template>
