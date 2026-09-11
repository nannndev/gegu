<script setup lang="ts">
import { isoToFlag, getPerformanceRank } from '~/utils/geo'

const game = useGameStore()
const { playFanfare, playClick } = useAudio()
const { t } = useI18n()
const { formatScope } = useScopeLabel()

if (!game.history.length) await navigateTo('/')

/** Peringkat + teksnya; dirakit saat render supaya ikut bahasa aktif. */
const rank = computed(() => {
  const r = getPerformanceRank(game.accuracy, game.score)
  return {
    ...r,
    title: t(`rank.${r.tier}.title`),
    badge: t(`rank.${r.tier}.badge`),
    desc: t(`rank.${r.tier}.desc`),
  }
})
const copiedToast = ref(false)

// Animate the final score counting up from 0 (skipped for reduced motion).
const displayedScore = ref(0)
let rafId: number | null = null
function countUpScore() {
  const prefersReduced = import.meta.client
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReduced) {
    displayedScore.value = game.score
    return
  }
  const from = 0
  const to = game.score
  if (to <= 0) {
    displayedScore.value = 0
    return
  }
  const duration = 650
  const start = performance.now()
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    displayedScore.value = Math.round(from + (to - from) * easeOut(t))
    if (t < 1) rafId = requestAnimationFrame(step)
    else displayedScore.value = to
  }
  rafId = requestAnimationFrame(step)
}
onMounted(() => {
  countUpScore()
  playFanfare()
})
onBeforeUnmount(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
})

function playAgain() {
  playClick()
  const mode = game.mode
  game.startGame({
    mode,
    pool: game.pool,
    regionFilter: game.regionFilter,
    timerEnabled: game.timerEnabled,
    roundsCount: game.totalRounds,
    scope: game.datasetScope,
    provinceName: game.provinceName,
    cityName: game.cityName,
    stateName: game.stateName,
    scopeKey: game.scopeKey,
    scopeParts: game.scopeParts ?? undefined,
    // Ulangan tidak dihitung sebagai tantangan harian lagi — hasil harian
    // hanya boleh dicatat sekali per hari.
  })
  navigateTo({ path: '/play', query: { mode } })
}

function toHome() {
  playClick()
  game.resetGame()
  navigateTo('/')
}

/**
 * Label cakupan; dipakai di header dan teks yang disalin. Dirakit dari
 * penyusunnya, bukan dibaca sebagai teks jadi, jadi mengganti bahasa di
 * layar ini langsung ikut berubah.
 */
const scopeLabel = computed(() =>
  formatScope(game.scopeParts ?? {
    scope: game.datasetScope,
    regionFilter: game.regionFilter,
    provinceName: game.provinceName,
    cityName: game.cityName,
    stateName: game.stateName,
  }),
)

/** Judul kolom tabel: satuan wilayah yang ditebak di sesi ini. */
const columnHeader = computed(() => {
  if (game.datasetScope === 'id-kecamatan') return t('scope.kecamatan')
  if (game.datasetScope === 'id-kabupaten') return t('setup.level.kabupaten')
  if (game.datasetScope === 'id-provinces') return t('scope.provinces')
  if (game.datasetScope === 'id-mixed') return t('unit.region')
  if (game.datasetScope === 'us-states') return t('unit.state')
  if (game.datasetScope === 'us-county') return t('unit.county')
  return t('unit.country')
})

/**
 * Ringkasan ronde sebagai deret emoji, biar hasil yang disalin langsung
 * kebaca di chat tanpa harus membuka tabelnya.
 */
const resultSquares = computed(() =>
  game.history.map(h => (h.correct ? '🟩' : '🟥')).join(''),
)

