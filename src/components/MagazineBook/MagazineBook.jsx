import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { CanvasTexture, DoubleSide, LinearSRGBColorSpace, Mesh } from 'three'
import { animate } from 'animejs'
import { Book3D } from 'turngl'
import './MagazineBook.css'

// Pages are 4:5 like the Issue 001 posters; the canvases and the 3D page share it.
const PAGE_RATIO = 4 / 5
const PAGE_HEIGHT_3D = 2.33
const PAGE_W = 744
const PAGE_H = 930
const FLIP_MS = 780
// A leaf still turning when the next press arrives finishes at this pace (ms per full turn).
const HURRY_MS = 300
// Slider scrubbing: the book's position chases the slider, closing the gap with this
// time constant (smaller = snappier), and never slower than SCRUB_MIN_SPEED spreads/s.
const SCRUB_TAU_MS = 45
const SCRUB_MIN_SPEED = 3

// --- Scene tuning (all optional knobs layered on top of turngl's defaults) ---
// Ambient (global fill) brightness, relative to turngl's light preset. Lower = darker.
const AMBIENT_SCALE = 0.93
// Key light (the shadow-casting directional) brightness. 1 = turngl default.
const KEY_SCALE = 1
// Fill light (the side point light) brightness. 1 = turngl default.
const FILL_SCALE = 1
// Light color temperatures in Kelvin. Lower = warmer (orange), higher = cooler (blue).
// ~5500K is neutral daylight; turngl's look is a warm key + cool fill.
const KEY_KELVIN = 6500
const FILL_KELVIN = 7600
// How far the book leans toward the cursor. 1 = turngl default, 0 = locked straight.
const TILT = 1
// Camera field of view in degrees. Smaller = flatter/less perspective; larger = deeper.
const CAMERA_FOV = 22
// Open spread width over visible height; larger pulls the camera back (smaller book).
const SPREAD_ASPECT = 1.5
// Spine thickness (3D width). turngl's default is 0.04; lower = thinner.
const SPINE_WIDTH = 0.005

// Total leaves in the book (cover + content + back cover).
const PAGE_COUNT = 30
// Every page also gets a copy at this fraction of full size: scrubbing turns pages
// faster than full-size textures can be rendered and uploaded.
const LOW_RES_SCALE = 0.2

// Cover and back cover wrap numbered pages 1 … PAGE_COUNT - 2.
const pageLabel = (i) => {
  if (i === 0) return ['cover', 120]
  if (i === PAGE_COUNT - 1) return ['back cover', 96]
  return [String(i), 180]
}

