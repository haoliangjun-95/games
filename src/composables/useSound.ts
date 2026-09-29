/**
 * Web Audio 合成音效：无需任何音频素材，完全离线可用。
 */
let ctx: AudioContext | null = null
let muted = localStorage.getItem('pg.sound.muted') === '1'

function getCtx(): AudioContext | null {
  if (muted) return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

interface ToneOptions {
  freq: number
  /** 时长（秒） */
  duration?: number
  type?: OscillatorType
  volume?: number
  /** 延迟（秒） */
  delay?: number
  /** 频率滑向 */
  slideTo?: number
}

function tone({ freq, duration = 0.12, type = 'sine', volume = 0.18, delay = 0, slideTo }: ToneOptions) {
  const ac = getCtx()
  if (!ac) return
  const t0 = ac.currentTime + delay
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + duration)
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
  osc.connect(gain).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.05)
}

export const sounds = {
  click() {
    tone({ freq: 660, duration: 0.06, type: 'triangle', volume: 0.12 })
  },
  /** 落子（棋类） */
  move() {
    tone({ freq: 420, duration: 0.1, type: 'triangle', volume: 0.22, slideTo: 300 })
  },
  /** 吃子 */
  capture() {
    tone({ freq: 300, duration: 0.14, type: 'square', volume: 0.14, slideTo: 180 })
  },
  error() {
    tone({ freq: 180, duration: 0.16, type: 'sawtooth', volume: 0.1 })
  },
  win() {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => tone({ freq: f, duration: 0.16, type: 'triangle', volume: 0.16, delay: i * 0.12 }))
  },
  lose() {
    const notes = [440, 349.23, 261.63]
    notes.forEach((f, i) => tone({ freq: f, duration: 0.2, type: 'sine', volume: 0.16, delay: i * 0.15 }))
  },
}

export function isMuted(): boolean {
  return muted
}

export function toggleMute(): boolean {
  muted = !muted
  localStorage.setItem('pg.sound.muted', muted ? '1' : '0')
  return muted
}
