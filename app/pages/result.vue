<script setup lang="ts">
import { isoToFlag, getPerformanceRank } from '~/utils/geo'

const game = useGameStore()
const { playFanfare, playClick } = useAudio()

if (!game.history.length) await navigateTo('/')

const rank = computed(() => getPerformanceRank(game.accuracy, game.score))
const copiedToast = ref(false)

function playAgain() {
  playClick()
  const mode = game.mode
  const pool = game.pool
  const regionFilter = game.regionFilter
  const timerEnabled = game.timerEnabled
  const roundsCount = game.totalRounds
  const scope = game.datasetScope
  const provinceName = game.provinceName
  game.startGame({ mode, pool, regionFilter, timerEnabled, roundsCount, scope, provinceName })
  navigateTo({ path: '/play', query: { mode } })
}

function toHome() {
  playClick()
  game.resetGame()
  navigateTo('/')
}

async function shareResults() {
  playClick()
  const modeName = game.mode === 'A' ? 'Pinpoint Mode' : 'Outline Mode'
  const scopeLabel = game.datasetScope === 'id-kabupaten'
    ? `Indonesia (${game.provinceName || 'Kabupaten'} Drill-Down)`
    : game.datasetScope === 'id-provinces'
    ? 'Indonesia (38 Provinces)'
    : (game.regionFilter === 'all' ? 'World' : game.regionFilter)
  const text = [
    `GeoGuesser Pro Session Results`,
    `Rank: ${rank.value.title}`,
    `Score: ${game.score} pts`,
    `Accuracy: ${game.accuracy}% (${game.correctCount}/${game.history.length})`,
    `Streak: ${game.bestStreak}`,
    `Mode: ${modeName} (${scopeLabel})`,
  ].join('\n')

  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      copiedToast.value = true
      setTimeout(() => {
        copiedToast.value = false
      }, 2500)
    }
  }
  catch {}
}

onMounted(() => {
  playFanfare()
})
</script>

