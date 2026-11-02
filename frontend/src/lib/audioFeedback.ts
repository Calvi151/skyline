/**
 * Airport Gate Audio Synthesizer
 * Produces crisp DCS gate chimes and rejection buzzers using standard Web Audio API.
 * Zero external audio file dependencies, zero latency, runs offline.
 */
class GateAudio {
  private ctx: AudioContext | null = null

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (AudioCtx) {
          this.ctx = new AudioCtx()
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {})
      }
      return this.ctx
    } catch {
      return null
    }
  }

  /**
   * Melodi Chime Berhasil (Ding DCS Hijau)
   * Dua nada tinggi harmonis lembut: C6 (1046Hz) -> G6 (1568Hz)
   */
  playSuccess() {
    try {
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(1046.5, now)
      osc.frequency.exponentialRampToValueAtTime(1567.98, now + 0.08)

      gain.gain.setValueAtTime(0.18, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.3)
    } catch {
      // AudioContext fallback
    }
  }

  /**
   * Alarm Buzzer Penolakan (Buzzer Merah DCS)
   * Suara double-buzz gelombang sawtooth tegas 160Hz tanda tiket duplikat / ditolak
   */
  playError() {
    try {
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime

      for (const offset of [0, 0.15]) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(160, now + offset)

        gain.gain.setValueAtTime(0.22, now + offset)
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(now + offset)
        osc.stop(now + offset + 0.12)
      }
    } catch {
      // AudioContext fallback
    }
  }
}

export const gateAudio = new GateAudio()

