import { useEffect, useId, useRef, useState } from 'react'
import './HeroHalftone.css'

const LINE_GAP = 12
const THIN = 0.8
const THICK_FROM = 3
const THICK_TO = 6
const WORD_SCALE_TO = 2.5
const GRAY = 229

// Parallel 45° lines covering the viewport. Built once per resize.
const buildLines = (w, h) => {
  const angle = Math.PI / 4
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const nx = -dy
  const ny = dx
  const reach = Math.hypot(w, h)
  const count = Math.ceil(reach / LINE_GAP) + 2
  const x0 = -THICK_TO
  const y0 = -THICK_TO
  const x1 = w + THICK_TO
  const y1 = h + THICK_TO
  const lines = []
  for (let i = -count; i <= count; i++) {
    const ox = w / 2 + nx * i * LINE_GAP
    const oy = h / 2 + ny * i * LINE_GAP
    const tStart = Math.max((x0 - ox) / dx, (y0 - oy) / dy, -reach)
    const tEnd = Math.min((x1 - ox) / dx, (y1 - oy) / dy, reach)
    if (tStart > tEnd) continue
    lines.push({
      x1: ox + dx * tStart,
      y1: oy + dy * tStart,
      x2: ox + dx * tEnd,
      y2: oy + dy * tEnd,
    })
  }
  return lines
}

// Same smoothing as the hero intro scroll (anime.js sync: 0.4).
const INTRO_INERTIA = 0.01 + 0.19 * 0.4

// Closed shape: three sides of a square, with the bottom side replaced by the arc.
// The left endpoint sits on the screen's bottom-left corner.
// Angle 0 is the thumbnail orientation: the arc hangs below the screen.
const SWEEP_CLEAR = 8
const buildSweepArc = (w, h) => {
  const rawStart = { x: -w * 0.2, y: h * 0.42 }
  const rawMid = { x: w * 0.5, y: h * 1.15 }
  const rawEnd = { x: w * 1.12, y: h * 0.36 }
  const shiftX = -rawStart.x
  const shiftY = h - rawStart.y
  const start = { x: 0, y: h }
  const mid = { x: rawMid.x + shiftX, y: rawMid.y + shiftY }
  const end = { x: rawEnd.x + shiftX, y: rawEnd.y + shiftY }
  const det =
    2 * (start.x * (mid.y - end.y) + mid.x * (end.y - start.y) + end.x * (start.y - mid.y))
  const cx =
    ((start.x ** 2 + start.y ** 2) * (mid.y - end.y) +
      (mid.x ** 2 + mid.y ** 2) * (end.y - start.y) +
      (end.x ** 2 + end.y ** 2) * (start.y - mid.y)) /
    det
  const cy =
    ((start.x ** 2 + start.y ** 2) * (end.x - mid.x) +
      (mid.x ** 2 + mid.y ** 2) * (start.x - end.x) +
      (end.x ** 2 + end.y ** 2) * (mid.x - start.x)) /
    det
  const r = Math.hypot(start.x - cx, start.y - cy)
  const ang = (p) => Math.atan2(p.y - cy, p.x - cx)
  const turn = (from, to) => {
    let delta = to - from
    while (delta < 0) delta += Math.PI * 2
    while (delta >= Math.PI * 2) delta -= Math.PI * 2
    return delta
  }
  const a0 = ang(start)
  const a1 = ang(end)
  const am = ang(mid)
  const clockwise = turn(a0, am) <= turn(a0, a1)
  const span = clockwise ? turn(a0, a1) : turn(a1, a0)
  const large = span > Math.PI ? 1 : 0
  const sweep = clockwise ? 1 : 0
  const chordX = end.x - start.x
  const chordY = end.y - start.y
  const side = Math.hypot(chordX, chordY)
  let upX = -chordY
  let upY = chordX
  if (upX * (mid.x - start.x) + upY * (mid.y - start.y) > 0) {
    upX = -upX
    upY = -upY
  }
  const upLen = Math.hypot(upX, upY) || 1
  upX = (upX / upLen) * side
  upY = (upY / upLen) * side
  const topLeft = { x: start.x + upX, y: start.y + upY }
  const topRight = { x: end.x + upX, y: end.y + upY }
  const samples = []
  for (let i = 0; i <= 48; i++) {
    const t = clockwise ? a0 + (span * i) / 48 : a0 - (span * i) / 48
    samples.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) })
  }
  for (let i = 1; i <= 16; i++) {
    const t = i / 16
    samples.push({
      x: end.x + (topRight.x - end.x) * t,
      y: end.y + (topRight.y - end.y) * t,
    })
    samples.push({
      x: topRight.x + (topLeft.x - topRight.x) * t,
      y: topRight.y + (topLeft.y - topRight.y) * t,
    })
    samples.push({
      x: topLeft.x + (start.x - topLeft.x) * t,
      y: topLeft.y + (start.y - topLeft.y) * t,
    })
  }
  const hits = (deg) => {
    const th = (deg * Math.PI) / 180
    const c = Math.cos(th)
    const s = Math.sin(th)
    return samples.some((p, index) => {
      if (index === 0) return false
      const rx = p.x
      const ry = p.y - h
      const x = rx * c - ry * s
      const y = rx * s + ry * c + h
      if (Math.hypot(x, y - h) < 2) return false
      return x >= 0 && x <= w && y >= 0 && y <= h
    })
  }
  // How far counterclockwise the shape must turn before it leaves the screen again.
  const firstClear = () => {
    let lo = 0
    let hi = 360
    while (hi - lo > 0.25) {
      const midDeg = (lo + hi) / 2
      if (hits(-midDeg)) lo = midDeg
      else hi = midDeg
    }
    return -(hi + SWEEP_CLEAR)
  }
  return {
    d: `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} ${sweep} ${end.x} ${end.y} L ${topRight.x} ${topRight.y} L ${topLeft.x} ${topLeft.y} Z`,
    fromDeg: 0,
    toDeg: firstClear(),
  }
}

