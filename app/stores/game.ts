import { defineStore } from 'pinia'
import type { Feedback, GameMode, RegionItem, RoundResult, DatasetScope } from '~/types/game'
import { recordSession } from '~/utils/stats'
import { saveDailyResult } from '~/utils/daily'

export const TOTAL_ROUNDS = 10
export const ROUND_SECONDS = 15
const BASE_POINTS = 10
const STREAK_BONUS = 2
const CHOICE_COUNT = 4

/** `poin = 10 + (streak * 2)` — streak dihitung sebelum jawaban ini. */
export function scoreFor(streak: number): number {
  return BASE_POINTS + streak * STREAK_BONUS
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

type Phase = 'idle' | 'playing' | 'answered' | 'finished'

interface StartOptions {
  mode: GameMode
  pool: RegionItem[]
  regionFilter?: string
  timerEnabled?: boolean
  roundsCount?: number
  scope?: DatasetScope
  provinceName?: string
  cityName?: string
  /** Kunci papan rekor; satu per cakupan soal. */
  scopeKey?: string
  /** Label cakupan siap-tampil, dipakai layar hasil & tombol bagikan. */
  scopeLabel?: string
  /** Kunci tanggal kalau sesi ini berasal dari tantangan harian. */
  daily?: string
}

export const useGameStore = defineStore('game', () => {
  const mode = ref<GameMode>('A')
  const datasetScope = ref<DatasetScope>('world')
  const provinceName = ref<string>('')
  const cityName = ref<string>('')
  const regionFilter = ref('all')
  const timerEnabled = ref(false)
  const preferredRounds = ref(TOTAL_ROUNDS)
  const scopeKey = ref('world')
  const scopeLabel = ref('')
  const dailyKey = ref('')

  const score = ref(0)
  const streak = ref(0)
  const bestStreak = ref(0)
  const currentRound = ref(0)
  const totalRounds = ref(TOTAL_ROUNDS)
  const phase = ref<Phase>('idle')

  /** Semua wilayah yang boleh keluar di sesi ini (sudah difilter region). */
  const pool = ref<RegionItem[]>([])
  /** Anti-repeat: id yang sudah dipakai tidak diulang sampai pool habis. */
  const usedIds = ref<string[]>([])

  const currentTarget = ref<RegionItem | null>(null)
  /** Pilihan ganda Mode B. Kosong di Mode A. */
  const choices = ref<RegionItem[]>([])
  const lastAnswerId = ref<string | null>(null)
  const feedback = ref<Feedback | null>(null)
  const history = ref<RoundResult[]>([])
  const secondsLeft = ref(ROUND_SECONDS)

  const isLastRound = computed(() => currentRound.value >= totalRounds.value)
  const correctCount = computed(() => history.value.filter(h => h.correct).length)
  const accuracy = computed(() =>
    history.value.length
      ? Math.round((correctCount.value / history.value.length) * 100)
      : 0,
  )
  const nextPoints = computed(() => scoreFor(streak.value))

  function resetGame() {
    score.value = 0
    streak.value = 0
    bestStreak.value = 0
    currentRound.value = 0
    phase.value = 'idle'
    usedIds.value = []
    currentTarget.value = null
    choices.value = []
    lastAnswerId.value = null
    feedback.value = null
    history.value = []
    secondsLeft.value = ROUND_SECONDS
  }

  /**
   * Ambil target acak yang belum pernah keluar. Pool di-refill kalau habis.
   *
   * Mode campuran mengundi levelnya lebih dulu, baru wilayahnya. Kalau langsung
   * mengundi dari pool, kabupaten/kota (514 item) mengisi ±85% undian dan
   * provinsi cuma 6% — "campuran" jadi terasa seperti mode kabupaten saja.
   */
  function pickTarget(): RegionItem | null {
    if (!pool.value.length) return null
    let remaining = pool.value.filter(i => !usedIds.value.includes(i.id))
    if (!remaining.length) {
      usedIds.value = []
      remaining = pool.value
    }

    if (datasetScope.value === 'id-mixed') {
      const levels = [...new Set(remaining.map(i => i.level).filter(Boolean))]
      if (levels.length > 1) {
        const level = levels[Math.floor(Math.random() * levels.length)]
        const sameLevel = remaining.filter(i => i.level === level)
        if (sameLevel.length) remaining = sameLevel
      }
    }

    return remaining[Math.floor(Math.random() * remaining.length)] ?? null
  }

  /** 1 jawaban benar + 3 distraktor, diutamakan dari region yang sama. */
  function buildChoices(target: RegionItem): RegionItem[] {
    let others = pool.value.filter(i => i.id !== target.id)

    // Mode campuran: distraktor harus selevel target. Tanpa ini, soal
    // kecamatan bisa berpilihan provinsi — jawabannya jadi terlalu jelas.
    if (target.level) {
      const sameLevel = others.filter(i => i.level === target.level)
      if (sameLevel.length >= CHOICE_COUNT - 1) others = sameLevel
    }

    const sameRegion = shuffle(others.filter(i => i.region === target.region))
    const rest = shuffle(others.filter(i => i.region !== target.region))
    const distractors = [...sameRegion, ...rest].slice(0, CHOICE_COUNT - 1)
    return shuffle([target, ...distractors])
  }

  function finishGame() {
    // Sesi tanpa ronde selesai (mis. pool kosong) tidak dicatat — kalau ikut
    // masuk, jumlah "total sesi" naik tanpa pemain pernah menjawab apa pun.
    const alreadyFinished = phase.value === 'finished'
    phase.value = 'finished'
    if (alreadyFinished || !history.value.length) return

    recordSession({
      scopeKey: scopeKey.value || datasetScope.value,
      score: score.value,
      bestStreak: bestStreak.value,
      accuracy: accuracy.value,
    })

    if (dailyKey.value) {
      saveDailyResult({
        key: dailyKey.value,
        score: score.value,
        accuracy: accuracy.value,
      })
    }
  }

  function startGame(options: StartOptions) {
    resetGame()
    mode.value = options.mode
    datasetScope.value = options.scope ?? 'world'
    provinceName.value = options.provinceName ?? ''
    cityName.value = options.cityName ?? ''
    regionFilter.value = options.regionFilter ?? 'all'
    timerEnabled.value = options.timerEnabled ?? false
    preferredRounds.value = options.roundsCount ?? TOTAL_ROUNDS
    scopeKey.value = options.scopeKey ?? options.scope ?? 'world'
    scopeLabel.value = options.scopeLabel ?? ''
    dailyKey.value = options.daily ?? ''
    pool.value = options.pool
    totalRounds.value = Math.min(preferredRounds.value, options.pool.length)
    nextRound()
  }

  function nextRound() {
    if (isLastRound.value) {
      finishGame()
      return
    }
    const target = pickTarget()
    if (!target) {
      finishGame()
      return
    }
    currentRound.value += 1
    usedIds.value.push(target.id)
    currentTarget.value = target
    choices.value = mode.value === 'B' ? buildChoices(target) : []
    lastAnswerId.value = null
    feedback.value = null
    secondsLeft.value = ROUND_SECONDS
    phase.value = 'playing'
  }

  /** `answerId === null` berarti waktu habis / klik di luar wilayah mana pun. */
  function submitAnswer(answerId: string | null, answerName: string | null = null) {
    const target = currentTarget.value
    if (phase.value !== 'playing' || !target) return

    const correct = answerId === target.id
    const points = correct ? scoreFor(streak.value) : 0

    if (correct) {
      score.value += points
      streak.value += 1
      bestStreak.value = Math.max(bestStreak.value, streak.value)
    }
    else {
      // Salah tidak mengurangi skor, hanya memutus streak.
      streak.value = 0
    }

    lastAnswerId.value = answerId
    history.value.push({
      round: currentRound.value,
      targetId: target.id,
      targetName: target.name,
      targetIso: target.iso,
      answerId,
      answerName,
      correct,
      pointsEarned: points,
    })
    feedback.value = {
      kind: correct ? 'correct' : answerId === null ? 'timeout' : 'wrong',
      targetName: target.name,
      targetIso: target.iso,
      answerName,
      points,
    }
    phase.value = 'answered'
  }

  function tick() {
    if (phase.value !== 'playing' || !timerEnabled.value) return
    secondsLeft.value -= 1
    if (secondsLeft.value <= 0) submitAnswer(null)
  }

  return {
    mode,
    datasetScope,
    provinceName,
    cityName,
    regionFilter,
    timerEnabled,
    scopeKey,
    scopeLabel,
    dailyKey,
    score,
    streak,
    bestStreak,
    currentRound,
    totalRounds,
    phase,
    pool,
    usedIds,
    currentTarget,
    choices,
    lastAnswerId,
    feedback,
    history,
    secondsLeft,
    isLastRound,
    correctCount,
    accuracy,
    nextPoints,
    startGame,
    finishGame,
    nextRound,
    submitAnswer,
    resetGame,
    tick,
  }
})
