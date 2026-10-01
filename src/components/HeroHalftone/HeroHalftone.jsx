import { useEffect, useRef } from 'react'
import { record } from '../../debug/perfLog'
import './HeroHalftone.css'

const LINE_GAP = 12
const THIN = 0.8
const THICK = 5
const BLUR = 10

const HeroHalftone = () => {
  const canvasRef = useRef(null)

  // Fade out over the same scroll range as the particle scatter:
  // section 2 top travels from mid-viewport to the top of the screen.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const section2 = document.querySelector('.home-section-2')
    const target = { value: 0 }
    const current = { value: 0 }
    let frameId = 0
    let running = false
    const step = 0.01 + 0.19 * 0.5

    const updateTarget = () => {
      if (!section2) return
      const top = section2.getBoundingClientRect().top
      const start = window.innerHeight * 0.5
      target.value = Math.min(Math.max((start - top) / start, 0), 1)
    }

    const tick = () => {
      current.value += (target.value - current.value) * step
      if (Math.abs(target.value - current.value) < 0.0005) {
        current.value = target.value
        running = false
      }
      canvas.style.opacity = current.value > 0 ? String(1 - current.value) : ''
      if (running) frameId = requestAnimationFrame(tick)
    }

    const kick = () => {
      updateTarget()
      if (!running) {
        running = true
        tick()
      }
    }

    kick()
    window.addEventListener('scroll', kick, { passive: true })
    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('scroll', kick)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let alive = true
    let revealed = false

    const draw = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!w || !h) return false
      const t0 = performance.now()

      const bw = Math.round(w)
      const bh = Math.round(h)
      canvas.width = bw
      canvas.height = bh

      const fontSize = Math.min(w * 0.22, h * 0.62)
      const pad = Math.ceil(BLUR * 4)
      const maskW = Math.min(bw, Math.ceil(fontSize * 4.4) + pad * 2)
      const maskH = Math.min(bh, Math.ceil(fontSize * 1.4) + pad * 2)
      const maskX = (bw - maskW) / 2
      const maskY = (bh - maskH) / 2

      const mask = document.createElement('canvas')
      mask.width = maskW
      mask.height = maskH
      const mctx = mask.getContext('2d')
      mctx.fillStyle = '#000'
      mctx.textAlign = 'center'
      mctx.textBaseline = 'middle'
      mctx.font = `800 ${fontSize}px Inter, sans-serif`
      mctx.fillText('CORS', maskW / 2, maskH / 2)

      const blurred = document.createElement('canvas')
      blurred.width = maskW
      blurred.height = maskH
      const bctx = blurred.getContext('2d', { willReadFrequently: true })
      bctx.filter = `blur(${BLUR}px)`
      bctx.drawImage(mask, 0, 0)
      const maskPx = bctx.getImageData(0, 0, maskW, maskH).data
      const sample = (x, y) => {
        const px = Math.round(x - maskX)
        const py = Math.round(y - maskY)
        if (px < 0 || py < 0 || px >= maskW || py >= maskH) return 0
        return maskPx[(py * maskW + px) * 4 + 3] / 255
      }

      const img = new ImageData(bw, bh)
      const data = img.data
      const angle = Math.PI / 4
      const dx = Math.cos(angle)
      const dy = Math.sin(angle)
      const nx = -dy
      const ny = dx
      const reach = Math.hypot(bw, bh)
      const count = Math.ceil(reach / LINE_GAP) + 2

      const x0 = -THICK
      const y0 = -THICK
      const x1 = bw + THICK
      const y1 = bh + THICK
      for (let i = -count; i <= count; i++) {
        const ox = bw / 2 + nx * i * LINE_GAP
        const oy = bh / 2 + ny * i * LINE_GAP
        const t0 = Math.max((x0 - ox) / dx, (y0 - oy) / dy, -reach)
        const t1 = Math.min((x1 - ox) / dx, (y1 - oy) / dy, reach)
        if (t0 > t1) continue
        for (let t = Math.floor(t0); t <= t1; t += 1) {
          const x = ox + dx * t
          const y = oy + dy * t
          const half = (THIN + (THICK - THIN) * sample(x, y)) * 0.5
          const sMax = Math.ceil(half + 1)
          for (let s = -sMax; s <= sMax; s++) {
            const px = Math.round(x + nx * s)
            const py = Math.round(y + ny * s)
            if (px < 0 || py < 0 || px >= bw || py >= bh) continue
            const dist = Math.abs((px + 0.5 - x) * nx + (py + 0.5 - y) * ny)
            const cover = half + 0.5 - dist
            if (cover <= 0) continue
            const o = (py * bw + px) * 4
            const a = cover >= 1 ? 255 : (cover * 255) | 0
            if (data[o + 3] >= a) continue
            data[o] = 229
            data[o + 1] = 229
            data[o + 2] = 229
            data[o + 3] = a
          }
        }
      }

      canvas.getContext('2d').putImageData(img, 0, 0)
      record('halftone', performance.now() - t0)
      return true
    }

    const reveal = () => {
      if (!alive || revealed) return
      if (!draw()) return
      revealed = true
      requestAnimationFrame(() => {
        if (alive) canvas.parentElement.classList.add('is-ready')
      })
    }

    if (document.fonts.status === 'loaded') reveal()
    else document.fonts.ready.then(reveal)

    const onResize = () => {
      if (revealed) draw()
      else reveal()
    }
    window.addEventListener('resize', onResize)
    return () => {
      alive = false
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <div className="hero-halftone">
      <canvas ref={canvasRef} />
    </div>
  )
}

export default HeroHalftone
