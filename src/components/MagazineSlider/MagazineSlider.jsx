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
  // The spread whose position the draggable's own transform currently holds.
  const baseRef = useRef(0)

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
      onGrab: () => {
        setSliding(true)
        handle.style.left = '0px'
      },
      onDrag: (d) => {
        setPreview(indexOf(d.x))
        onScrubRef.current?.(spreadAt(d.x))
      },
      onRelease: (d) => {
        setSliding(false)
        const target = indexOf(d.destX)
        baseRef.current = target
        setPreview(target === spreadRef.current ? null : target)
        onChangeRef.current?.(target)
      },
      onAfterResize: (d) => d.setX(spreadRef.current * step(), true),
    })
    draggable.setX(spreadRef.current * step(), true)
    draggableRef.current = draggable

    return () => {
      draggable.revert()
      draggableRef.current = null
    }
  }, [lastSpread])

  // The draggable owns `transform` and only shows a new value once it settles,
  // so a page turn moves the handle with `left` and hands back to it on landing.
  useImperativeHandle(ref, () => ({
    moveTo(s) {
      const handle = handleRef.current
      const d = draggableRef.current
      if (!handle || !d || d.grabbed || previewRef.current !== null) return
      const step = stepRef.current()
      const nearest = Math.round(s)
      if (Math.abs(s - nearest) < 1e-4) {
        if (baseRef.current === nearest) return
        baseRef.current = nearest
        handle.style.left = '0px'
        d.setX(nearest * step, true)
        return
      }
      handle.style.left = `${(s - baseRef.current) * step}px`
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
        <span className="magazine-slider-label">{pageLabel(preview ?? spread, lastSpread, phone)}</span>
      </div>
    </div>
  )
})

export default MagazineSlider
