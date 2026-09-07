<script setup lang="ts">
import type { RegionItem } from '~/types/game'
import { isoToFlag } from '~/utils/geo'

const emit = defineEmits<{ answer: [item: RegionItem] }>()

const game = useGameStore()
const answered = computed(() => game.phase === 'answered')

const hotkeys = ['A', 'B', 'C', 'D']

function choiceClass(choice: RegionItem) {
  if (!answered.value) {
    return 'border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 hover:border-sky-500/60 hover:bg-sky-50/50 dark:hover:bg-slate-800 shadow-sm'
  }
  if (choice.id === game.currentTarget?.id) {
    return 'border-emerald-500/80 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/30'
  }
  if (choice.id === game.lastAnswerId) {
    return 'border-rose-500/80 bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold ring-1 ring-rose-500/30'
  }
  return 'border-slate-200/50 dark:border-white/5 bg-slate-100/40 dark:bg-slate-950/40 text-slate-400 dark:text-slate-600 opacity-50'
}

// Keyboard shortcuts for Mode B: A, B, C, D or 1, 2, 3, 4
function handleKeyDown(e: KeyboardEvent) {
  if (game.mode !== 'B' || answered.value || !game.choices.length) return
  const key = e.key.toUpperCase()

  let selectedIndex = -1
  if (['A', 'B', 'C', 'D'].includes(key)) {
    selectedIndex = ['A', 'B', 'C', 'D'].indexOf(key)
  }
  else if (['1', '2', '3', '4'].includes(key)) {
    selectedIndex = Number(key) - 1
  }

  if (selectedIndex >= 0 && selectedIndex < game.choices.length) {
    const item = game.choices[selectedIndex]
    if (item) emit('answer', item)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

const challengeBadge = computed(() => {
  if (game.datasetScope === 'id-kecamatan') {
    return `${game.cityName || 'Kota'} · Kecamatan`
  }
  if (game.datasetScope === 'id-kabupaten') {
    return `${game.provinceName || 'Provinsi'} · Kab/Kota`
  }
  if (game.datasetScope === 'id-provinces') {
    return 'Indonesia · Provinsi'
  }
  return 'Dunia'
})

const modeAInstruction = computed(() => {
  if (game.datasetScope === 'id-kecamatan') {
    return `Cari Kecamatan ${game.currentTarget?.name}, lalu klik wilayahnya di peta.`
  }
  if (game.datasetScope === 'id-kabupaten') {
    return `Cari ${game.currentTarget?.name}, lalu klik wilayahnya di peta.`
  }
  if (game.datasetScope === 'id-provinces') {
    return 'Klik batas provinsi ini di peta Indonesia.'
  }
  return 'Klik negara ini di peta dunia.'
})

const modeBQuestion = computed(() => {
  if (game.datasetScope === 'id-kecamatan') {
    return `Kecamatan mana yang sedang disorot di ${game.cityName || 'kota ini'}?`
  }
  if (game.datasetScope === 'id-kabupaten') {
    return `Wilayah mana yang sedang disorot di ${game.provinceName || 'provinsi ini'}?`
  }
  if (game.datasetScope === 'id-provinces') {
    return 'Provinsi mana yang sedang disorot di peta?'
  }
  return 'Negara mana yang sedang disorot di peta?'
})
</script>

<template>
  <div class="raycast-card rounded-2xl p-4 sm:p-5 shadow-2xl">
    <!-- Mode A: Find on Map -->
    <template v-if="game.mode === 'A'">
      <div class="flex items-center justify-between border-b border-slate-200/80 dark:border-white/10 pb-2.5">
        <div class="flex items-center gap-2">
          <span
            class="inline-flex h-2 w-2 rounded-full animate-pulse"
            :class="game.datasetScope === 'world' ? 'bg-sky-500' : 'bg-rose-500'"
          />
          <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {{ challengeBadge }}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <span
            v-if="game.currentTarget"
            class="rounded-md border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300"
          >
            {{ game.currentTarget.region }}
          </span>
          <span class="font-mono text-[11px] font-bold text-sky-600 dark:text-sky-400">
            +{{ game.nextPoints }} pts
          </span>
        </div>
      </div>

      <div class="mt-3 flex items-baseline justify-between gap-4">
        <div>
          <div class="flex items-center gap-2.5">
            <span class="text-2xl select-none" aria-hidden="true">
              {{ game.datasetScope === 'world' ? (isoToFlag(game.currentTarget?.iso) || '🌐') : '🇮🇩' }}
            </span>
            <h2 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white drop-shadow-sm">
              {{ game.currentTarget?.name }}
            </h2>
          </div>
          <p class="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {{ modeAInstruction }}
          </p>
        </div>
      </div>
    </template>

    <!-- Mode B: Multiple Choice from Highlighted Outline -->
    <template v-else>
      <div class="flex items-center justify-between border-b border-slate-200/80 dark:border-white/10 pb-2.5">
        <div class="flex items-center gap-2">
          <span class="inline-flex h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
          <span class="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
            {{ challengeBadge }}
          </span>
        </div>
        <span class="font-mono text-[11px] font-bold text-sky-600 dark:text-sky-400">
          +{{ game.nextPoints }} pts
        </span>
      </div>

      <p class="mt-2.5 text-sm font-bold text-slate-900 dark:text-white sm:text-base">
        {{ modeBQuestion }}
      </p>

      <div class="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          v-for="(choice, index) in game.choices"
          :key="choice.id"
          type="button"
          :disabled="answered"
          class="group flex min-h-11 items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition-all disabled:cursor-default active:scale-98"
          :class="choiceClass(choice)"
          @click="emit('answer', choice)"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <kbd class="shadcn-kbd text-[10px]">
              {{ hotkeys[index] }}
            </kbd>
            <span class="truncate">
              {{ choice.name }}
            </span>
          </div>

          <span
            v-if="answered && choice.id === game.currentTarget?.id"
            class="shrink-0 text-emerald-600 dark:text-emerald-400 font-bold text-xs"
          >
            ✓ Benar
          </span>
          <span
            v-else-if="answered && choice.id === game.lastAnswerId"
            class="shrink-0 text-rose-600 dark:text-rose-400 font-bold text-xs"
          >
            ✗ Meleset
          </span>
        </button>
      </div>
    </template>
  </div>
</template>