// Raster of the unstretched CORS word. Horizontal stretch samples this
// with an inverse scale, so the letter gets wider without moving the lines.
const buildGlyphMask = (w, h, fontSize) => {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.font = `800 ${fontSize}px Inter, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.fillText('CORS', w / 2, h / 2)
  const measured = ctx.measureText('CORS')
  const ascent = measured.actualBoundingBoxAscent || fontSize * 0.8
  const descent = measured.actualBoundingBoxDescent || fontSize * 0.2
  const pad = 8
  const x = Math.max(0, Math.floor(w / 2 - measured.width / 2) - pad)
  const y = Math.max(0, Math.floor(h / 2 - ascent) - pad)
  const mw = Math.min(w - x, Math.ceil(measured.width) + pad * 2)
  const mh = Math.min(h - y, Math.ceil(ascent + descent) + pad * 2)
  return {
    pixels: ctx.getImageData(x, y, mw, mh).data,
    x,
    y,
    mw,
    mh,
    cx: w / 2,
    cy: h / 2,
  }
}

// Cut each line into the pieces that sit inside the glyph.
// scaleX widens the word around its center. Endpoints land on the outline.
const clipLinesToGlyph = (lines, mask, scaleX) => {
  const left = mask.cx + (mask.x - mask.cx) * scaleX
  const right = mask.cx + (mask.x + mask.mw - mask.cx) * scaleX
  const top = mask.y
  const bottom = mask.y + mask.mh

  const inside = (sx, sy) => {
    const gx = mask.cx + (sx - mask.cx) / scaleX
    const px = (gx - mask.x) | 0
    const py = (sy - mask.y) | 0
    if (px < 0 || py < 0 || px >= mask.mw || py >= mask.mh) return false
    return mask.pixels[(py * mask.mw + px) * 4 + 3] > 128
  }

  const overlap = (x1, y1, x2, y2) => {
    let t0 = 0
    let t1 = 1
    const dx = x2 - x1
    const dy = y2 - y1
    const p = [-dx, dx, -dy, dy]
    const q = [x1 - left, right - x1, y1 - top, bottom - y1]
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) {
        if (q[i] < 0) return null
      } else {
        const r = q[i] / p[i]
        if (p[i] < 0) {
          if (r > t1) return null
          if (r > t0) t0 = r
        } else {
          if (r < t0) return null
          if (r < t1) t1 = r
        }
      }
    }
    return t0 < t1 ? [t0, t1] : null
  }

  const boundary = (outside, insidePt) => {
    let out = outside
    let inn = insidePt
    for (let k = 0; k < 10; k++) {
      const mid = { x: (out.x + inn.x) / 2, y: (out.y + inn.y) / 2 }
      if (inside(mid.x, mid.y)) inn = mid
      else out = mid
    }
    return { x: (out.x + inn.x) / 2, y: (out.y + inn.y) / 2 }
  }

  const segments = []
  for (const line of lines) {
    const span = overlap(line.x1, line.y1, line.x2, line.y2)
    if (!span) continue
    const [t0, t1] = span
    const x1 = line.x1 + (line.x2 - line.x1) * t0
    const y1 = line.y1 + (line.y2 - line.y1) * t0
    const x2 = line.x1 + (line.x2 - line.x1) * t1
    const y2 = line.y1 + (line.y2 - line.y1) * t1
    const dx = x2 - x1
    const dy = y2 - y1
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)))
    let prev = null
    let run = null
    for (let i = 0; i <= steps; i++) {
      const p = { x: x1 + (dx * i) / steps, y: y1 + (dy * i) / steps }
      const on = inside(p.x, p.y)
      if (on && !run) {
        run = prev ? boundary(prev, p) : p
      } else if (!on && run && prev) {
        const end = boundary(p, prev)
        if (Math.hypot(end.x - run.x, end.y - run.y) >= 1) {
          segments.push({ x1: run.x, y1: run.y, x2: end.x, y2: end.y })
        }
        run = null
      }
      prev = p
    }
    if (run && prev && Math.hypot(prev.x - run.x, prev.y - run.y) >= 1) {
      segments.push({ x1: run.x, y1: run.y, x2: prev.x, y2: prev.y })
    }
  }
  return segments
}

const themeColor = () => {
  const hex =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--color-theme')
      .trim() || '#e60000'
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const HeroHalftone = ({ text = true }) => {
  const rootRef = useRef(null)
  const thinRef = useRef(null)
  const thickRef = useRef(null)
  const pointRef = useRef(null)
  const maskRef = useRef(null)
  const spinRef = useRef(null)
  const markerId = useId().replace(/:/g, '')
  const [box, setBox] = useState(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let alive = true

    const measure = () => {
      const w = root.clientWidth
      const h = root.clientHeight
      if (!w || !h) return
      const fontSize = Math.min(w * 0.22, h * 0.62)
      const lines = buildLines(w, h)
      const glyph = text ? buildGlyphMask(w, h, fontSize) : null
      setBox({
        w,
        h,
        fontSize,
        lines,
        glyph,
        thickLines: glyph ? clipLinesToGlyph(lines, glyph, 1) : lines,
        sweep: buildSweepArc(w, h),
      })
    }

    const reveal = () => {
      if (!alive) return
      measure()
      requestAnimationFrame(() => {
        if (alive) root.classList.add('is-ready')
      })
    }

    if (!text || document.fonts.status === 'loaded') reveal()
    else document.fonts.ready.then(reveal)

    window.addEventListener('resize', measure)
    return () => {
      alive = false
      window.removeEventListener('resize', measure)
    }
  }, [text])

  // All ranges are driven by where section 2 sits in the viewport.
  // Color and thickness growth: section 2 top travels from mid-viewport to the top.
  // The word keeps stretching until section 2's bottom reaches the top of the screen.
  // The lines themselves stay put.
  // Thick lines then thin out as section 2 bottom travels from 70% to 30%.
  // The closed shape clips both line layers: only the part inside it shows.
  // Its left endpoint stays on the bottom-left corner. It starts at the
  // thumbnail's angle, then rotates counterclockwise while section 2's bottom
  // travels from 55% to 5%.
  useEffect(() => {
    const section2 = document.querySelector('.home-section-2')
    const tracks = {
      color: { target: 0, current: 0 },
      word: { target: 0, current: 0 },
      thick: { target: 0, current: 0 },
      retract: { target: 0, current: 0 },
    }
    let frameId = 0
    let running = false
    const step = 0.01 + 0.19 * 0.5
    const theme = themeColor()
    let lastColor = ''
    let lastThick = -1
    let lastScale = -1
    let lastDeg = null

    const paintWord = (scaleX) => {
      const g = thickRef.current
      if (!g || !box?.glyph) return
      const segments = clipLinesToGlyph(box.lines, box.glyph, scaleX)
      const start = `url(#${markerId}-start)`
      const end = `url(#${markerId}-end)`
      while (g.children.length > segments.length) g.removeChild(g.lastChild)
      for (let i = 0; i < segments.length; i++) {
        let node = g.children[i]
        if (!node) {
          node = document.createElementNS('http://www.w3.org/2000/svg', 'line')
          node.setAttribute('marker-start', start)
          node.setAttribute('marker-end', end)
          g.appendChild(node)
        }
        const s = segments[i]
        node.setAttribute('x1', s.x1)
        node.setAttribute('y1', s.y1)
        node.setAttribute('x2', s.x2)
        node.setAttribute('y2', s.y2)
      }
    }

    const alongBottom = (bottom, startRatio, endRatio) => {
      const start = window.innerHeight * startRatio
      const end = window.innerHeight * endRatio
      return Math.min(Math.max((start - bottom) / (start - end), 0), 1)
    }

    const apply = () => {
      const colorU = tracks.color.current
      const grown = THICK_FROM + (THICK_TO - THICK_FROM) * colorU
      const thick = grown + (THIN - grown) * tracks.thick.current
      const r = GRAY + (theme[0] - GRAY) * colorU
      const g = GRAY + (theme[1] - GRAY) * colorU
      const b = GRAY + (theme[2] - GRAY) * colorU
      const color = `rgb(${r | 0},${g | 0},${b | 0})`
      if (box?.glyph) {
        const scaleX = 1 + (WORD_SCALE_TO - 1) * tracks.word.current
        if (Math.abs(scaleX - lastScale) > 0.008) {
          paintWord(scaleX)
          lastScale = scaleX
        }
      }
      if (thickRef.current && (color !== lastColor || Math.abs(thick - lastThick) > 0.02)) {
        thickRef.current.setAttribute('stroke-width', thick.toFixed(2))
        thickRef.current.setAttribute('stroke', color)
        lastThick = thick
      }
      if (color !== lastColor) {
        if (thinRef.current) thinRef.current.setAttribute('stroke', color)
        if (pointRef.current) {
          pointRef.current.querySelectorAll('polygon').forEach((polygon) => {
            polygon.setAttribute('fill', color)
          })
        }
        lastColor = color
      }
      if (maskRef.current && spinRef.current && box) {
        const { fromDeg, toDeg } = box.sweep
        const deg = fromDeg + (toDeg - fromDeg) * tracks.retract.current
        if (lastDeg === null || Math.abs(deg - lastDeg) > 0.05) {
          maskRef.current.style.transform = `rotate(${deg}deg)`
          spinRef.current.style.transform = `rotate(${-deg}deg)`
          lastDeg = deg
        }
      }
    }

    const updateTarget = () => {
      if (!section2) return
      const rect = section2.getBoundingClientRect()
      const colorStart = window.innerHeight * 0.5
      tracks.color.target = Math.min(Math.max((colorStart - rect.top) / colorStart, 0), 1)
      const wordEnd = -rect.height
      tracks.word.target = Math.min(
        Math.max((colorStart - rect.top) / (colorStart - wordEnd), 0),
        1
      )
      tracks.thick.target = alongBottom(rect.bottom, 0.7, 0.3)
      tracks.retract.target = alongBottom(rect.bottom, 0.55, 0.05)
    }

    const tick = () => {
      let settled = true
      for (const [name, track] of Object.entries(tracks)) {
        const blend = name === 'retract' ? INTRO_INERTIA : step
        track.current += (track.target - track.current) * blend
        if (Math.abs(track.target - track.current) < 0.0005) track.current = track.target
        else settled = false
      }
      if (settled) running = false
      apply()
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
  }, [box])

  return (
    <div ref={rootRef} className="hero-halftone">
      {box && (
        <>
        <div
          ref={maskRef}
          className="hero-halftone-mask"
          style={{ clipPath: `path('${box.sweep.d}')` }}
        >
          <div ref={spinRef} className="hero-halftone-spin">
            <svg className="hero-halftone-svg" viewBox={`0 0 ${box.w} ${box.h}`}>
              <g
                ref={thinRef}
                className="hero-halftone-thin"
                fill="none"
                stroke={`rgb(${GRAY},${GRAY},${GRAY})`}
                strokeWidth={THIN}
              >
                {box.lines.map((line, i) => (
                  <line key={i} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
                ))}
              </g>
            </svg>
            <svg className="hero-halftone-svg" viewBox={`0 0 ${box.w} ${box.h}`}>
          <defs ref={pointRef}>
            <marker
              id={`${markerId}-end`}
              markerUnits="strokeWidth"
              orient="auto"
              viewBox="0 0 4 1"
              refX="0"
              refY="0.5"
              markerWidth="4"
              markerHeight="1"
            >
              <polygon points="0,0 4,0.5 0,1" fill={`rgb(${GRAY},${GRAY},${GRAY})`} />
            </marker>
            <marker
              id={`${markerId}-start`}
              markerUnits="strokeWidth"
              orient="auto"
              viewBox="-4 0 4 1"
              refX="0"
              refY="0.5"
              markerWidth="4"
              markerHeight="1"
            >
              <polygon points="0,0 -4,0.5 0,1" fill={`rgb(${GRAY},${GRAY},${GRAY})`} />
            </marker>
          </defs>
          <g
            ref={thickRef}
            className="hero-halftone-thick"
            fill="none"
            stroke={`rgb(${GRAY},${GRAY},${GRAY})`}
            strokeWidth={THICK_FROM}
            strokeLinecap="butt"
          >
            {box.thickLines.map((line, i) => (
              <line
                key={i}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                markerStart={`url(#${markerId}-start)`}
                markerEnd={`url(#${markerId}-end)`}
              />
            ))}
          </g>
            </svg>
          </div>
        </div>
        </>
      )}
    </div>
  )
}

export default HeroHalftone
