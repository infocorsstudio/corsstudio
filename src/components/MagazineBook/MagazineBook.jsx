import { useEffect, useRef } from 'react'
import { DoubleSide, LinearSRGBColorSpace } from 'three'
import { Book3D } from 'turngl'
import './MagazineBook.css'

// Pages are 4:5 like the Issue 001 posters; the canvases and the 3D page share it.
const PAGE_RATIO = 4 / 5
const PAGE_HEIGHT_3D = 2.33
const PAGE_W = 744
const PAGE_H = 930
const FLIP_MS = 780

// --- Scene tuning (all optional knobs layered on top of turngl's defaults) ---
// Ambient (global fill) brightness, relative to turngl's light preset. Lower = darker.
const AMBIENT_SCALE = 0.93
// How far the book leans toward the cursor. 1 = turngl default, 0 = locked straight.
const TILT = 1
// Camera field of view in degrees. Smaller = flatter/less perspective; larger = deeper.
const CAMERA_FOV = 22
// Open spread width over visible height; larger pulls the camera back (smaller book).
const SPREAD_ASPECT = 1.5
// Spine thickness (3D width). turngl's default is 0.04; lower = thinner.
const SPINE_WIDTH = 0.005

const sections = [
  ['I. Almost Human', 'Where does the human end, and something else begin?'],
  ['II. The Other Side', 'What exists beyond the boundaries we know?'],
  ['III. Something Is Missing', 'How do we recognize something through its absence?'],
]

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

const blankPage = () => {
  const canvas = document.createElement('canvas')
  canvas.width = PAGE_W
  canvas.height = PAGE_H
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fcfcfc'
  ctx.fillRect(0, 0, PAGE_W, PAGE_H)
  return { canvas, ctx }
}

const imagePage = (img) => {
  const { canvas, ctx } = blankPage()
  const scale = Math.max(PAGE_W / img.width, PAGE_H / img.height)
  const w = img.width * scale
  const h = img.height * scale
  ctx.drawImage(img, (PAGE_W - w) / 2, (PAGE_H - h) / 2, w, h)
  return canvas
}

const wrap = (ctx, text, x, y, maxWidth, lineHeight) => {
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > maxWidth) {
      ctx.fillText(line, x, y)
      line = word
      y += lineHeight
    } else {
      line = next
    }
  }
  if (line) ctx.fillText(line, x, y)
}

const textPage = (theme, title, lines) => {
  const { canvas, ctx } = blankPage()
  const pad = 56
  ctx.fillStyle = theme
  ctx.font = '700 44px Inter, sans-serif'
  ctx.textBaseline = 'top'
  wrap(ctx, title, pad, pad, PAGE_W - pad * 2, 54)
  ctx.fillStyle = '#0e0e0e'
  ctx.font = '400 24px Inter, sans-serif'
  lines.forEach((text, i) => wrap(ctx, text, pad, 220 + i * 120, PAGE_W - pad * 2, 32))
  return canvas
}

const buildPages = async () => {
  const theme =
    getComputedStyle(document.documentElement).getPropertyValue('--color-theme').trim() ||
    '#e60000'
  const [cover, poster] = await Promise.all([
    loadImage('/assets/works/issue001/issue001_poster.jpg'),
    loadImage('/assets/works/issue001/issue001_opencall1_poster.jpg'),
    document.fonts.ready,
  ])
  return [
    imagePage(cover),
    textPage(theme, 'CORS Issue 001 / Spring 2027', sections.map(([title]) => title)),
    ...sections.map(([title, question]) => textPage(theme, title, [question])),
    imagePage(poster),
    textPage(theme, 'Open Call', ['Open calls for each section will be announced in due course.']),
    textPage(theme, 'CORS Studio', ['Across origins, beyond boundaries.']),
  ]
}

const clamp = (v, min, max) => Math.min(Math.max(v, min), max)

const MagazineBook = () => {
  const mountRef = useRef(null)

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
      // The ambient light is the global fill; dim it on its own so the shaped
      // key/point lights keep their contrast.
      o.intensity *= o.isAmbientLight ? Math.PI * AMBIENT_SCALE : Math.PI
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

    const resize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      if (!w || !h) return
      book.resize(w, h)
      book.setZoom(Math.min(1, w / h / SPREAD_ASPECT))
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(mount)

    // Spread 0 is the lone cover on the right; after that pages pair up.
    let pages = []
    let spread = 0
    let busy = false
    let drag = null
    const leftOf = (s) => pages[2 * s - 1] ?? null
    const rightOf = (s) => pages[2 * s] ?? null
    const lastSpread = () => Math.floor(pages.length / 2)

    const show = (s) => {
      book.showSpread(leftOf(s), rightOf(s))
      book.meshL.visible = !!leftOf(s)
      book.meshR.visible = !!rightOf(s)
    }

    // prepFlip hides the static page under the turning leaf, so the next spread's
    // page is put back there before the turn starts.
    const begin = (dir) => {
      const next = dir === 'fwd' ? spread + 1 : spread - 1
      if (dir === 'fwd') {
        book.showSpread(leftOf(spread), rightOf(next))
        book.prepFlip('fwd', rightOf(spread), leftOf(next))
        book.meshL.visible = !!leftOf(spread)
        book.meshR.visible = !!rightOf(next)
      } else {
        book.showSpread(leftOf(next), rightOf(spread))
        book.prepFlip('bwd', leftOf(spread), rightOf(next))
        book.meshL.visible = !!leftOf(next)
        book.meshR.visible = !!rightOf(spread)
      }
      return next
    }

    const settle = (dir, next, from, to) => {
      busy = true
      const duration = to === 1 ? Math.max(120, (1 - from) * FLIP_MS) : Math.max(80, from * 400)
      book.animate(from, to, duration, (p) => book.curl(p, dir), () => {
        if (!alive) return
        book.endFlip()
        if (to === 1) spread = next
        show(spread)
        busy = false
      })
    }

    const toLocal = (e) => {
      const r = canvas.getBoundingClientRect()
      return { x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 }
    }

    const onDown = (e) => {
      if (busy || !pages.length) return
      const { x } = toLocal(e)
      const dir = x > 0 ? 'fwd' : 'bwd'
      if (dir === 'fwd' && spread >= lastSpread()) return
      if (dir === 'bwd' && spread <= 0) return
      drag = { dir, startX: x, progress: 0, moved: false, next: begin(dir) }
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
      book.curl(drag.progress, drag.dir)
    }

    // A tap turns the page; a drag only commits past 30%.
    const onUp = () => {
      if (!drag) return
      const d = drag
      drag = null
      canvas.classList.remove('is-dragging')
      settle(d.dir, d.next, d.progress, !d.moved || d.progress > 0.3 ? 1 : 0)
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)

    buildPages().then((built) => {
      if (!alive) return
      pages = built
      show(spread)
    })

    return () => {
      alive = false
      observer.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      book.dispose()
      book.renderer.forceContextLoss()
      canvas.remove()
    }
  }, [])

  return <div ref={mountRef} className="magazine-book" />
}

export default MagazineBook
