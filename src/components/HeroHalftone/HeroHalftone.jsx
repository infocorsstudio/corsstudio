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
  if (mw < 1 || mh < 1) return null
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
  const svgRef = useRef(null)
  const thickRef = useRef(null)
  const pointRef = useRef(null)
  const markerId = useId().replace(/:/g, '')
  const [box, setBox] = useState(null)
  const [ready, setReady] = useState(false)
  // Kept outside the scroll effect so a resize rebuild does not rewind the animation.
  const tracksRef = useRef({
    color: { target: 0, current: 0 },
    word: { target: 0, current: 0 },
    thick: { target: 0, current: 0 },
    fade: { target: 0, current: 0 },
  })

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let alive = true
    let timer = 0

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
      })
    }

    const reveal = () => {
      if (!alive) return
      measure()
      setReady(true)
    }

    if (!text || document.fonts.status === 'loaded') reveal()
    else document.fonts.ready.then(reveal)

    // Rebuild once the drag settles. Measuring on every resize event blocks the page.
    const onResize = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (alive) measure()
      }, 150)
    }
    window.addEventListener('resize', onResize)
    return () => {
      alive = false
      window.clearTimeout(timer)
      window.removeEventListener('resize', onResize)
    }
  }, [text])

  // All ranges are driven by where section 2 sits in the viewport.
  // Color and thickness growth: section 2 top travels from mid-viewport to the top.
  // The word keeps stretching until section 2's bottom reaches the top of the screen.
  // The lines themselves stay put.
  // Thick lines then thin out as section 2 bottom travels from 70% to 30%.
  // The drawing fades out as section 2 bottom travels from 40% to the top.
  useEffect(() => {
    const section2 = document.querySelector('.home-section-2')
    const tracks = tracksRef.current
    let frameId = 0
    let running = false
    const step = 0.01 + 0.19 * 0.5
    const theme = themeColor()
    let lastColor = ''
    let lastThick = -1
    let lastScale = -1
    let lastOpacity = ''

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
        if (pointRef.current) {
          pointRef.current.querySelectorAll('polygon').forEach((polygon) => {
            polygon.setAttribute('fill', color)
          })
        }
        lastColor = color
      }
      if (svgRef.current) {
        const opacity = (1 - tracks.fade.current).toFixed(3)
        if (opacity !== lastOpacity) {
          svgRef.current.style.opacity = opacity
          lastOpacity = opacity
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
      tracks.fade.target = alongBottom(rect.bottom, 0.4, 0)
    }

    const tick = () => {
      let settled = true
      for (const track of Object.values(tracks)) {
        track.current += (track.target - track.current) * step
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
    <div ref={rootRef} className={ready ? 'hero-halftone is-ready' : 'hero-halftone'}>
      {box && (
        <svg
          ref={svgRef}
          className="hero-halftone-svg"
          viewBox={`0 0 ${box.w} ${box.h}`}
        >
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
      )}
    </div>
  )
}

export default HeroHalftone
