const buckets = new Map()

const bucket = (name) => {
  let b = buckets.get(name)
  if (!b) {
    b = { n: 0, sum: 0, max: 0 }
    buckets.set(name, b)
  }
  return b
}

export const record = (name, ms) => {
  const b = bucket(name)
  b.n += 1
  b.sum += ms
  if (ms > b.max) b.max = ms
  if (ms >= 50) console.warn(`[perf] ${name} ${ms.toFixed(1)} ms`)
}

export const startPerfLog = () => {
  if (window.__corsPerf) return
  window.__corsPerf = true

  try {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        console.warn(
          `[perf] long task ${entry.duration.toFixed(0)} ms, start ${entry.startTime.toFixed(0)} ms`
        )
      }
    })
    obs.observe({ type: 'longtask', buffered: true })
  } catch {
    console.info('[perf] this browser has no longtask observer')
  }

  let last = performance.now()
  let frames = 0
  let worst = 0
  let slow = 0
  const tick = (now) => {
    const dt = now - last
    last = now
    frames += 1
    if (dt > worst) worst = dt
    if (dt > 32) slow += 1
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)

  setInterval(() => {
    const parts = []
    for (const [name, b] of buckets) {
      if (!b.n) continue
      parts.push(`${name} avg ${(b.sum / b.n).toFixed(1)} max ${b.max.toFixed(1)}`)
      b.n = 0
      b.sum = 0
      b.max = 0
    }
    console.info(
      `[perf] ${frames} frames / 2s, worst ${worst.toFixed(0)} ms, gaps >32 ms: ${slow}` +
        (parts.length ? ` | ${parts.join(' | ')}` : '')
    )
    frames = 0
    worst = 0
    slow = 0
  }, 2000)

  console.info('[perf] on. Filter the console with [perf].')
}
