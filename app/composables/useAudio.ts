/**
 * Lightweight Web Audio API synthesizer for delightful game sound effects.
 * 100% self-contained, offline-ready, zero latency, and zero external assets.
 */
export function useAudio() {
  const soundEnabled = useState<boolean>('geo-sound-enabled', () => {
    if (import.meta.client) {
      const saved = localStorage.getItem('geoguess_sound')
      return saved !== null ? saved === 'true' : true
    }
    return true
  })

  function toggleSound() {
    soundEnabled.value = !soundEnabled.value
    if (import.meta.client) {
      localStorage.setItem('geoguess_sound', String(soundEnabled.value))
    }
  }

  let audioCtx: AudioContext | null = null

  function getContext(): AudioContext | null {
    if (!import.meta.client || !soundEnabled.value) return null
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!audioCtx || audioCtx.state === 'closed') {
        audioCtx = new AudioContextClass()
      }
      if (audioCtx.state === 'suspended') {
        void audioCtx.resume()
      }
      return audioCtx
    }
    catch {
      return null
    }
  }

  /** Pleasant ascending chime for correct answers */
  function playCorrect() {
    const ctx = getContext()
    if (!ctx) return
    const now = ctx.currentTime

    // Notes: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz)
    const notes = [523.25, 659.25, 783.99]
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + index * 0.08)

      gain.gain.setValueAtTime(0, now + index * 0.08)
      gain.gain.linearRampToValueAtTime(0.18, now + index * 0.08 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.3)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + index * 0.08)
      osc.stop(now + index * 0.08 + 0.32)
    })
  }

  /** Soft low buzz for incorrect answers */
  function playWrong() {
    const ctx = getContext()
    if (!ctx) return
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(180, now)
    osc.frequency.linearRampToValueAtTime(110, now + 0.25)

    gain.gain.setValueAtTime(0.16, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.26)
  }

  /** Subtle tick for countdown urgency */
  function playTick() {
    const ctx = getContext()
    if (!ctx) return
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, now)

    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.06)
  }

  /** Soft UI click sound */
  function playClick() {
    const ctx = getContext()
    if (!ctx) return
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, now)

    gain.gain.setValueAtTime(0.05, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.05)
  }

  /** Celebratory arpeggio for victory/results */
  function playFanfare() {
    const ctx = getContext()
    if (!ctx) return
    const now = ctx.currentTime

    // G4, C5, E5, G5, C6
    const freqs = [392.0, 523.25, 659.25, 783.99, 1046.5]
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + idx * 0.1)

      const duration = idx === freqs.length - 1 ? 0.6 : 0.22
      gain.gain.setValueAtTime(0, now + idx * 0.1)
      gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.1 + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + duration)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + idx * 0.1)
      osc.stop(now + idx * 0.1 + duration + 0.05)
    })
  }

  return {
    soundEnabled,
    toggleSound,
    playCorrect,
    playWrong,
    playTick,
    playClick,
    playFanfare,
  }
}
