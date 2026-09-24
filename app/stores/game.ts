import { defineStore } from 'pinia'
import type { PersistedSetup } from '~/composables/useGameSetup'
import type { ScopeParts } from '~/composables/useScopeLabel'
import { newSeed } from '~/utils/challenge'
import type { ChainGuess, Difficulty, Feedback, GameMode, RegionItem, RoundResult, DatasetScope } from '~/types/game'
import { recordSession } from '~/utils/stats'
import { rng, saveDailyResult, seedFrom } from '~/utils/daily'
import { masteryWeights, recordMastery } from '~/utils/mastery'
import { nearMissPoints } from '~/utils/distance'
import { applyHintPenalty, hintBudget, hintKindFor, spotlightFor } from '~/utils/hints'
import { scopeProfile } from '~/utils/scopeProfile'

export const TOTAL_ROUNDS = 10
export const ROUND_SECONDS = 15
/**
 * Hardcore memotong waktu jadi setengahnya dan timernya tidak bisa dimatikan —
 * tanpa tetangga dan tanpa zoom, satu-satunya cara masih menang adalah hafal
 * bentuknya, dan itu tidak butuh 15 detik.
 */
export const HARDCORE_SECONDS = 7
const BASE_POINTS = 10
const STREAK_BONUS = 2
/**
 * Pengali skor hardcore. Rekornya dipisah per cakupan, bukan per kesulitan,
 * jadi tanpa pengali sesi hardcore selalu kalah dari sesi normal di papan yang
 * sama — orang jadi tidak punya alasan memilihnya.
 */
const HARDCORE_MULTIPLIER = 1.5
const CHOICE_COUNT = 4

/** `poin = 10 + (streak * 2)`, ×1,5 di hardcore — streak dihitung sebelum jawaban ini. */
export function scoreFor(streak: number, difficulty: Difficulty = 'normal'): number {
  const base = BASE_POINTS + streak * STREAK_BONUS
  return difficulty === 'hardcore' ? Math.round(base * HARDCORE_MULTIPLIER) : base
}

/** Panjang satu ronde; hardcore memakai batas waktunya sendiri. */
export function secondsFor(difficulty: Difficulty): number {
  return difficulty === 'hardcore' ? HARDCORE_SECONDS : ROUND_SECONDS
}

function shuffle<T>(arr: T[], random: () => number = Math.random): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
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
  difficulty?: Difficulty
  provinceName?: string
  cityName?: string
  stateName?: string
  /** Kunci papan rekor; satu per cakupan soal. */
  scopeKey?: string
  /**
   * Penyusun label cakupan, bukan teks jadinya: layar hasil merakit sendiri
   * labelnya, jadi pengalih bahasa tetap benar di tengah sesi.
   */
  scopeParts?: ScopeParts
  /** Kunci tanggal kalau sesi ini berasal dari tantangan harian. */
  daily?: string
  /**
   * Seed opsi pilihan ganda & coretan 50:50. Tanpa ini sesi dapat seed baru;
   * dua sesi dengan seed dan urutan target yang sama mendapat opsi yang sama.
   */
  seed?: string
  /** Urutan target yang dipaksakan — dipakai tautan tantangan. */
  targetIds?: string[]
  /** Skor si penantang, kalau sesinya datang dari tautan tantangan. */
  challengerScore?: number
  /** Konfigurasi menu sesi ini, untuk dikemas ke tautan tantangan. */
  shareSetup?: PersistedSetup
}

