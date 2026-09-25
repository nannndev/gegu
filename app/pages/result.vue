<script setup lang="ts">
import { isoToFlag, getPerformanceRank } from '~/utils/geo'
import { formatDistance } from '~/utils/distance'
import { challengeUrl } from '~/utils/challenge'
import type { RegionCollection, RoundResult } from '~/types/game'

const game = useGameStore()
const { playFanfare, playClick } = useAudio()
const { t, locale } = useI18n()
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
const linkToast = ref(false)

/**
 * Salin skor dan tautan tantangan digabung ke satu tombol Bagikan. Lima
 * tombol sejajar membuat "Main lagi" — aksi yang paling sering dipakai —
 * tenggelam di antara yang lain.
 */
const shareOpen = ref(false)
const shareMenu = ref<HTMLElement | null>(null)

function toggleShare() {
  playClick()
  shareOpen.value = !shareOpen.value
}

function onDocPointer(e: PointerEvent) {
  if (shareOpen.value && shareMenu.value && !shareMenu.value.contains(e.target as Node)) {
    shareOpen.value = false
  }
}

function onDocKey(e: KeyboardEvent) {
  if (e.key === 'Escape') shareOpen.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointer)
  document.addEventListener('keydown', onDocKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer)
  document.removeEventListener('keydown', onDocKey)
})

// ── Tinjau ronde ──────────────────────────────────────────────
const { collection, loadRegionSet, loadKecamatanCity } = useGeoData()

/** Ronde yang peta mininya sedang dibuka; `null` = semua tertutup. */
const reviewRound = ref<number | null>(null)
const reviewCollection = ref<RegionCollection | null>(null)

/**
 * Koleksi yang memuat target ronde itu. Mode biasa cukup memakai koleksi
 * yang tadi dimuat halaman main; mode campuran harus memuat level yang
 * sesuai, karena tiap ronde bisa berasal dari dataset yang berbeda.
 */
async function collectionFor(row: RoundResult): Promise<RegionCollection | null> {
  if (game.datasetScope !== 'id-mixed') return collection.value
  if (row.level === 'district') {
    const cityId = game.pool.find(i => i.id === row.targetId)?.cityId
    return cityId ? loadKecamatanCity(cityId) : null
  }
  return loadRegionSet('province', row.level === 'country' ? 'id-kabupaten' : 'id-provinces')
}

async function toggleReview(row: RoundResult) {
  playClick()
  if (reviewRound.value === row.round) {
    reviewRound.value = null
    return
  }
  reviewRound.value = row.round
  reviewCollection.value = null
  const next = await collectionFor(row).catch(() => null)
  // Pemain bisa sudah membuka baris lain selama koleksi dimuat.
  if (reviewRound.value === row.round) reviewCollection.value = next
}

const JOURNEY_SKIP = new Set(['id-kecamatan', 'us-county', 'id-mixed'])
const showJourney = computed(() => !JOURNEY_SKIP.has(game.datasetScope) && Boolean(collection.value))

// ── Tautan tantangan ──────────────────────────────────────────
/** Menang/kalah melawan skor si pengirim tautan. */
const challengeOutcome = computed(() => {
  if (game.challengerScore === null) return null
  if (game.score > game.challengerScore) return 'win'
  if (game.score < game.challengerScore) return 'lose'
  return 'tie'
})

/**
 * Mode campuran mengundi kotanya saat sesi dimulai, jadi penerima tautan
 * tidak akan punya pool yang sama — tombolnya disembunyikan di sana.
 */
const canChallenge = computed(() => Boolean(game.shareSetup) && game.datasetScope !== 'id-mixed')

async function shareChallenge() {
  playClick()
  if (!game.shareSetup || !canChallenge.value) return
  const url = challengeUrl({
    setup: game.shareSetup,
    seed: game.seed,
    targets: game.history.map(h => h.targetId),
    score: game.score,
  })
  const text = t('result.challenge.message', { score: game.score, url })
  try {
    // Lembar bagi bawaan ponsel lebih enak daripada salin-tempel; desktop
    // umumnya tidak punya, jadi jatuh ke clipboard.
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ text })
      return
    }
    await navigator.clipboard.writeText(text)
    linkToast.value = true
    setTimeout(() => {
      linkToast.value = false
      shareOpen.value = false
    }, 1500)
  }
  catch {}
}

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
    difficulty: game.difficulty,
    provinceName: game.provinceName,
    cityName: game.cityName,
    stateName: game.stateName,
    scopeKey: game.scopeKey,
    scopeParts: game.scopeParts ?? undefined,
    shareSetup: game.shareSetup ?? undefined,
    // Ulangan tidak dihitung sebagai tantangan harian lagi — hasil harian
    // hanya boleh dicatat sekali per hari.
  })
  navigateTo({ path: '/play', query: { mode } })
}

