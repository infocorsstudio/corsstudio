import { useLayoutEffect } from 'react'
import { animate, onScroll } from 'animejs'

// Same per-frame catch-up as anime.js onScroll sync 0.4.
const STEP = 0.01 + 0.19 * 0.4

// Finish as the element's top reaches 75% of the viewport.
// If the page ends before that line, finish at the element's resting place
// so scrolling to the bottom still completes the animation.
const leaveFor = (el) => {
  const vh = window.innerHeight || 1
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh)
  const topAtEnd = el.getBoundingClientRect().top + window.scrollY - maxScroll
  const line = vh * 0.75
  if (topAtEnd <= line) return '75% start'
  const endLine = Math.min(Math.ceil(topAtEnd), vh - 1)
  return `${endLine}px start`
}

const useScrollReveal = (rootRef, deps = []) => {
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    let frameId = 0
    let running = false
    let alive = true
    const items = []

    const tick = () => {
      if (!alive) return
      let moving = false
      items.forEach((item) => {
        item.current = item.target + (item.current - item.target) * STEP
        if (Math.abs(item.target - item.current) < 0.001) item.current = item.target
        else moving = true
        item.anim.seek(item.anim.duration * item.current)
      })
      if (moving) frameId = requestAnimationFrame(tick)
      else running = false
    }

    const kick = () => {
      if (!alive || running) return
      running = true
      frameId = requestAnimationFrame(tick)
    }

    root.querySelectorAll('[data-reveal]').forEach((el) => {
      const item = { target: 0, current: 0 }
      item.anim = animate(el, {
        x: ['-10%', 0],
        opacity: [0, 1],
        ease: 'linear',
        autoplay: false,
      })
      item.anim.seek(0)
      item.scroller = onScroll({
        target: el,
        enter: 'end start',
        leave: () => leaveFor(el),
        onUpdate: (self) => {
          item.target = self.progress
          kick()
        },
      })
      items.push(item)
    })

    return () => {
      alive = false
      cancelAnimationFrame(frameId)
      items.forEach((item) => {
        item.anim.revert()
        item.scroller.revert()
      })
    }
  }, deps)
}

export default useScrollReveal
