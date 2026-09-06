<script setup lang="ts">
import type { RegionItem } from '~/types/game'
import { isoToFlag } from '~/utils/geo'

const emit = defineEmits<{ answer: [item: RegionItem] }>()

const game = useGameStore()
const answered = computed(() => game.phase === 'answered')

const hotkeys = ['A', 'B', 'C', 'D']

function choiceClass(choice: RegionItem) {
  if (!answered.value) {
    return 'border-white/10 bg-slate-900/80 text-slate-200 hover:border-sky-400 hover:bg-slate-800'
  }
  if (choice.id === game.currentTarget?.id) {
    return 'border-emerald-500 bg-emerald-950/60 text-emerald-200 font-semibold shadow-lg shadow-emerald-500/10'
  }
  if (choice.id === game.lastAnswerId) {
    return 'border-rose-500 bg-rose-950/60 text-rose-200'
  }
  return 'border-white/5 bg-slate-950/40 text-slate-600 opacity-60'
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
  if (game.datasetScope === 'id-kabupaten') {
    return `${game.provinceName || 'Province'} Drill-Down`
  }
  if (game.datasetScope === 'id-provinces') {
    return 'Indonesia Provinces Challenge'
  }
  return 'Global Pinpoint Challenge'
})

const modeAInstruction = computed(() => {
  if (game.datasetScope === 'id-kabupaten') {
    return `Locate and click ${game.currentTarget?.name} in ${game.provinceName || 'this region'}.`
  }
  if (game.datasetScope === 'id-provinces') {
    return 'Locate and click this province on the map of Indonesia.'
  }
  return 'Find and click this country directly on the world map.'
})

const modeBQuestion = computed(() => {
  if (game.datasetScope === 'id-kabupaten') {
    return `Which city / regency in ${game.provinceName || 'this region'} is highlighted in yellow?`
  }
  if (game.datasetScope === 'id-provinces') {
    return 'Which Indonesian province is highlighted in yellow on the map?'
  }
  return 'Which territory is highlighted in yellow on the map?'
})
</script>

<template>
  <div class="rounded-2xl border border-white/15 bg-slate-900/90 p-4 sm:p-5 shadow-2xl backdrop-blur-xl">
    <!-- Mode A: Locate Country / Province / City on Map -->
    <template v-if="game.mode === 'A'">
      <div class="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
        <div class="flex items-center gap-2">
          <span
            class="inline-flex h-2 w-2 rounded-full animate-pulse"
            :class="game.datasetScope === 'world' ? 'bg-sky-400' : 'bg-rose-400'"
          />
          <span class="text-[11px] font-bold uppercase tracking-wider text-slate-300">
            {{ challengeBadge }}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <span
            v-if="game.currentTarget"
            class="rounded-md border border-white/10 bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-300"
          >
            {{ game.currentTarget.region }}
          </span>
          <span class="font-mono text-[11px] font-bold text-sky-400">
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
            <h2 class="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-sm">
              {{ game.currentTarget?.name }}
            </h2>
          </div>
          <p class="mt-1 text-xs text-slate-300">
            {{ modeAInstruction }}
          </p>
        </div>
      </div>
    </template>

    <!-- Mode B: Multiple Choice from Highlighted Outline -->
    <template v-else>
      <div class="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
        <div class="flex items-center gap-2">
          <span class="inline-flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span class="text-[11px] font-bold uppercase tracking-wider text-amber-300">
            {{ challengeBadge }}
          </span>
        </div>
        <span class="font-mono text-[11px] font-bold text-amber-400">
          +{{ game.nextPoints }} pts
        </span>
      </div>

      <p class="mt-2.5 text-xs sm:text-sm font-semibold text-white">
        {{ modeBQuestion }}
      </p>

      <div class="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          v-for="(choice, index) in game.choices"
          :key="choice.id"
          type="button"
          :disabled="answered"
          class="group flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition-all disabled:cursor-default active:scale-98"
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
            class="shrink-0 text-emerald-400 font-bold text-xs"
          >
            ✓ Correct
          </span>
          <span
            v-else-if="answered && choice.id === game.lastAnswerId"
            class="shrink-0 text-rose-400 font-bold text-xs"
          >
            ✗ Missed
          </span>
        </button>
      </div>
    </template>
  </div>
</template>
