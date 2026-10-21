import { useLayoutEffect } from 'react'
import { animate, onScroll } from 'animejs'

// Same per-frame catch-up as anime.js onScroll sync 0.4.
const STEP = 0.01 + 0.19 * 0.4

// Finish as the element's top reaches 75% of the viewport.
// If the page ends before that line, finish where the element actually rests,
// so scrolling to the bottom still completes the animation.
const leaveFor = (el) => {
  const vh = window.innerHeight || 1
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh)
  const topAtEnd = el.getBoundingClientRect().top + window.scrollY - maxScroll
  if (topAtEnd <= vh * 0.75) return '75% start'
  const endLine = Math.min(Math.ceil(topAtEnd), vh - 1)
  return `${endLine}px start`
}

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789~!@#$%^&*()+=;:<>?/|'
const SCRAMBLE_MS = 600
const SCRAMBLE_FRAME = 1000 / 40

const textNodesIn = (el) => {
  const nodes = []
  const walk = (node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        if (child.textContent.trim()) nodes.push(child)
      } else if (child.nodeType === 1) {
        walk(child)
      }
    })
  }
  walk(el)
  return nodes
}

// Same lock-in as TextScramble: characters resolve from the start while the rest stay random.
const paintScramble = (item, p) => {
  item.nodes.forEach((node, i) => {
    const text = item.originals[i]
    if (p >= 1) {
      node.textContent = text
      return
    }
    const correct = Math.floor(p * text.length)
    let next = ''
    for (let c = 0; c < text.length; c++) {
      if (c < correct || text[c] === ' ') next += text[c]
      else next += SCRAMBLE_CHARS[(Math.random() * SCRAMBLE_CHARS.length) | 0]
    }
    node.textContent = next
  })
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

    const syncTargets = () => {
      let pending = false
      items.forEach((item) => {
        if (!item.scroller.ready) {
          pending = true
          return
        }
        item.target = item.scroller.progress
        if (item.scramble && item.scrambleStart == null && item.target > 0 && item.nodes.length) {
          item.el.style.width = `${item.el.offsetWidth}px`
          item.el.style.height = `${item.el.offsetHeight}px`
          item.el.style.overflow = 'hidden'
          item.scrambleStart = performance.now()
          item.lastPaint = 0
          const finish = () => {
            paintScramble(item, 1)
            item.el.style.width = ''
            item.el.style.height = ''
            item.el.style.overflow = ''
          }
          const run = () => {
            if (!alive) return
            const now = performance.now()
            const p = Math.min((now - item.scrambleStart) / SCRAMBLE_MS, 1)
            if (p === 1 || now - item.lastPaint >= SCRAMBLE_FRAME) {
              if (p === 1) finish()
              else {
                paintScramble(item, p)
                item.lastPaint = now
              }
            }
            if (p < 1) item.raf = requestAnimationFrame(run)
          }
          item.raf = requestAnimationFrame(run)
        }
      })
      if (pending && alive) requestAnimationFrame(syncTargets)
      kick()
    }

    root.querySelectorAll('[data-reveal]').forEach((el) => {
      const scramble = el.hasAttribute('data-scramble')
      const nodes = scramble ? textNodesIn(el) : []
      const item = {
        target: 0,
        current: 0,
        el,
        scramble,
        nodes,
        originals: nodes.map((node) => node.textContent),
        scrambleStart: null,
        lastPaint: 0,
        raf: 0,
      }
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
      })
      items.push(item)
    })

    syncTargets()
    window.addEventListener('scroll', syncTargets, { passive: true })
    window.addEventListener('resize', syncTargets)

    return () => {
      alive = false
      cancelAnimationFrame(frameId)
      window.removeEventListener('scroll', syncTargets)
      window.removeEventListener('resize', syncTargets)
      items.forEach((item) => {
        cancelAnimationFrame(item.raf)
        if (item.scramble) {
          item.nodes.forEach((node, i) => {
            node.textContent = item.originals[i]
          })
          item.el.style.width = ''
          item.el.style.height = ''
          item.el.style.overflow = ''
        }
        item.anim.revert()
        item.scroller.revert()
      })
    }
  }, deps)
}

export default useScrollReveal