export const useGameStore = defineStore('game', () => {
  const mode = ref<GameMode>('A')
  const datasetScope = ref<DatasetScope>('world')
  const provinceName = ref<string>('')
  const cityName = ref<string>('')
  const stateName = ref<string>('')
  const regionFilter = ref('all')
  const difficulty = ref<Difficulty>('normal')
  const timerEnabled = ref(false)
  const preferredRounds = ref(TOTAL_ROUNDS)
  const scopeKey = ref('world')
  const scopeParts = ref<ScopeParts | null>(null)
  const dailyKey = ref('')
  const seed = ref('')
  const challengerScore = ref<number | null>(null)
  const shareSetup = ref<PersistedSetup | null>(null)
  /** Target tautan tantangan, urut per ronde. Kosong di sesi biasa. */
  const forcedTargets = ref<string[]>([])
  /** Wilayah yang baru dikuasai di sesi yang barusan selesai. */
  const newlyMastered = ref(0)
  /**
   * Sumber acak opsi & coretan. Diturunkan ulang per ronde dari seed sesi:
   * kalau satu aliran dipakai sepanjang sesi, pemain yang memakai 50:50 di
   * ronde 2 menggeser semua opsi sesudahnya dan tantangannya tidak lagi sama.
   */
  let random: () => number = Math.random
  /** Bobot undian dari riwayat penguasaan; kosong di sesi tantangan. */
  let weights = new Map<string, number>()

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
  /** Tebakan mode rantai jarak, urut dari tebakan pertama. */
  const chainGuesses = ref<ChainGuess[]>([])
  const secondsLeft = ref(ROUND_SECONDS)

  /** Sisa jatah petunjuk sesi ini. */
  const hintsLeft = ref(0)
  /** Petunjuk sudah dipakai di ronde berjalan — poinnya dipotong separuh. */
  const hintUsedThisRound = ref(false)
  /**
   * Opsi yang dicoret 50:50 di Mode B. Disimpan di store, bukan di komponen
   * bilah soal: bilah itu dibongkar-pasang oleh `<Transition>` tiap kali
   * jawaban masuk, jadi state di dalamnya tidak bertahan sampai ronde usai.
   */
  const eliminatedIds = ref<string[]>([])
  /**
   * Mode A: wilayah yang tetap menyala setelah petunjuk dipakai. Kosong
   * berarti petunjuk belum dipakai dan seluruh peta tampil normal.
   */
  const spotlightIds = ref<string[]>([])
  /** Region target, kalau petunjuknya kebetulan menyempitkan lewat region. */
  const revealedRegion = ref<string | null>(null)

  const isLastRound = computed(() => currentRound.value >= totalRounds.value)
  const correctCount = computed(() => history.value.filter(h => h.correct).length)
  const accuracy = computed(() =>
    history.value.length
      ? Math.round((correctCount.value / history.value.length) * 100)
      : 0,
  )
  /** Banyak tebakan yang sudah dipakai di mode rantai jarak. */
  const chainGuessCount = computed(() => chainGuesses.value.length)
  const isHardcore = computed(() => difficulty.value === 'hardcore')
  /** Panjang ronde yang berlaku di sesi ini. */
  const roundSeconds = computed(() => secondsFor(difficulty.value))
  /** Poin kalau ronde ini dijawab benar — sudah termasuk potongan petunjuk. */
  const nextPoints = computed(() => {
    const base = scoreFor(streak.value, difficulty.value)
    return hintUsedThisRound.value ? applyHintPenalty(base) : base
  })

  /** Jenis petunjuk yang berlaku di mode ini. */
  const hintKind = computed(() => hintKindFor(mode.value))
  /** Petunjuk bisa dipakai sekarang? Satu per ronde, selama jatah ada. */
  const canUseHint = computed(() =>
    phase.value === 'playing'
    && hintsLeft.value > 0
    && !hintUsedThisRound.value
    && Boolean(currentTarget.value),
  )

  /**
   * Wilayah yang dijawab salah, tanpa duplikat. Ini yang diulang oleh sesi
   * latihan di layar hasil — ronde yang sudah kena tidak perlu diulang.
   */
  const missedItems = computed<RegionItem[]>(() => {
    const byId = new Map<string, RegionItem>()
    for (const row of history.value) {
      if (row.correct || byId.has(row.targetId)) continue
      const item = pool.value.find(p => p.id === row.targetId)
      if (item) byId.set(row.targetId, item)
    }
    return [...byId.values()]
  })

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
    stateName.value = ''
    secondsLeft.value = roundSeconds.value
    hintUsedThisRound.value = false
    eliminatedIds.value = []
    revealedRegion.value = null
    spotlightIds.value = []
    chainGuesses.value = []
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
    if (forcedTargets.value.length) {
      const id = forcedTargets.value[currentRound.value]
      return pool.value.find(i => i.id === id) ?? null
    }
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

    return weightedPick(remaining)
  }

  /**
   * Undi satu item. Tanpa bobot (sesi ber-seed, atau belum ada riwayat)
   * semua item berpeluang sama; dengan bobot, wilayah yang sering salah
   * lebih sering keluar — itu yang membuat latihan terasa terarah.
   */
  function weightedPick(items: RegionItem[]): RegionItem | null {
    if (!items.length) return null
    if (!weights.size) return items[Math.floor(Math.random() * items.length)] ?? null
    const total = items.reduce((sum, i) => sum + (weights.get(i.id) ?? 1), 0)
    let roll = Math.random() * total
    for (const item of items) {
      roll -= weights.get(item.id) ?? 1
      if (roll < 0) return item
    }
    return items[items.length - 1] ?? null
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

    const sameRegion = shuffle(others.filter(i => i.region === target.region), random)
    const rest = shuffle(others.filter(i => i.region !== target.region), random)
    const distractors = [...sameRegion, ...rest].slice(0, CHOICE_COUNT - 1)
    return shuffle([target, ...distractors], random)
  }

  function finishGame() {
    // Sesi tanpa ronde selesai (mis. pool kosong) tidak dicatat — kalau ikut
    // masuk, jumlah "total sesi" naik tanpa pemain pernah menjawab apa pun.
    const alreadyFinished = phase.value === 'finished'
    phase.value = 'finished'
    if (alreadyFinished || !history.value.length) return

    newlyMastered.value = recordMastery(datasetScope.value, history.value)

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
    // Kesulitan disetel sebelum `resetGame`, karena reset mengisi sisa waktu
    // dari `roundSeconds` — yang panjangnya ditentukan kesulitan.
    difficulty.value = options.difficulty ?? 'normal'
    resetGame()
    mode.value = options.mode
    datasetScope.value = options.scope ?? 'world'
    provinceName.value = options.provinceName ?? ''
    cityName.value = options.cityName ?? ''
    stateName.value = options.stateName ?? ''
    regionFilter.value = options.regionFilter ?? 'all'
    // Hardcore selalu berwaktu; togglenya di menu dikunci saat mode ini aktif.
    timerEnabled.value = isHardcore.value ? true : (options.timerEnabled ?? false)
    preferredRounds.value = options.roundsCount ?? TOTAL_ROUNDS
    scopeKey.value = options.scopeKey ?? options.scope ?? 'world'
    scopeParts.value = options.scopeParts ?? null
    dailyKey.value = options.daily ?? ''
    seed.value = options.seed || newSeed()
    challengerScore.value = options.challengerScore ?? null
    shareSetup.value = options.shareSetup ?? null
    newlyMastered.value = 0
    forcedTargets.value = options.targetIds?.filter(id => options.pool.some(i => i.id === id)) ?? []
    // Target tantangan sudah ditentukan si pengirim; riwayat pribadi tidak
    // boleh ikut membelokkan undiannya.
    weights = forcedTargets.value.length ? new Map() : masteryWeights(datasetScope.value, options.pool)
    pool.value = options.pool
    totalRounds.value = forcedTargets.value.length || Math.min(preferredRounds.value, options.pool.length)
    // Jatah dihitung dari panjang sesi yang benar-benar berlaku, bukan dari
    // `preferredRounds` — sesi 20 ronde di pool 6 wilayah cuma jalan 6 ronde.
    hintsLeft.value = hintBudget(totalRounds.value, difficulty.value)
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
    random = rng(seedFrom(`${seed.value}:${currentRound.value}`))
    currentTarget.value = target
    choices.value = mode.value === 'B' ? buildChoices(target) : []
    lastAnswerId.value = null
    feedback.value = null
    secondsLeft.value = roundSeconds.value
    hintUsedThisRound.value = false
    eliminatedIds.value = []
    revealedRegion.value = null
    spotlightIds.value = []
    phase.value = 'playing'
  }

  /**
   * Pakai satu petunjuk di ronde berjalan.
   *
   * Mode B mencoret dua opsi salah; Mode A mengungkap region targetnya, yang
   * dipakai peta untuk meredupkan wilayah di luar region itu. Jatahnya
   * berkurang saat dipakai, dan poin ronde ini otomatis separuh lewat
   * `nextPoints`.
   */
  function useHint() {
    const target = currentTarget.value
    if (!canUseHint.value || !target) return

    if (hintKind.value === 'fifty') {
      const wrong = choices.value.filter(c => c.id !== target.id)
      // Undi mana yang dicoret, jangan ambil dua yang pertama: urutan opsi
      // tetap selama ronde, jadi pilihan yang tidak diacak membuat posisi
      // jawaban benar bisa ditebak dari pola coretannya.
      // Aliran sendiri, supaya memakai petunjuk tidak menggeser undian lain.
      const hintRandom = rng(seedFrom(`${seed.value}:${currentRound.value}:hint`))
      eliminatedIds.value = shuffle(wrong, hintRandom).slice(0, 2).map(c => c.id)
    }
    else {
      const ids = spotlightFor(target, pool.value)
      spotlightIds.value = ids
      // Region hanya diumumkan di bilah soal kalau penyempitannya memang
      // lewat region — kalau yang dipakai pemangkasan separuh, menyebut
      // regionnya akan menjanjikan penyaringan yang tidak terjadi.
      const narrowedByRegion = ids.every(
        id => pool.value.find(i => i.id === id)?.region === target.region,
      )
      revealedRegion.value = narrowedByRegion ? target.region : null
    }

    hintUsedThisRound.value = true
    hintsLeft.value -= 1
  }

  /**
   * `answerId === null` berarti waktu habis / klik di luar wilayah mana pun.
   *
   * `distanceKm` diukur oleh peta (Mode A) antara pusat wilayah yang diklik
   * dan pusat target. Tebakan yang meleset tapi masih dalam radius cakupan
   * dibayar sebagian — mengklik provinsi sebelah bukan hal yang sama dengan
   * mengklik benua yang salah.
   */
  function submitAnswer(
    answerId: string | null,
    answerName: string | null = null,
    distanceKm?: number,
  ) {
    const target = currentTarget.value
    if (phase.value !== 'playing' || !target) return

    const correct = answerId === target.id
    const fullPoints = scoreFor(streak.value, difficulty.value)

    // Poin nyaris-kena dihitung dari poin penuh sebelum potongan petunjuk,
    // lalu potongannya dikenakan sekali di akhir — kalau dipotong dua kali,
    // tebakan dekat berbantuan petunjuk membayar seperempat dan praktis nol.
    const nearPoints = (!correct && answerId !== null && distanceKm !== undefined)
      ? nearMissPoints(fullPoints, distanceKm, scopeProfile(datasetScope.value).nearMissKm)
      : 0

    const rawPoints = correct ? fullPoints : nearPoints
    const points = hintUsedThisRound.value ? applyHintPenalty(rawPoints) : rawPoints

    score.value += points
    if (correct) {
      streak.value += 1
      bestStreak.value = Math.max(bestStreak.value, streak.value)
    }
    else {
      // Nyaris-kena tetap memutus streak: yang dibayar adalah kedekatannya,
      // bukan kebenarannya, dan streak mengukur yang kedua.
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
      distanceKm,
      usedHint: hintUsedThisRound.value,
      level: target.level,
    })
    feedback.value = {
      kind: correct
        ? 'correct'
        : answerId === null
          ? 'timeout'
          : nearPoints > 0 ? 'near' : 'wrong',
      targetName: target.name,
      targetIso: target.iso,
      answerName,
      points,
      distanceKm,
    }
    phase.value = 'answered'
  }

  function tick() {
    if (phase.value !== 'playing' || !timerEnabled.value) return
    secondsLeft.value -= 1
    if (secondsLeft.value <= 0) submitAnswer(null)
  }

  /**
   * Sesi latihan: ulangi hanya wilayah yang tadi salah.
   *
   * Seluruh konfigurasi sesi sebelumnya dipakai ulang kecuali pool dan jumlah
   * rondenya. Yang sengaja dijatuhkan adalah `daily`: hasil harian hanya
   * boleh dicatat sekali per hari, dan sesi ini memainkan subset soal yang
   * lebih mudah, jadi skornya tidak sebanding dengan sesi harian utuh.
   */
  function startDrill(): boolean {
    const missed = missedItems.value
    if (!missed.length) return false

    startGame({
      mode: mode.value,
      pool: missed,
      regionFilter: regionFilter.value,
      timerEnabled: timerEnabled.value,
      roundsCount: missed.length,
      scope: datasetScope.value,
      difficulty: difficulty.value,
      provinceName: provinceName.value,
      cityName: cityName.value,
      stateName: stateName.value,
      scopeKey: scopeKey.value,
      scopeParts: scopeParts.value ?? undefined,
      shareSetup: shareSetup.value ?? undefined,
    })
    return true
  }

  /**
   * Mulai sesi rantai jarak: satu target rahasia, tebak berulang sampai kena.
   * Tidak ada ronde, timer, petunjuk, atau kesulitan — seluruh sesinya cuma
   * "tebak → jarak → tebak lagi".
   */
  function startChain(options: {
    scope: DatasetScope
    pool: RegionItem[]
    scopeKey?: string
    scopeParts?: ScopeParts
  }) {
    difficulty.value = 'normal'
    resetGame()
    mode.value = 'C'
    datasetScope.value = options.scope
    pool.value = options.pool
    scopeKey.value = options.scopeKey ?? options.scope
    scopeParts.value = options.scopeParts ?? null
    timerEnabled.value = false
    hintsLeft.value = 0
    currentTarget.value = pool.value[Math.floor(Math.random() * pool.value.length)] ?? null
    if (currentTarget.value) phase.value = 'playing'
  }

  /** Catat satu tebakan rantai jarak; tebakan yang kena menandai sesi selesai. */
  function submitChainGuess(item: RegionItem, distanceKm?: number) {
    const target = currentTarget.value
    if (phase.value !== 'playing' || !target) return
    chainGuesses.value.push({ item, distanceKm: distanceKm ?? 0 })
    if (item.id === target.id) phase.value = 'finished'
  }

  /** Mulai ulang dengan target acak baru dari pool yang sama. */
  function restartChain() {
    if (!pool.value.length) return
    chainGuesses.value = []
    currentTarget.value = pool.value[Math.floor(Math.random() * pool.value.length)] ?? null
    if (currentTarget.value) phase.value = 'playing'
  }

  return {
    mode,
    datasetScope,
    provinceName,
    cityName,
    stateName,
    regionFilter,
    difficulty,
    isHardcore,
    roundSeconds,
    timerEnabled,
    scopeKey,
    scopeParts,
    dailyKey,
    seed,
    challengerScore,
    shareSetup,
    newlyMastered,
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
    chainGuesses,
    secondsLeft,
    isLastRound,
    correctCount,
    accuracy,
    chainGuessCount,
    nextPoints,
    hintsLeft,
    hintUsedThisRound,
    hintKind,
    canUseHint,
    eliminatedIds,
    spotlightIds,
    revealedRegion,
    missedItems,
    startGame,
    finishGame,
    nextRound,
    submitAnswer,
    useHint,
    startDrill,
    startChain,
    submitChainGuess,
    restartChain,
    resetGame,
    tick,
  }
})
