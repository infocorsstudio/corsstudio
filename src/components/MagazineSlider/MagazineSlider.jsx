import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { animate, createDraggable } from 'animejs'
import './MagazineSlider.css'

// How far the handle may travel past either end of the track, in px.
const OVERSHOOT = 14
// How far each crescent shifts outward on hover, in px.
const CRESCENT_GAP = 6
// SVG width while hovering or dragging. The resting width is --handle-w in the CSS.
const HOVER_HANDLE_REM = 4.5
// Same timing as the Open Call "Apply Now" button.
const HOVER_MS = 400
const HOVER_EASE = 'out(4)'
// A calm turn streams a continuous spread, and the handle follows it. A burst of
// taps or arrow keys jumps that value onto the next spread, then the new turn
// eases in from a standstill, so the handle steps. Glide aims at the end of the
// latest turn and keeps its speed across further jumps. Speeds are spreads/second.
const GLIDE_JUMP = 0.25
// While taps are still arriving the handle keeps this pace, so it doesn't brake
// at every spread. It eases out only after the destination has settled.
const GLIDE_BURST_MS = 140
const GLIDE_BURST_SPEED = 4.5
const GLIDE_MAX_SPEED = 7
const GLIDE_VEL_MS = 90

const cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

// The handle shows the spread's left page number. On a phone the visible page
// is numbered 1, 2, 3… in the order you turn. The ends stay C and D, including
// while the handle is pulled slightly past the track.
const pageLabel = (s, last, phone) => {
  const n = Math.min(last, Math.max(0, Math.round(s)))
  if (n === 0) return 'C'
  if (n === last) return 'D'
  return phone ? n : n * 2 - 1
}

const setHover = (handle, over) => {
  const text = cssVar('--color-text')
  const theme = cssVar('--color-theme')
  const to = { duration: HOVER_MS, ease: HOVER_EASE }
  animate(handle.querySelector('.magazine-slider-label'), {
    color: over ? text : theme,
    fontWeight: over ? 700 : 400,
    ...to,
  })
  animate(handle.querySelectorAll('.magazine-slider-crescent'), {
    fill: over ? text : theme,
    ...to,
  })
  animate(handle.querySelector('.is-left'), { translateX: over ? -CRESCENT_GAP : 0, ...to })
  animate(handle.querySelector('.is-right'), { translateX: over ? CRESCENT_GAP : 0, ...to })
  const rest = handle.offsetWidth || 1
  const grow = (HOVER_HANDLE_REM * parseFloat(getComputedStyle(document.documentElement).fontSize)) / rest
  animate(handle.querySelector('.magazine-slider-mark'), { scale: over ? grow : 1, ...to })
}

