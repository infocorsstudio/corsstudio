import { useEffect, useRef } from 'react'
import works from 'virtual:featured-works'
import './WorksTrail.css'

const SIZE_MIN = 140
const SIZE_MAX = 180
const COUNT_MIN = 2
const COUNT_MAX = 7
const GAP = 42
const SPEED_MAX = 1.5
const HOLD_MS = 100
const LEAVE_MS = 140
const LEAVE_SCALE = 0.28

// One shuffled pass. The trail walks this order as the pointer moves.
const sources = (() => {
  const list = [...new Set(works)]
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const item = list[i]
    list[i] = list[j]
    list[j] = item
  }
  return list
})()

const WorksTrail = () => {
  const rootRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    const section = root?.parentElement
    if (!root || !section || sources.length === 0) return

    const items = []
    let cursor = 0
    let lastX = 0
    let lastY = 0
    let lastTime = 0
    let pending = 0
    let speed = 0
    let inside = false
    let raf = 0

    const point = (event) => ({ x: event.clientX, y: event.clientY })

    const spawn = (x, y, size) => {
      const img = document.createElement('img')
      img.className = 'works-trail-img'
      img.alt = ''
      img.draggable = false
      img.src = sources[cursor % sources.length]
      cursor += 1
      img.style.width = `${Math.round(size)}px`
      img.style.left = `${x}px`
      img.style.top = `${y}px`
      img.style.transform = 'translate(-50%, -50%) scale(0.08)'
      root.appendChild(img)
      const item = { el: img, goal: 1, leaving: false, leaveAt: 0 }
      items.push(item)
      // Commit the small scale so the following change eases up instead of popping.
      img.offsetWidth
      img.style.transform = 'translate(-50%, -50%) scale(1)'
    }

    // Drop a picture each GAP pixels along the move, so a wave becomes a string.
    const drop = (x0, y0, x1, y1, dist, size) => {
      let remain = dist
      let guard = 0
      while (pending + remain >= GAP && guard < COUNT_MAX) {
        const need = GAP - pending
        const traveled = dist - remain
        const t = dist === 0 ? 1 : (traveled + need) / dist
        spawn(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, size)
        remain -= need
        pending = 0
        guard += 1
      }
      pending += remain
    }

    const shrink = (item, now) => {
      if (item.leaving) return
      item.goal = 0
      item.leaving = true
      item.leaveAt = now
      item.el.style.transitionDuration = `${LEAVE_MS}ms`
      item.el.style.transform = `translate(-50%, -50%) scale(${LEAVE_SCALE})`
    }

    const tick = (now) => {
      raf = 0
      const idle = now - lastTime
      const moving = inside && idle < HOLD_MS
      if (!moving) speed += (0 - speed) * 0.2

      if (moving) {
        const keep = Math.round(COUNT_MIN + (COUNT_MAX - COUNT_MIN) * speed)
        let alive = 0
        for (let i = items.length - 1; i >= 0; i--) {
          if (items[i].goal === 0) continue
          alive += 1
          if (alive > keep) shrink(items[i], now)
        }
      } else {
        for (let i = 0; i < items.length; i++) shrink(items[i], now)
      }

      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i]
        if (item.leaving && now - item.leaveAt > LEAVE_MS) {
          item.el.remove()
          items.splice(i, 1)
        }
      }

      if (items.length || (inside && idle < HOLD_MS)) raf = requestAnimationFrame(tick)
    }

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }

    const onEnter = (event) => {
      if (event.pointerType && event.pointerType !== 'mouse') return
      const { x, y } = point(event)
      inside = true
      speed = 0
      lastX = x
      lastY = y
      lastTime = performance.now()
      pending = GAP
      kick()
    }

    const onMove = (event) => {
      if (event.pointerType && event.pointerType !== 'mouse') return
      const now = performance.now()
      const { x, y } = point(event)
      if (!inside) {
        inside = true
        speed = 0
        lastX = x
        lastY = y
        lastTime = now
        pending = GAP
        kick()
        return
      }
      const dx = x - lastX
      const dy = y - lastY
      const dist = Math.hypot(dx, dy)
      if (dist < 0.5) return
      const dt = Math.max(now - lastTime, 8)
      const instant = Math.min(dist / dt, SPEED_MAX) / SPEED_MAX
      speed += (instant - speed) * 0.55
      const size = SIZE_MIN + (SIZE_MAX - SIZE_MIN) * speed
      drop(lastX, lastY, x, y, dist, size)
      lastX = x
      lastY = y
      lastTime = now
      kick()
    }

    const onLeave = (event) => {
      if (event.pointerType && event.pointerType !== 'mouse') return
      inside = false
      speed = 0
      kick()
    }

    section.addEventListener('pointerenter', onEnter)
    section.addEventListener('pointermove', onMove)
    section.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      section.removeEventListener('pointerenter', onEnter)
      section.removeEventListener('pointermove', onMove)
      section.removeEventListener('pointerleave', onLeave)
      items.forEach((item) => item.el.remove())
    }
  }, [])

  return <div ref={rootRef} className="works-trail" aria-hidden="true" />
}

export default WorksTrail