async function shareResults() {
  playClick()
  const modeName = game.mode === 'A' ? t('setup.mode.a.short') : t('setup.mode.b.short')
  const lines = [
    game.dailyKey
      ? t('result.share.daily', { key: game.dailyKey })
      : t('result.share.title'),
    rank.value.title,
    resultSquares.value,
    t('result.share.score', { score: game.score, accuracy: game.accuracy }),
    t('result.share.correct', {
      correct: game.correctCount,
      total: game.history.length,
      streak: game.bestStreak,
    }),
    t('result.share.mode', { mode: modeName, scope: scopeLabel.value }),
  ]
  const text = lines.filter(Boolean).join('\n')

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
</script>

<template>
  <div class="relative flex min-h-dvh flex-col justify-center bg-slate-50 dark:bg-[#080b11] px-4 py-8 text-slate-900 dark:text-slate-100 selection:bg-sky-500/20 selection:text-sky-400 sm:py-12 transition-colors duration-200">
    <!-- Ambient glow -->
    <div class="pointer-events-none fixed inset-0 bg-ambient-glow" />

    <div class="relative z-10 mx-auto w-full max-w-3xl space-y-5">
      <!--
        Pengalih bahasa & tema ikut hadir di sini: layar ini bisa jadi tempat
        pertama pemain berhenti lama (skor dibaca, disalin, dibagikan), dan
        tanpa kontrol ini satu-satunya jalan ganti bahasa adalah balik ke menu.
      -->
      <div class="flex items-center justify-end gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <!-- Session Header Card — cool elegant summary -->
      <div class="step-card p-6 sm:p-8 shadow-xl">
        <div class="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-sky-600 dark:text-sky-400">
                {{ rank.icon }} {{ rank.badge }}
              </span>
              <span
                v-if="game.dailyKey"
                class="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400"
              >
                🎯 {{ t('daily.badge', { key: game.dailyKey }) }}
              </span>
              <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {{ game.mode === 'A' ? t('setup.mode.a.short') : t('setup.mode.b.short') }} · {{ scopeLabel }}
              </span>
            </div>

            <h1 class="mt-3 font-display text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              {{ rank.title }}
            </h1>
            <p class="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {{ rank.desc }}
            </p>
          </div>

          <div class="shrink-0 border-t border-slate-200 dark:border-slate-800 pt-3 text-left sm:border-t-0 sm:pt-0 sm:text-right">
            <span class="block font-mono text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{{ t('result.finalScore') }}</span>
            <span class="font-display text-5xl font-black text-slate-900 dark:text-white sm:text-6xl" aria-live="polite">
              {{ displayedScore }}
            </span>
          </div>
        </div>

        <!-- Ringkasan per ronde sebagai deret kotak -->
        <div class="flex flex-wrap gap-1 pt-6" role="img" :aria-label="t('result.squares', { correct: game.correctCount, total: game.history.length })">
          <span
            v-for="row in game.history"
            :key="row.round"
            class="h-2.5 w-6 rounded-full"
            :class="row.correct ? 'bg-emerald-500' : 'bg-rose-500/70'"
          />
        </div>

        <!-- Metrics Grid -->
        <div class="grid grid-cols-3 gap-3 pt-5">
          <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-800/40 p-3.5 text-center">
            <span class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{{ t('result.accuracy') }}</span>
            <span class="mt-1 block font-mono text-2xl font-black text-slate-900 dark:text-white">
              {{ game.accuracy }}%
            </span>
          </div>

          <div class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-center">
            <span class="block text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">{{ t('result.correct') }}</span>
            <span class="mt-1 block font-mono text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {{ game.correctCount }}<span class="text-emerald-700/60 dark:text-emerald-400/60 text-sm font-normal">/{{ game.history.length }}</span>
            </span>
          </div>

          <div class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-center">
            <span class="block text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">{{ t('result.bestStreak') }}</span>
            <span class="mt-1 block font-mono text-2xl font-black text-amber-700 dark:text-amber-400">
              {{ game.bestStreak }} 🔥
            </span>
          </div>
        </div>
      </div>

      <!-- Round Breakdown Table -->
      <div class="raycast-card overflow-hidden rounded-2xl shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-3.5">
          <h2 class="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-900 dark:text-slate-200">
            {{ t('result.tableTitle') }}
          </h2>
          <span class="font-mono text-xs text-slate-500 dark:text-slate-400">{{ t('common.rounds', { n: game.history.length }) }}</span>
        </div>

        <div class="max-h-64 overflow-y-auto">
          <table class="w-full text-left text-xs">
            <thead class="sticky top-0 border-b border-slate-200 dark:border-slate-800 bg-slate-100/95 dark:bg-slate-900/95 text-slate-500 dark:text-slate-400 backdrop-blur">
              <tr>
                <th class="w-12 px-4 py-2.5 font-semibold">#</th>
                <th class="px-4 py-2.5 font-semibold">{{ columnHeader }}</th>
                <th class="px-4 py-2.5 font-semibold">{{ t('result.table.result') }}</th>
                <th class="px-4 py-2.5 text-right font-semibold">{{ t('result.table.points') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200/60 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              <tr
                v-for="row in game.history"
                :key="row.round"
                class="transition-colors hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
              >
                <td class="px-4 py-2.5 font-mono text-slate-500 dark:text-slate-400">
                  {{ row.round }}
                </td>
                <td class="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">
                  <span class="mr-1.5">{{ game.datasetScope === 'world' ? (isoToFlag(row.targetIso) || '🌐') : '🇮🇩' }}</span>
                  <span>{{ row.targetName }}</span>
                  <span v-if="!row.correct && row.answerName" class="ml-1.5 text-[11px] font-normal text-rose-600 dark:text-rose-400">
                    {{ t('result.table.picked', { name: row.answerName }) }}
                  </span>
                </td>
                <td class="px-4 py-2.5">
                  <span
                    v-if="row.correct"
                    class="inline-flex items-center rounded border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400"
                  >
                    ✓ {{ t('common.correct') }}
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center rounded border border-rose-500/30 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400"
                  >
                    ✗ {{ t('common.wrong') }}
                  </span>
                </td>
                <td class="px-4 py-2.5 text-right font-mono font-bold" :class="row.correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'">
                  {{ row.correct ? `+${row.pointsEarned}` : '0' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Action Buttons Row -->
      <div class="flex flex-col items-center gap-3 pt-1 sm:flex-row">
        <button
          type="button"
          class="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 px-5 font-display text-sm font-bold text-white shadow-lg shadow-sky-600/25 transition active:scale-95 sm:flex-1"
          @click="playAgain"
        >
          {{ t('result.playAgain') }}
        </button>

        <button
          type="button"
          class="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 sm:w-auto"
          @click="shareResults"
        >
          {{ copiedToast ? t('result.copied') : t('result.copy') }}
        </button>

        <button
          type="button"
          class="inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 transition hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white active:scale-95 sm:w-auto"
          @click="toHome"
        >
          {{ t('result.home') }}
        </button>
      </div>
    </div>
  </div>
</template>