// onScrub gets the handle's fractional spread while dragging; onChange gets the
// spread it lands on.
const MagazineSlider = forwardRef(({ spread, lastSpread, onScrub, onChange }, ref) => {
  const trackRef = useRef(null)
  const handleRef = useRef(null)
  const draggableRef = useRef(null)
  const stepRef = useRef(() => 0)
  // Spread under the handle while dragging, and the target while the book turns to it.
  const [preview, setPreview] = useState(null)
  const [sliding, setSliding] = useState(false)
  const [hot, setHot] = useState(false)
  const [phone, setPhone] = useState(() => window.matchMedia('(max-width: 800px)').matches)
  const previewRef = useRef(null)
  previewRef.current = preview
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onScrubRef = useRef(onScrub)
  onScrubRef.current = onScrub
  const spreadRef = useRef(spread)
  spreadRef.current = spread
  const lastSpreadRef = useRef(lastSpread)
  lastSpreadRef.current = lastSpread
  // The spread whose position the draggable's own transform currently holds.
  const baseRef = useRef(0)
  // `goal` is the latest spread the book reported; `shown` is where the handle is.
  const goalRef = useRef(spread)
  const shownRef = useRef(spread)
  const destRef = useRef(spread)
  const destAtRef = useRef(0)
  const glideDirRef = useRef(0)
  const glidingRef = useRef(false)
  const velRef = useRef(0)
  const chaseRef = useRef(0)
  const lastTickRef = useRef(0)
  const [visual, setVisual] = useState(spread)
  const visualRef = useRef(spread)
  const chaseCtl = useRef({ stop() {} })

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 800px)')
    const onChange = () => setPhone(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const track = trackRef.current
    const handle = handleRef.current
    const step = () => (track.clientWidth - handle.offsetWidth) / lastSpread
    const maxX = () => track.clientWidth - handle.offsetWidth
    // Past the ends the spread stays put, so the label holds at C or D.
    const spreadAt = (x) => Math.min(lastSpread, Math.max(0, x / step()))
    const indexOf = (x) => Math.round(spreadAt(x))
    stepRef.current = step

    const draggable = createDraggable(handle, {
      container: track,
      y: false,
      x: {
        snap: () => Array.from({ length: lastSpread + 1 }, (_, i) => i * step()),
        modifier: (v) => Math.min(maxX() + OVERSHOOT, Math.max(-OVERSHOOT, v)),
      },
      // A stiff, critically damped spring (damping = 2√stiffness) lands a flick
      // quickly without bouncing; the defaults are 80 / 20.
      releaseStiffness: 400,
      releaseDamping: 40,
      onGrab: (d) => {
        chaseCtl.current.stop()
        setSliding(true)
        // `left` is the in-between offset; fold it into x so the handle doesn't jump.
        const left = parseFloat(handle.style.left) || 0
        const x = d.x + left
        handle.style.left = '0px'
        d.setX(x, true)
        const at = step() ? x / step() : 0
        baseRef.current = at
        shownRef.current = at
        goalRef.current = at
        destRef.current = at
        velRef.current = 0
      },
      onDrag: (d) => {
        setPreview(indexOf(d.x))
        onScrubRef.current?.(spreadAt(d.x))
      },
      onRelease: (d) => {
        chaseCtl.current.stop()
        setSliding(false)
        const target = indexOf(d.destX)
        baseRef.current = target
        shownRef.current = target
        goalRef.current = target
        destRef.current = target
        velRef.current = 0
        handle.style.left = '0px'
        if (target !== visualRef.current) {
          visualRef.current = target
          setVisual(target)
        }
        setPreview(target === spreadRef.current ? null : target)
        onChangeRef.current?.(target)
      },
      onAfterResize: (d) => d.setX(spreadRef.current * step(), true),
    })
    draggable.setX(spreadRef.current * step(), true)
    shownRef.current = spreadRef.current
    goalRef.current = spreadRef.current
    destRef.current = spreadRef.current
    velRef.current = 0
    draggableRef.current = draggable

    return () => {
      cancelAnimationFrame(chaseRef.current)
      chaseRef.current = 0
      glidingRef.current = false
      velRef.current = 0
      draggable.revert()
      draggableRef.current = null
    }
  }, [lastSpread])

  // The draggable owns `transform` and only shows a new value once it settles,
  // so a page turn moves the handle with `left` and hands back to it on landing.
  // The draggable stays on the spread below `s`; `left` covers the fraction.
  const place = (s) => {
    const handle = handleRef.current
    const d = draggableRef.current
    if (!handle || !d) return
    const last = lastSpreadRef.current
    const at = Math.min(last, Math.max(0, s))
    const step = stepRef.current()
    const base = Math.min(last, Math.floor(at + 1e-4))
    if (baseRef.current !== base) {
      baseRef.current = base
      d.setX(base * step, true)
    }
    const frac = at - base
    handle.style.left = `${frac < 1e-4 ? 0 : frac * step}px`
    const n = Math.round(at)
    if (n !== visualRef.current) {
      visualRef.current = n
      setVisual(n)
    }
  }

  const stopGlide = () => {
    cancelAnimationFrame(chaseRef.current)
    chaseRef.current = 0
    glidingRef.current = false
    velRef.current = 0
  }
  chaseCtl.current.stop = stopGlide

  // Where this burst is heading: the spread the newest turn will land on.
  const retarget = (s, dir) => {
    const last = lastSpreadRef.current
    let dest = dir > 0 ? Math.min(last, Math.floor(s) + 1) : Math.max(0, Math.ceil(s) - 1)
    if (dir === glideDirRef.current) {
      dest = dir > 0 ? Math.max(destRef.current, dest) : Math.min(destRef.current, dest)
    } else {
      glideDirRef.current = dir
    }
    if (dest !== destRef.current) destAtRef.current = performance.now()
    destRef.current = dest
  }

  const tick = (now) => {
    const d = draggableRef.current
    if (!d || d.grabbed || previewRef.current !== null || !glidingRef.current) {
      chaseRef.current = 0
      return
    }
    const dt = Math.min(now - lastTickRef.current, 50)
    lastTickRef.current = now
    const dest = destRef.current
    const diff = dest - shownRef.current
    const ad = Math.abs(diff)
    if (ad < 0.004) {
      shownRef.current = dest
      velRef.current = 0
      place(dest)
      chaseRef.current = 0
      if (Math.abs(goalRef.current - dest) < 0.02) glidingRef.current = false
      return
    }
    const burst = now - destAtRef.current < GLIDE_BURST_MS
    const cruise = Math.min(GLIDE_MAX_SPEED, Math.max(GLIDE_BURST_SPEED, ad * 1.6))
    const shaped = !burst && ad < 0.75 ? cruise * (0.35 + 0.65 * (ad / 0.75)) : cruise
    const targetVel = Math.sign(diff) * shaped
    velRef.current += (targetVel - velRef.current) * (1 - Math.exp(-dt / GLIDE_VEL_MS))
    const step = velRef.current * (dt / 1000)
    if (Math.abs(step) >= ad) {
      shownRef.current = dest
      velRef.current = 0
    } else {
      shownRef.current += step
    }
    place(shownRef.current)
    chaseRef.current = requestAnimationFrame(tick)
  }

  const kick = () => {
    if (chaseRef.current) return
    lastTickRef.current = performance.now()
    chaseRef.current = requestAnimationFrame(tick)
  }

  useImperativeHandle(ref, () => ({
    moveTo(s) {
      const handle = handleRef.current
      const d = draggableRef.current
      if (!handle || !d || d.grabbed || previewRef.current !== null) return
      const prev = goalRef.current
      const delta = s - prev
      const jumped = Math.abs(delta) > GLIDE_JUMP && Math.abs(s - shownRef.current) > GLIDE_JUMP
      goalRef.current = s
      if (jumped) {
        glidingRef.current = true
        retarget(s, Math.sign(delta) || glideDirRef.current || 1)
      } else if (glidingRef.current) {
        const dir = glideDirRef.current
        if (dir > 0 && s > destRef.current) retarget(s, dir)
        else if (dir < 0 && s < destRef.current) retarget(s, dir)
        if (
          Math.abs(shownRef.current - destRef.current) < 0.01 &&
          Math.abs(s - destRef.current) < 0.02
        ) {
          glidingRef.current = false
          velRef.current = 0
          shownRef.current = s
          place(s)
          return
        }
      }
      if (!glidingRef.current) {
        shownRef.current = s
        velRef.current = 0
        place(s)
        return
      }
      kick()
    },
  }), [])

  useEffect(() => {
    if (previewRef.current !== null && Math.round(spread) === previewRef.current) setPreview(null)
  }, [spread])

  const engaged = hot || sliding
  const skipHover = useRef(true)
  useEffect(() => {
    if (skipHover.current) {
      skipHover.current = false
      return
    }
    const handle = handleRef.current
    if (handle) setHover(handle, engaged)
  }, [engaged])

  return (
    <div ref={trackRef} className="magazine-slider">
      <div
        ref={handleRef}
        className="magazine-slider-handle"
        onMouseEnter={() => setHot(true)}
        onMouseLeave={() => setHot(false)}
      >
        <svg className="magazine-slider-mark" viewBox="0 0 156.92 53.87" aria-hidden="true">
          <path
            className="magazine-slider-crescent is-left"
            d="M80.96,53.87C36.05,53.56,0,41.63,0,26.93S36.05.3,80.96,0C44.06.37,14.49,12.27,14.49,26.93s29.57,26.57,66.46,26.94Z"
          />
          <path
            className="magazine-slider-crescent is-right"
            d="M156.92,26.93c0,14.7-36.04,26.64-80.96,26.94,36.91-.37,66.47-12.28,66.47-26.94S112.86.37,75.96,0c44.92.3,80.96,12.23,80.96,26.93Z"
          />
        </svg>
        <span className="magazine-slider-label">{pageLabel(preview ?? visual, lastSpread, phone)}</span>
      </div>
    </div>
  )
})

export default MagazineSlider