<template>
  <div class="relative min-h-dvh bg-[#070a12] text-slate-100 flex flex-col justify-center px-4 py-8 sm:py-12 selection:bg-sky-500/20 selection:text-sky-200">
    <!-- Ambient glow -->
    <div class="pointer-events-none fixed inset-0 bg-ambient-glow" />

    <div class="relative z-10 mx-auto w-full max-w-2xl space-y-5">
      <!-- Session Header Card -->
      <div class="raycast-card rounded-2xl p-6 sm:p-7 shadow-xl">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
          <div>
            <div class="flex items-center gap-2">
              <span class="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-bold text-sky-400">
                {{ rank.badge }}
              </span>
              <span class="text-xs text-slate-400">
                Mode {{ game.mode }} · {{ game.datasetScope === 'id-kabupaten' ? `🇮🇩 Indonesia (${game.provinceName || 'Kabupaten'} Drill-Down)` : game.datasetScope === 'id-provinces' ? '🇮🇩 Indonesia (38 Provinces)' : (game.regionFilter === 'all' ? 'Worldwide' : game.regionFilter) }}
              </span>
            </div>

            <h1 class="mt-2.5 text-2xl sm:text-3xl font-black tracking-tight text-white">
              {{ rank.title }}
            </h1>
            <p class="mt-1 text-xs sm:text-sm text-slate-400 leading-relaxed">
              {{ rank.desc }}
            </p>
          </div>

          <div class="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-white/[0.08]">
            <span class="text-xs text-slate-400 font-semibold block uppercase tracking-wider">Total Score</span>
            <span class="font-mono text-4xl sm:text-5xl font-black text-white drop-shadow-sm">
              {{ game.score }}
            </span>
          </div>
        </div>

        <!-- Metrics Grid -->
        <div class="grid grid-cols-3 gap-3 pt-5">
          <div class="rounded-xl border border-white/10 bg-slate-900/60 p-3.5 text-center">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Accuracy</span>
            <span class="font-mono text-xl sm:text-2xl font-black text-white mt-1 block">
              {{ game.accuracy }}%
            </span>
          </div>

          <div class="rounded-xl border border-white/10 bg-slate-900/60 p-3.5 text-center">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Correct</span>
            <span class="font-mono text-xl sm:text-2xl font-black text-emerald-400 mt-1 block">
              {{ game.correctCount }}<span class="text-slate-500 text-sm font-normal">/{{ game.history.length }}</span>
            </span>
          </div>

          <div class="rounded-xl border border-white/10 bg-slate-900/60 p-3.5 text-center">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Peak Streak</span>
            <span class="font-mono text-xl sm:text-2xl font-black text-amber-400 mt-1 block">
              {{ game.bestStreak }} 🔥
            </span>
          </div>
        </div>
      </div>

      <!-- Round Breakdown Table -->
      <div class="raycast-card rounded-2xl overflow-hidden shadow-xl">
        <div class="px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between">
          <h2 class="text-xs font-bold text-white uppercase tracking-wider">
            {{ game.datasetScope === 'id' ? 'Provinces Breakdown' : 'Round Breakdown' }}
          </h2>
          <span class="text-xs font-mono text-slate-400">{{ game.history.length }} Rounds</span>
        </div>

        <div class="max-h-64 overflow-y-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-900/90 text-slate-400 sticky top-0 border-b border-white/[0.08]">
              <tr>
                <th class="px-4 py-2.5 font-semibold w-12">#</th>
                <th class="px-4 py-2.5 font-semibold">{{ game.datasetScope === 'id' ? 'Province' : 'Country' }}</th>
                <th class="px-4 py-2.5 font-semibold">Outcome</th>
                <th class="px-4 py-2.5 font-semibold text-right">Points</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/[0.06] text-slate-300">
              <tr
                v-for="row in game.history"
                :key="row.round"
                class="hover:bg-slate-800/40 transition-colors"
              >
                <td class="px-4 py-2.5 font-mono text-slate-500">
                  {{ row.round }}
                </td>
                <td class="px-4 py-2.5 font-semibold text-white">
                  <span class="mr-1.5">{{ game.datasetScope === 'id' ? '🇮🇩' : (isoToFlag(row.targetIso) || '🌐') }}</span>
                  <span>{{ row.targetName }}</span>
                  <span v-if="!row.correct && row.answerName" class="text-rose-400 ml-1.5 text-[11px] font-normal">
                    (picked {{ row.answerName }})
                  </span>
                </td>
                <td class="px-4 py-2.5">
                  <span
                    v-if="row.correct"
                    class="inline-flex items-center rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold text-emerald-400"
                  >
                    Correct
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center rounded-md bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[11px] font-bold text-rose-400"
                  >
                    Missed
                  </span>
                </td>
                <td class="px-4 py-2.5 font-mono text-right font-bold" :class="row.correct ? 'text-emerald-400' : 'text-slate-500'">
                  {{ row.correct ? `+${row.pointsEarned}` : '0' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Action Buttons Row -->
      <div class="flex flex-col sm:flex-row items-center gap-3 pt-1">
        <button
          type="button"
          class="inline-flex h-10 w-full sm:flex-1 items-center justify-center rounded-xl bg-white px-4 text-xs font-bold text-slate-950 transition hover:bg-slate-200 active:scale-95 shadow-lg"
          @click="playAgain"
        >
          Play Again
        </button>

        <button
          type="button"
          class="inline-flex h-10 w-full sm:w-auto items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 px-4 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white active:scale-95"
          @click="shareResults"
        >
          {{ copiedToast ? '✓ Copied to Clipboard' : 'Share Score' }}
        </button>

        <button
          type="button"
          class="inline-flex h-10 w-full sm:w-auto items-center justify-center rounded-xl px-4 text-xs font-semibold text-slate-400 transition hover:bg-slate-900 hover:text-white active:scale-95"
          @click="toHome"
        >
          Main Menu
        </button>
      </div>
    </div>
  </div>
</template>