// Draws page `i` at `scale` × full size. May return a promise, so a PDF renderer
// can drop in here.
const renderPage = (i, scale) => {
  const [text, size] = pageLabel(i)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(PAGE_W * scale)
  canvas.height = Math.round(PAGE_H * scale)
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)
  ctx.fillStyle = '#fcfcfc'
  ctx.fillRect(0, 0, PAGE_W, PAGE_H)
  ctx.fillStyle =
    getComputedStyle(document.documentElement).getPropertyValue('--color-gray').trim() || '#ebebeb'
  ctx.font = `700 ${size}px Inter, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, PAGE_W / 2, PAGE_H / 2)
  return canvas
}

const loadLowRes = async () => {
  await document.fonts.ready
  return Promise.all(Array.from({ length: PAGE_COUNT }, (_, i) => renderPage(i, LOW_RES_SCALE)))
}

const clamp = (v, min, max) => Math.min(Math.max(v, min), max)

// Smoother than turngl's built-in easeInOutQuad. Taps use the symmetric S-curve;
// a release already carries momentum, so it only decelerates (easeOut).
const easeInOutCubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3)

// Zero slope at both ends, so the bent region blends into the flat page without a crease.
const smoothstep = (x) => {
  const c = clamp(x, 0, 1)
  return c * c * (3 - 2 * c)
}

// A gentler replacement for turngl's curl: same cylindrical roll, but the bend angle
// uses smoothstep instead of a hard clamp, removing the arc-meets-straight-line kink.
// CURL_SPREAD widens how much of the page is mid-bend (larger = softer, longer arc).
const CURL_SPREAD = 0.34
const curlPage = (book, t, dir, geom = book.flipGeom) => {
  const pos = geom.attributes.position
  const nx = book._nx
  const oy = book._oy
  const PW = book.PW
  for (let i = 0; i < pos.count; i++) {
    const l = dir === 'fwd' ? nx[i] + 0.5 : 0.5 - nx[i]
    const p = l * PW
    const angle = smoothstep(1.25 * t - 0.125 + (l - 0.5) * CURL_SPREAD) * Math.PI
    pos.setX(i, (dir === 'fwd' ? 1 : -1) * p * Math.cos(angle))
    pos.setZ(i, p * Math.sin(angle))
    pos.setY(i, oy[i])
  }
  pos.needsUpdate = true
  geom.computeVertexNormals()
}

// Tanner Helland's blackbody approximation: Kelvin -> an sRGB hex for THREE.Color.set.
const kelvinToHex = (kelvin) => {
  const t = clamp(kelvin, 1000, 40000) / 100
  let r, g, b
  if (t <= 66) {
    r = 255
    g = 99.4708025861 * Math.log(t) - 161.1195681661
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592)
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492)
    b = 255
  }
  const ch = (v) => clamp(Math.round(v), 0, 255)
  return (ch(r) << 16) | (ch(g) << 8) | ch(b)
}

const MagazineBook = forwardRef(({ onSpreadChange }, ref) => {
  const mountRef = useRef(null)
  const apiRef = useRef(null)
  const onSpreadChangeRef = useRef(onSpreadChange)
  onSpreadChangeRef.current = onSpreadChange

  // scrub(s) follows a fractional spread (the slider mid-drag); goTo(s) lands on one.
  useImperativeHandle(
    ref,
    () => ({
      scrub: (s) => apiRef.current?.scrub(s),
      goTo: (s) => apiRef.current?.goTo(s),
    }),
    [],
  )

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    // A fresh canvas per mount: a canvas whose WebGL context was released
    // cannot host a new renderer.
    const canvas = document.createElement('canvas')
    canvas.className = 'magazine-book-canvas'
    mount.appendChild(canvas)

    let alive = true
    const book = new Book3D(canvas, {
      theme: 'light',
      pageWidth: PAGE_HEIGHT_3D * PAGE_RATIO,
      pageHeight: PAGE_HEIGHT_3D,
    })
    book.setTheme(false)
    // turngl is tuned for three's legacy lighting; current three renders it too dark.
    book.renderer.outputColorSpace = LinearSRGBColorSpace
    book.scene.traverse((o) => {
      if (!o.isLight) return
      // Each light gets its own scale/color on top of the Math.PI legacy-lighting
      // fix: ambient is the global fill, the directional is the key, the point is the fill.
      if (o.isAmbientLight) {
        o.intensity *= Math.PI * AMBIENT_SCALE
      } else if (o.isDirectionalLight) {
        o.intensity *= Math.PI * KEY_SCALE
        o.color.set(kelvinToHex(KEY_KELVIN))
      } else {
        o.intensity *= Math.PI * FILL_SCALE
        o.color.set(kelvinToHex(FILL_KELVIN))
      }
      // Pages sit 0.06 above the floor; the default 0.5–500 shadow depth range can't
      // resolve that, so pages shadow themselves and the floor shadow is lost.
      if (o.castShadow) {
        o.shadow.camera.near = 3
        o.shadow.camera.far = 8
        o.shadow.camera.updateProjectionMatrix()
        o.shadow.normalBias = 0.02
      }
    })
    // The turning leaf starts flat at z = 0; static pages sit just behind it.
    book.meshL.position.z = -0.002
    book.meshR.position.z = -0.002
    // Only the turning leaf casts by default, so its shadow vanished on landing.
    // Pages face the light, and front-side materials cast from their back faces.
    for (const mesh of [book.meshL, book.meshR, book.flipF]) {
      mesh.castShadow = true
      mesh.material.shadowSide = DoubleSide
    }
    // Static pages receiveShadow, but the turning leaf does not, so a page "pops"
    // brighter the instant it lifts. Let the leaf receive shadows too for a smooth hand-off.
    book.flipF.receiveShadow = true
    book.flipB.receiveShadow = true
    // turngl has a single turning leaf. This copy takes over a leaf that's still in the
    // air when the next turn starts, so both can move at once.
    const ghostGeom = book.flipGeom.clone()
    const ghostLeaf = [book.flipF, book.flipB].map((src) => {
      const material = src.material.clone()
      material.map = new CanvasTexture(book._blankCanvas())
      const mesh = new Mesh(ghostGeom, material)
      mesh.castShadow = src.castShadow
      mesh.receiveShadow = src.receiveShadow
      mesh.visible = false
      book.scene.add(mesh)
      return mesh
    })
    // turngl hardcodes fov 26 in its constructor; resize only touches aspect,
    // so overriding it once here sticks.
    book.camera.fov = CAMERA_FOV
    book.camera.updateProjectionMatrix()
    // turngl's spine box is PH + 0.02 tall, so it pokes above the pages. It's the
    // only BoxGeometry in the scene; squash it back to the exact page height.
    const spine = book.scene.children.find((o) => o.isMesh && o.geometry.type === 'BoxGeometry')
    if (spine) {
      spine.scale.y = book.PH / (book.PH + 0.02)
      spine.scale.x = SPINE_WIDTH / 0.04
    }

    // Cover and back cover are a single page, so the book slides until that page
    // sits on the camera's center. Spreads stay on the spine.
    const shifted = [book.meshL, book.meshR, book.flipF, book.flipB, ...ghostLeaf, spine].filter(
      Boolean,
    )
    const baseX = new Map(shifted.map((mesh) => [mesh, mesh.position.x]))
    const shiftState = { x: 0 }
    let shiftAnim = null
    let shiftSpread = -1
    let shiftTarget = 0
    const applyShift = (x) => {
      shiftState.x = x
      for (const mesh of shifted) mesh.position.x = baseX.get(mesh) + x
    }
    const shiftFor = (s) => {
      const half = book.PW / 2
      if (s <= 0) return -half
      if (s >= lastSpread()) return half
      return 0
    }
    const aimShift = (s, duration = FLIP_MS) => {
      const next = clamp(Math.round(s), 0, lastSpread())
      if (next === shiftSpread) return
      shiftSpread = next
      const x = shiftFor(next)
      // Every spread between the covers shares x = 0; restarting a run already
      // heading there would cut it off mid-ease.
      if (Math.abs(x - shiftTarget) < 1e-4 && (shiftAnim || Math.abs(x - shiftState.x) < 1e-4)) {
        return
      }
      shiftTarget = x
      shiftAnim?.cancel()
      shiftAnim = null
      if (duration <= 0) {
        applyShift(x)
        return
      }
      shiftAnim = animate(shiftState, {
        x,
        duration,
        ease: 'inOutCubic',
        onUpdate: () => applyShift(shiftState.x),
        onComplete: () => {
          shiftAnim = null
        },
      })
    }

    const resize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      if (!w || !h) return
      book.resize(w, h)
      book.setZoom(Math.min(0.85, w / h / SPREAD_ASPECT))
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(mount)

    // Spread 0 is the lone cover on the right; after that pages pair up.
    let lowRes = []
    // Full-size pages around the current spread; null while one is rendering.
    const highRes = new Map()
    let spread = 0
    let busy = false
    let drag = null
    const pageAt = (i, fast) => {
      if (i < 0 || i >= lowRes.length) return null
      return (!fast && highRes.get(i)) || lowRes[i]
    }
    const leftOf = (s, fast) => pageAt(2 * s - 1, fast)
    const rightOf = (s, fast) => pageAt(2 * s, fast)
    const lastSpread = () => Math.floor(lowRes.length / 2)

    const show = (s) => {
      book.showSpread(leftOf(s), rightOf(s))
      book.meshL.visible = !!leftOf(s)
      book.meshR.visible = !!rightOf(s)
    }

    // Keeps full-size pages for spread `s` and its neighbours (what a tap turns to)
    // and drops the rest, repainting the spread as its pages arrive.
    const loadNear = (s) => {
      const keep = new Set()
      for (let i = Math.max(0, 2 * s - 3); i <= Math.min(lowRes.length - 1, 2 * s + 2); i++) {
        keep.add(i)
      }
      for (const i of highRes.keys()) if (!keep.has(i)) highRes.delete(i)
      for (const i of keep) {
        if (highRes.has(i)) continue
        highRes.set(i, null)
        Promise.resolve(renderPage(i, 1)).then((page) => {
          if (!alive || !highRes.has(i)) return
          highRes.set(i, page)
          if (!busy && !drag && (i === 2 * spread - 1 || i === 2 * spread)) show(spread)
        })
      }
    }

    // prepFlip hides the static page under the turning leaf, so the next spread's
    // page is put back there before the turn starts.
    const begin = (dir, from = spread, fast = false) => {
      const next = dir === 'fwd' ? from + 1 : from - 1
      const L = (s) => leftOf(s, fast)
      const R = (s) => rightOf(s, fast)
      if (dir === 'fwd') {
        book.showSpread(L(from), R(next))
        book.prepFlip('fwd', R(from), L(next))
        book.meshL.visible = !!L(from)
        book.meshR.visible = !!R(next)
      } else {
        book.showSpread(L(next), R(from))
        book.prepFlip('bwd', L(from), R(next))
        book.meshL.visible = !!L(next)
        book.meshR.visible = !!R(from)
      }
      return next
    }

    const report = (s = spread) => onSpreadChangeRef.current?.(s, lastSpread())

    // A leaf handed to the ghost keeps turning, faster, while the next turn starts.
    let ghost = null
    const setPage = (mesh, page) => {
      book._setTex(mesh.material, page ?? book._blankCanvas())
      mesh.visible = !!page
    }
    const landGhost = () => {
      if (!ghost) return
      const g = ghost
      ghost = null
      cancelAnimationFrame(g.raf)
      for (const mesh of ghostLeaf) mesh.visible = false
      // The page it lands on is the one the current turn started from.
      if (g.dir === 'fwd') setPage(book.meshL, leftOf(g.next))
      else setPage(book.meshR, rightOf(g.next))
    }
    const swapMap = (a, b) => {
      const map = a.map
      a.map = b.map
      b.map = map
      a.needsUpdate = b.needsUpdate = true
    }

    let flipRaf = 0
    // The turn currently playing out, so a second press can hurry it along.
    let flipJob = null
    const commitFlip = () => {
      landGhost()
      if (!flipJob) return
      const job = flipJob
      flipJob = null
      cancelAnimationFrame(flipRaf)
      book.endFlip()
      if (job.to === 1) spread = job.next
      busy = false
      show(spread)
      report()
      loadNear(spread)
    }
    // Moves the turning leaf to the ghost and lets it finish quickly. Returns the
    // page that must stay under it until it lands.
    const handOff = () => {
      landGhost()
      const job = flipJob
      flipJob = null
      cancelAnimationFrame(flipRaf)
      swapMap(ghostLeaf[0].material, book.flipF.material)
      swapMap(ghostLeaf[1].material, book.flipB.material)
      for (const mesh of ghostLeaf) mesh.visible = true
      spread = job.next
      busy = false
      const g = (ghost = { dir: job.dir, next: job.next, raf: 0 })
      const from = job.p
      const duration = Math.max(120, (1 - from) * HURRY_MS)
      const start = performance.now()
      const frame = (now) => {
        if (!alive || ghost !== g) return
        const t = Math.min(1, (now - start) / duration)
        curlPage(book, from + (1 - from) * easeOutCubic(t), g.dir, ghostGeom)
        if (t < 1) g.raf = requestAnimationFrame(frame)
        else landGhost()
      }
      curlPage(book, from, g.dir, ghostGeom)
      g.raf = requestAnimationFrame(frame)
      return job.dir === 'fwd' ? leftOf(job.origin) : rightOf(job.origin)
    }
    const canTurn = (dir, s) => (dir === 'fwd' ? s < lastSpread() : s > 0)
    // A press during a turn: the same direction hurries that leaf and starts the next
    // one alongside it; anything else lands it at once. Returns false if no turn fits.
    const startTurn = (dir, start) => {
      const job = flipJob
      if (busy && job?.to === 1 && job.dir === dir) {
        if (!canTurn(dir, job.next)) return false
        const under = handOff()
        start()
        setPage(dir === 'fwd' ? book.meshL : book.meshR, under)
        return true
      }
      if (busy) commitFlip()
      if (!canTurn(dir, spread)) return false
      start()
      return true
    }
    const settle = (dir, next, from, to) => {
      busy = true
      const origin = dir === 'fwd' ? next - 1 : next + 1
      const job = (flipJob = { dir, next, origin, to, p: from })
      // A tap starts from rest (ease in+out); a release carries speed (ease out only).
      const ease = from === 0 ? easeInOutCubic : easeOutCubic
      const duration = to === 1 ? Math.max(260, (1 - from) * FLIP_MS) : Math.max(200, from * 520)
      if (to === 1) aimShift(next, duration)
      const start = performance.now()
      const frame = (now) => {
        if (!alive || flipJob !== job) return
        const t = Math.min(1, (now - start) / duration)
        const p = from + (to - from) * ease(t)
        job.p = p
        curlPage(book, p, dir)
        // Reporting every frame lets the slider handle leave with the page.
        if (to === 1) report(origin + (next - origin) * p)
        if (t < 1) {
          flipRaf = requestAnimationFrame(frame)
          return
        }
        landGhost()
        book.endFlip()
        if (to === 1) spread = next
        flipJob = null
        busy = false
        report()
        show(spread)
        loadNear(spread)
        if (scrubTarget !== null) scrub(scrubTarget)
      }
      flipRaf = requestAnimationFrame(frame)
    }

    // Slider scrubbing: `pos` (a fractional spread) chases the slider, and the leaf
    // between floor(pos) and floor(pos) + 1 is curled by the fraction in between.
    // Leaves are set up with low-res pages; full-size ones load once it stops.
    let scrubTarget = null
    let scrubbing = false
    let pos = 0
    let leaf = null
    let scrubRaf = 0
    let lastTime = 0

    const finishScrub = () => {
      book.endFlip()
      leaf = null
      scrubbing = false
      scrubTarget = null
      busy = false
      show(spread)
      loadNear(spread)
    }

    const scrubFrame = (now) => {
      scrubRaf = 0
      if (!alive) return
      const dt = Math.min(now - lastTime, 50)
      lastTime = now
      const diff = scrubTarget - pos
      const move = Math.max(
        Math.abs(diff) * (1 - Math.exp(-dt / SCRUB_TAU_MS)),
        (SCRUB_MIN_SPEED * dt) / 1000,
      )
      pos = move >= Math.abs(diff) ? scrubTarget : pos + Math.sign(diff) * move

      const n = Math.min(Math.floor(pos), lastSpread() - 1)
      if (leaf?.n !== n) {
        if (leaf) book.endFlip()
        // The leaf keeps the direction it started in, even if the slider reverses.
        const dir = diff > 0 ? 'fwd' : 'bwd'
        leaf = { n, dir }
        begin(dir, dir === 'fwd' ? n : n + 1, true)
      }
      const t = pos - n
      curlPage(book, leaf.dir === 'fwd' ? t : 1 - t, leaf.dir)

      if (Math.round(pos) !== spread) {
        spread = Math.round(pos)
        report()
        aimShift(spread)
      }
      if (pos !== scrubTarget) scrubRaf = requestAnimationFrame(scrubFrame)
      else if (Number.isInteger(pos)) finishScrub()
    }

    const scrub = (s) => {
      if (!lowRes.length || drag) return
      scrubTarget = clamp(s, 0, lastSpread())
      // A tap/drag turn is finishing; settle() picks the target up afterwards.
      if (busy && !scrubbing) return
      if (!scrubbing) {
        if (scrubTarget === spread) {
          scrubTarget = null
          return
        }
        scrubbing = true
        busy = true
        pos = spread
      }
      if (!scrubRaf) {
        lastTime = performance.now()
        scrubRaf = requestAnimationFrame(scrubFrame)
      }
    }
    apiRef.current = { scrub, goTo: (s) => scrub(Math.round(s)) }

    const toLocal = (e) => {
      const r = canvas.getBoundingClientRect()
      return { x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 }
    }

    const onDown = (e) => {
      if (!lowRes.length || scrubbing || drag) return
      const { x } = toLocal(e)
      const dir = x > 0 ? 'fwd' : 'bwd'
      const started = startTurn(dir, () => {
        drag = { dir, startX: x, progress: 0, moved: false, next: begin(dir) }
      })
      if (!started) return
      canvas.setPointerCapture(e.pointerId)
      canvas.classList.add('is-dragging')
    }

    const onMove = (e) => {
      const p = toLocal(e)
      if (!drag) {
        book.mouseLook(p.x * TILT, p.y * TILT)
        return
      }
      const travel = drag.dir === 'fwd' ? drag.startX - p.x : p.x - drag.startX
      drag.progress = clamp(travel * 2.2, 0, 1)
      if (Math.abs(p.x - drag.startX) > 0.01) drag.moved = true
      curlPage(book, drag.progress, drag.dir)
    }

    // A tap turns the page; a drag only commits past 30%.
    const onUp = () => {
      if (!drag) return
      const d = drag
      drag = null
      canvas.classList.remove('is-dragging')
      settle(d.dir, d.next, d.progress, !d.moved || d.progress > 0.3 ? 1 : 0)
    }

    const turn = (dir) => {
      if (drag || scrubbing || !lowRes.length) return
      startTurn(dir, () => settle(dir, begin(dir), 0, 1))
    }
    const onKey = (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return
      e.preventDefault()
      turn(e.key === 'ArrowRight' ? 'fwd' : 'bwd')
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKey)

    loadLowRes().then((pages) => {
      if (!alive) return
      lowRes = pages
      aimShift(spread, 0)
      show(spread)
      loadNear(spread)
      report()
    })

    return () => {
      alive = false
      apiRef.current = null
      cancelAnimationFrame(flipRaf)
      cancelAnimationFrame(scrubRaf)
      if (ghost) cancelAnimationFrame(ghost.raf)
      shiftAnim?.cancel()
      observer.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKey)
      book.dispose()
      book.renderer.forceContextLoss()
      canvas.remove()
    }
  }, [])

  return <div ref={mountRef} className="magazine-book" />
})

export default MagazineBook