/**
 * Ulangi hanya wilayah yang tadi salah.
 *
 * Ini bagian yang benar-benar melatih: mengulang sesi penuh berarti
 * menghabiskan sebagian besar ronde pada wilayah yang sudah hafal.
 */
function drillMisses() {
  playClick()
  if (!game.startDrill()) return
  navigateTo({ path: '/play', query: { mode: game.mode } })
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
  if (game.datasetScope === 'my-states') return t('unit.negeri')
  if (game.datasetScope === 'jp-prefectures') return t('unit.prefecture')
  if (game.datasetScope === 'it-provinces') return t('unit.provincia')
  if (game.datasetScope === 'de-states') return t('unit.bundesland')
  return t('unit.country')
})

/**
 * Bendera di kolom nama. Sama seperti di bilah soal, diturunkan dari scope
 * supaya negara ketiga tidak mewarisi bendera Indonesia.
 */
function rowFlag(iso?: string | null) {
  if (game.datasetScope === 'world') return isoToFlag(iso) || '🌐'
  if (game.datasetScope.startsWith('us')) return '🇺🇸'
  if (game.datasetScope.startsWith('my')) return '🇲🇾'
  if (game.datasetScope.startsWith('jp')) return '🇯🇵'
  if (game.datasetScope.startsWith('it')) return '🇮🇹'
  if (game.datasetScope.startsWith('de')) return '🇩🇪'
  return '🇮🇩'
}

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
    game.isHardcore ? t('result.share.hardcore') : '',
  ]
  const text = lines.filter(Boolean).join('\n')

  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      copiedToast.value = true
      setTimeout(() => {
        copiedToast.value = false
        shareOpen.value = false
      }, 1500)
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
              <span
                v-if="game.isHardcore"
                class="rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-rose-600 dark:text-rose-400"
              >
                {{ t('result.hardcoreBadge') }}
              </span>
              <span
                v-if="game.newlyMastered > 0"
                class="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400"
              >
                ⭐ {{ t('result.mastered', { n: game.newlyMastered }) }}
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

        <!-- Hasil duel melawan pengirim tautan -->
        <div
          v-if="challengeOutcome"
          class="mt-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold"
          :class="{
            'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400': challengeOutcome === 'win',
            'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400': challengeOutcome === 'lose',
            'border-slate-300 bg-slate-100/70 text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300': challengeOutcome === 'tie',
          }"
        >
          <span aria-hidden="true">{{ challengeOutcome === 'win' ? '🏆' : challengeOutcome === 'lose' ? '⚔️' : '🤝' }}</span>
          <span>{{ t(`result.challenge.${challengeOutcome}`, { score: game.challengerScore ?? 0 }) }}</span>
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

      <!--
        Rute sesi di globe 3D. Tidak di kecamatan & county: wilayahnya terlalu
        kecil, semua titik menumpuk jadi satu di globe. Tidak di mode campuran
        juga, karena targetnya tersebar di beberapa koleksi sekaligus.
      -->
      <JourneyGlobe
        v-if="showJourney"
        :collection="collection"
        :history="game.history"
      />

      <!-- Round Breakdown Table -->
      <div class="raycast-card overflow-hidden rounded-2xl shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-3.5">
          <div>
            <h2 class="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-900 dark:text-slate-200">
              {{ t('result.tableTitle') }}
            </h2>
            <p class="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{{ t('review.tapHint') }}</p>
          </div>
          <span class="font-mono text-xs text-slate-500 dark:text-slate-400">{{ t('common.rounds', { n: game.history.length }) }}</span>
        </div>

        <div class="max-h-[28rem] overflow-y-auto">
          <table class="w-full text-left text-xs">
            <thead class="sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400">
              <tr>
                <th class="w-16 px-4 py-2.5 font-semibold">#</th>
                <th class="px-4 py-2.5 font-semibold">{{ columnHeader }}</th>
                <th class="px-4 py-2.5 font-semibold">{{ t('result.table.result') }}</th>
                <th class="px-4 py-2.5 text-right font-semibold">{{ t('result.table.points') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200/60 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              <template v-for="row in game.history" :key="row.round">
              <tr
                class="cursor-pointer transition-colors hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
                :class="reviewRound === row.round && 'bg-slate-100/60 dark:bg-slate-800/40'"
                tabindex="0"
                :aria-expanded="reviewRound === row.round"
                @click="toggleReview(row)"
                @keydown.enter.prevent="toggleReview(row)"
                @keydown.space.prevent="toggleReview(row)"
              >
                <td class="px-4 py-2.5 font-mono text-slate-500 dark:text-slate-400">
                  <span class="inline-flex items-center gap-1.5">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-3 w-3 shrink-0 transition-transform duration-200"
                      :class="reviewRound === row.round && 'rotate-90 text-sky-500'"
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    {{ row.round }}
                  </span>
                </td>
                <td class="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">
                  <span class="mr-1.5">{{ rowFlag(row.targetIso) }}</span>
                  <span>{{ row.targetName }}</span>
                  <span v-if="!row.correct && row.answerName" class="ml-1.5 text-[11px] font-normal text-rose-600 dark:text-rose-400">
                    {{ t('result.table.picked', { name: row.answerName }) }}
                  </span>
                  <span v-if="row.usedHint" class="ml-1.5 text-[11px] font-normal text-amber-600 dark:text-amber-400" :title="t('feedback.hinted')">💡</span>
                </td>
                <td class="px-4 py-2.5">
                  <span
                    v-if="row.correct"
                    class="inline-flex items-center rounded border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400"
                  >
                    ✓ {{ t('common.correct') }}
                  </span>
                  <!-- Nyaris-kena: badge sendiri dengan jaraknya, supaya
                       baris berpoin tidak terbaca sebagai salah total. -->
                  <span
                    v-else-if="row.pointsEarned > 0"
                    class="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400"
                  >
                    ◎ {{ t('common.near') }}
                    <span v-if="row.distanceKm !== undefined" class="font-mono normal-case opacity-80">
                      {{ formatDistance(row.distanceKm, locale) }}
                    </span>
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400"
                  >
                    ✗ {{ t('common.wrong') }}
                    <span v-if="row.distanceKm !== undefined" class="font-mono normal-case opacity-80">
                      {{ formatDistance(row.distanceKm, locale) }}
                    </span>
                  </span>
                </td>
                <td class="px-4 py-2.5 text-right font-mono font-bold" :class="row.pointsEarned > 0 ? (row.correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400') : 'text-slate-400 dark:text-slate-500'">
                  {{ row.pointsEarned > 0 ? `+${row.pointsEarned}` : '0' }}
                </td>
              </tr>
              <tr v-if="reviewRound === row.round">
                <td colspan="4" class="bg-slate-50/70 px-4 py-3 dark:bg-slate-950/40">
                  <RoundReview
                    v-if="reviewCollection"
                    :collection="reviewCollection"
                    :target-id="row.targetId"
                    :answer-id="row.answerId"
                  />
                  <div v-else class="h-24 animate-pulse rounded-lg bg-slate-200/60 dark:bg-slate-800/60" />
                  <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-emerald-500" />{{ t('review.legend.target') }}</span>
                    <span v-if="row.answerId && !row.correct" class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full border border-dashed border-rose-500 bg-rose-500/40" />{{ t('review.legend.answer') }}</span>
                  </div>
                </td>
              </tr>
              </template>
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

        <!--
          Latihan hanya muncul kalau ada yang salah — sesi sempurna tidak
          punya apa pun untuk diulang, dan tombol mati di sana cuma jadi
          pertanyaan.
        -->
        <button
          v-if="game.missedItems.length"
          type="button"
          class="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 text-xs font-bold text-amber-700 dark:text-amber-300 transition hover:bg-amber-500/25 active:scale-95 sm:w-auto"
          @click="drillMisses"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 2v6h6" />
            <path d="M3 13a9 9 0 1 0 3-7.7L3 8" />
          </svg>
          {{ t('result.drill', { n: game.missedItems.length }) }}
        </button>

        <div ref="shareMenu" class="relative w-full sm:w-auto">
          <button
            type="button"
            class="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/15 px-4 text-xs font-bold text-violet-700 dark:text-violet-300 transition hover:bg-violet-500/25 active:scale-95 sm:w-auto"
            aria-haspopup="menu"
            :aria-expanded="shareOpen"
            @click="toggleShare"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            {{ t('result.share.button') }}
          </button>

          <Transition name="share-pop">
            <div
              v-if="shareOpen"
              role="menu"
              class="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:left-auto sm:w-64"
            >
              <button
                v-if="canChallenge"
                type="button"
                role="menuitem"
                class="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-violet-500/10"
                @click="shareChallenge"
              >
                <span class="text-base" aria-hidden="true">⚔️</span>
                <span class="min-w-0">
                  <span class="block text-xs font-bold text-slate-900 dark:text-white">{{ linkToast ? t('result.copied') : t('result.challenge.share') }}</span>
                  <span class="block text-[11px] text-slate-500 dark:text-slate-400">{{ t('result.challenge.shareDesc') }}</span>
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                class="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                @click="shareResults"
              >
                <span class="text-base" aria-hidden="true">📋</span>
                <span class="min-w-0">
                  <span class="block text-xs font-bold text-slate-900 dark:text-white">{{ copiedToast ? t('result.copied') : t('result.copy') }}</span>
                  <span class="block text-[11px] text-slate-500 dark:text-slate-400">{{ t('result.copyDesc') }}</span>
                </span>
              </button>
            </div>
          </Transition>
        </div>

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

<style scoped>
.share-pop-enter-active,
.share-pop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.share-pop-enter-from,
.share-pop-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
