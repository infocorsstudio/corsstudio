import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { record } from '../../debug/perfLog'
import './HeroBackground.css'

// The CORS logo path (viewBox 64.3 x 29.42)
const LOGO_PATH =
  'M64.3,19.6c-6.17-.08-12.02-.4-17.34-.91.53.63.98,1.21,1.35,1.72.29.4.55.78.79,1.15,2.11,3.18,2.75,5.52,1.64,6.73-3.98,4.36-22.82-4-50.74-23.36,22.89,15.72,38.97,19.51,41.58,16.9.36-.37.55-.86.61-1.41.06-.48.03-1.03-.12-1.64-.05-.2-.11-.42-.2-.66-13.44-1.74-22.36-4.81-22.36-8.32C19.51,4.58,39.29.31,64.3,0c-13.14.25-24.48,2.1-30.88,4.76-3.52,1.47-5.54,3.2-5.54,5.04,0,2.97,5.29,5.64,13.66,7.44-1.34-3.21-4.69-8.68-8.12-12.48,4.46,4.12,9.85,9.57,13.08,13.39,5.24.81,11.3,1.33,17.8,1.45Z'
const VIEW_W = 64.3
const VIEW_H = 29.42

const MAX_PARTICLES = 3500 // buffers are allocated for this many
const TRAIL_MAX = 12 // max history samples per particle
const TRAIL_RESET_MS = 80 // a longer gap means the model jumped; drop the trail
const WARMUP_FRAMES = 4 // compile shaders before the gather clock starts
const MAX_FRAME_MS = 34 // a hitch must not skip the entrance animation
const GATHER_DURATION = 2.6
const ENTRANCE_DELAY = 0.5 // wait before particles start gathering
const GATHER_DELAY_MAX = 0.8 // per-particle random delay, added on top of ENTRANCE_DELAY
const SEG_MAX = TRAIL_MAX - 1
const LOGO_WORLD_WIDTH = 7 // world units the logo spans
const THICKNESS = 0.12 // z depth of the particle cloud
const MODEL_OFFSET_X = 2.7 // shift the whole model to the right

// Edge biasing: push particles toward the outline of the shape.
const EDGE_BIAS = 0.65 // 0 = uniform fill, 1 = only along the edges
const EDGE_THICKNESS = 4 // raster pixels counted as the "edge band"

// Mouse repulsion
const REPEL_RADIUS = 0.18 // in NDC (screen) space
const REPEL_STRENGTH = 1.2 // world units pushed at the mouse center
const SWIRL_SPEED = 1.4 // how fast repelled particles orbit the mouse

// Initial angle the model faces at load (degrees), around the Y axis.
const INITIAL_ANGLE_DEG = 275 // e.g. 30, 90, 180
const INITIAL_ANGLE = (INITIAL_ANGLE_DEG * Math.PI) / 180

const CAMERA_Z = 10
const CAMERA_ZOOM_Z = 4 // z when the scatter finishes (smaller = closer)
// Same inertia as the hero intro onScroll sync (0.4): lower = more lag
const SCATTER_SYNC = 0.5

// Subtle camera parallax following the mouse
const PARALLAX_X = 0.05 // world units the camera drifts horizontally
const PARALLAX_Y = 0.02 // world units the camera drifts vertically
const PARALLAX_EASE = 0.05 // smoothing (smaller = slower follow)

// Live-tunable defaults (exposed as debug sliders)
const DEFAULTS = {
  trailLen: 5,
  count: 1000,
  size: 0.1,
  opacity: 1,
  dodge: 0.04,
}

// Sample points that fill the logo shape by rasterizing the path.
const sampleLogoPoints = (count) => {
  const scale = 10
  const w = Math.round(VIEW_W * scale)
  const h = Math.round(VIEW_H * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)
  ctx.fillStyle = '#fff'
  ctx.fill(new Path2D(LOGO_PATH))

  const { data } = ctx.getImageData(0, 0, w, h)
  const isOpaque = (x, y) =>
    x >= 0 && x < w && y >= 0 && y < h && data[(y * w + x) * 4 + 3] > 128

  // Split opaque pixels into an edge band and the interior fill.
  const edge = []
  const fill = []
  const R = EDGE_THICKNESS
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isOpaque(x, y)) continue
      let onEdge = false
      for (let dy = -R; dy <= R && !onEdge; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          if (!isOpaque(x + dx, y + dy)) {
            onEdge = true
            break
          }
        }
      }
      ;(onEdge ? edge : fill).push([x, y])
    }
  }

  const worldScale = LOGO_WORLD_WIDTH / w
  const pts = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const useEdge =
      edge.length && (fill.length === 0 || Math.random() < EDGE_BIAS)
    const pool = useEdge ? edge : fill
    const [px, py] = pool[(Math.random() * pool.length) | 0]
    pts[i * 3] = (px - w / 2) * worldScale
    pts[i * 3 + 1] = (h / 2 - py) * worldScale
    pts[i * 3 + 2] = (Math.random() - 0.5) * THICKNESS
  }
  return pts
}

// A solid triangle sprite for each particle.
const makeTriangleTexture = () => {
  const s = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = s
  const ctx = canvas.getContext('2d')
  // Equilateral triangle inscribed in a circle of radius 0.48*s, centered.
  // Staying inside the center circle means any rotation never clips to a polygon.
  const R = s * 0.48
  const cx = s / 2
  const cy = s / 2
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  for (let k = 0; k < 3; k++) {
    const th = -Math.PI / 2 + (k * 2 * Math.PI) / 3
    const x = cx + R * Math.cos(th)
    const y = cy + R * Math.sin(th)
    if (k === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  // Keep the triangle alpha mask but force all RGB to white,
  // so edge interpolation never bleeds black (no dark outline).
  const img = ctx.getImageData(0, 0, s, s)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255
    d[i + 1] = 255
    d[i + 2] = 255
  }
  ctx.putImageData(img, 0, 0)
  return new THREE.CanvasTexture(canvas)
}

// Matches anime.js out(4): 1 - (1 - t)^4 (same curve as the header entrance)
const easeOut4 = (t) => 1 - Math.pow(1 - t, 4)

const HeroBackground = () => {
  const mountRef = useRef(null)
  const cfgRef = useRef({ ...DEFAULTS })

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.z = CAMERA_Z

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const styles = getComputedStyle(document.documentElement)
    // Particle color is independent from the site theme color.
    const themeColor = new THREE.Color('#ff0000')
    const bgColor = new THREE.Color(
      styles.getPropertyValue('--color-background').trim() || '#fcfcfc'
    )
    renderer.setClearColor(bgColor, 0)

    // Allocate everything for MAX_PARTICLES; use draw ranges to show a subset.
    const sampleStart = performance.now()
    const targets = sampleLogoPoints(MAX_PARTICLES)
    record('logo-sample', performance.now() - sampleStart)
    const starts = new Float32Array(MAX_PARTICLES * 3)
    const delays = new Float32Array(MAX_PARTICLES)
    const spins = new Float32Array(MAX_PARTICLES)
    const phases = new Float32Array(MAX_PARTICLES)
    const rotations = new Float32Array(MAX_PARTICLES) // per-triangle random angle
    const positions = new Float32Array(MAX_PARTICLES * 3)
    for (let i = 0; i < MAX_PARTICLES; i++) {
      starts[i * 3] = (Math.random() - 0.5) * 24
      starts[i * 3 + 1] = (Math.random() - 0.5) * 18
      starts[i * 3 + 2] = (Math.random() - 0.5) * 18
      delays[i] = Math.random() * GATHER_DELAY_MAX
      spins[i] = (Math.random() * 2 - 1) * SWIRL_SPEED
      phases[i] = Math.random() * Math.PI * 2
      rotations[i] = Math.random() * Math.PI * 2
      positions[i * 3] = starts[i * 3]
      positions[i * 3 + 1] = starts[i * 3 + 1]
      positions[i * 3 + 2] = starts[i * 3 + 2]
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aRotation', new THREE.BufferAttribute(rotations, 1))

    const circleTex = makeTriangleTexture()
    const material = new THREE.PointsMaterial({
      color: themeColor,
      map: circleTex,
      size: cfgRef.current.size,
      sizeAttenuation: true,
      transparent: true,
      opacity: cfgRef.current.opacity,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })
    // Inject per-particle rotation so each triangle has a random orientation.
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute float aRotation;\nvarying float vRotation;'
        )
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvRotation = aRotation;'
        )
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying float vRotation;'
        )
        .replace(
          '#include <map_particle_fragment>',
          [
            '#if defined( USE_MAP ) || defined( USE_ALPHAMAP )',
            '  vec2 pc = gl_PointCoord - 0.5;',
            '  float cr = cos( vRotation ); float sr = sin( vRotation );',
            '  pc = vec2( cr * pc.x - sr * pc.y, sr * pc.x + cr * pc.y ) + 0.5;',
            '  float inside = step( 0.0, pc.x ) * step( pc.x, 1.0 ) * step( 0.0, pc.y ) * step( pc.y, 1.0 );',
            '  vec2 uv = ( uvTransform * vec3( pc.x, 1.0 - pc.y, 1 ) ).xy;',
            '#endif',
            '#ifdef USE_MAP',
            '  diffuseColor *= texture2D( map, uv );',
            '  diffuseColor.a *= inside;',
            '#endif',
            '#ifdef USE_ALPHAMAP',
            '  diffuseColor.a *= texture2D( alphaMap, uv ).g;',
            '#endif',
          ].join('\n')
        )
    }

    const points = new THREE.Points(geometry, material)
    const group = new THREE.Group()
    group.position.x = MODEL_OFFSET_X
    group.add(points)
    scene.add(group)

    // Comet trails (world space, outside the rotating group)
    const trailPos = new Float32Array(MAX_PARTICLES * SEG_MAX * 2 * 3)
    const trailCol = new Float32Array(MAX_PARTICLES * SEG_MAX * 2 * 3)
    const trailGeo = new THREE.BufferGeometry()
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3))
    trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3))
    const trailMat = new THREE.LineBasicMaterial({ vertexColors: true })
    const trails = new THREE.LineSegments(trailGeo, trailMat)
    scene.add(trails)

    // Per-depth color (head = theme, tail fades to background). Recomputed on change.
    const depthColor = new Float32Array(TRAIL_MAX * 3)
    let cachedTrailLen = -1
    const buildDepthColor = (trailLen) => {
      for (let d = 0; d < trailLen; d++) {
        const fade = 1 - d / trailLen
        depthColor[d * 3] = bgColor.r + (themeColor.r - bgColor.r) * fade
        depthColor[d * 3 + 1] = bgColor.g + (themeColor.g - bgColor.g) * fade
        depthColor[d * 3 + 2] = bgColor.b + (themeColor.b - bgColor.b) * fade
      }
      cachedTrailLen = trailLen
    }

    // World-space position history ring, init at the rotated start pose
    // so the first frames don't connect unrotated points into long streaks.
    const history = new Float32Array(MAX_PARTICLES * TRAIL_MAX * 3)
    const cos0 = Math.cos(INITIAL_ANGLE)
    const sin0 = Math.sin(INITIAL_ANGLE)
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const fx = starts[i * 3]
      const fy = starts[i * 3 + 1]
      const fz = starts[i * 3 + 2]
      const wx = fx * cos0 + fz * sin0 + MODEL_OFFSET_X
      const wz = -fx * sin0 + fz * cos0
      for (let s = 0; s < TRAIL_MAX; s++) {
        const h3 = (i * TRAIL_MAX + s) * 3
        history[h3] = wx
        history[h3 + 1] = fy
        history[h3 + 2] = wz
      }
    }
    let histHead = 0
    let trailReset = false
    let lastFrame = performance.now()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') trailReset = true
    }
    document.addEventListener('visibilitychange', onVisibility)

    const resize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    window.addEventListener('resize', resize)

    const mouse = { x: 0, y: 0, active: false }
    const onPointerMove = (e) => {
      const rect = mount.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      mouse.active = true
    }
    const onPointerLeave = () => {
      mouse.active = false
    }
    window.addEventListener('pointermove', onPointerMove)
    mount.addEventListener('pointerleave', onPointerLeave)

    // Scatter, fade, and zoom once section 2's top travels from mid-viewport to the top.
    // target is the raw scroll progress; scatter eases toward it each frame.
    const scatterTarget = { value: 0 }
    const scatter = { value: 0 }
    const section2 = document.querySelector('.home-section-2')
    const updateScatter = () => {
      if (!section2) return
      const top = section2.getBoundingClientRect().top
      const start = window.innerHeight * 0.5
      scatterTarget.value = Math.min(Math.max((start - top) / start, 0), 1)
    }
    updateScatter()
    window.addEventListener('scroll', updateScatter, { passive: true })

    const posAttr = geometry.getAttribute('position')
    const repel = new Float32Array(MAX_PARTICLES * 3)
    const proj = new THREE.Vector3()
    const gatherDoneAt = ENTRANCE_DELAY + GATHER_DELAY_MAX + GATHER_DURATION
    let animTime = 0
    let warmed = 0
    let frameId

    const animate = () => {
      const frameStart = performance.now()
      const cfg = cfgRef.current
      const count = Math.min(cfg.count | 0, MAX_PARTICLES)
      const trailLen = Math.min(Math.max(cfg.trailLen | 0, 2), TRAIL_MAX)
      const seg = trailLen - 1
      const dodge = cfg.dodge
      material.size = cfg.size
      material.opacity = cfg.opacity
      if (trailLen !== cachedTrailLen) buildDepthColor(trailLen)

      // Anime.js sync smoothing: lerp factor is lerp(0.01, 0.2, sync) per frame.
      const scatterStep = 0.01 + 0.19 * SCATTER_SYNC
      scatter.value += (scatterTarget.value - scatter.value) * scatterStep
      if (Math.abs(scatterTarget.value - scatter.value) < 0.0005) {
        scatter.value = scatterTarget.value
      }
      renderer.domElement.style.opacity =
        scatter.value > 0 ? String(1 - scatter.value) : ''

      const now = performance.now()
      const frameMs = now - lastFrame
      lastFrame = now
      if (frameMs > TRAIL_RESET_MS) trailReset = true

      // Hold the gather clock through shader warmup, and don't let one long
      // frame skip ahead through the entrance.
      if (warmed < WARMUP_FRAMES) {
        warmed += 1
        if (warmed === WARMUP_FRAMES) mount.classList.add('is-ready')
      } else {
        animTime += Math.min(frameMs, MAX_FRAME_MS)
      }
      const t = animTime / 1000
      const interactionOn = t >= gatherDoneAt
      const a = INITIAL_ANGLE + t * 0.3
      const cosA = Math.cos(a)
      const sinA = Math.sin(a)
      const aspect = camera.aspect
      const arr = posAttr.array

      // Camera parallax: drift toward the mouse, ease back to center on leave.
      const camTX = interactionOn && mouse.active ? mouse.x * PARALLAX_X : 0
      const camTY = interactionOn && mouse.active ? mouse.y * PARALLAX_Y : 0
      camera.position.x += (camTX - camera.position.x) * PARALLAX_EASE
      camera.position.y += (camTY - camera.position.y) * PARALLAX_EASE
      camera.position.z = CAMERA_Z + (CAMERA_ZOOM_Z - CAMERA_Z) * scatter.value
      camera.updateMatrixWorld() // keep projection fresh for repulsion below

      histHead = (histHead + 1) % TRAIL_MAX

      for (let i = 0; i < count; i++) {
        const i3 = i * 3
        const p = Math.min(
          Math.max((t - ENTRANCE_DELAY - delays[i]) / GATHER_DURATION, 0),
          1
        )
        const e = easeOut4(p) * (1 - scatter.value)
        const bx = starts[i3] + (targets[i3] - starts[i3]) * e
        const by = starts[i3 + 1] + (targets[i3 + 1] - starts[i3 + 1]) * e
        const bz = starts[i3 + 2] + (targets[i3 + 2] - starts[i3 + 2]) * e

        let ox = 0
        let oy = 0
        let oz = 0
        if (interactionOn && mouse.active) {
          const wx = bx * cosA + bz * sinA + MODEL_OFFSET_X
          const wz = -bx * sinA + bz * cosA
          proj.set(wx, by, wz).project(camera)
          let dx = (proj.x - mouse.x) * aspect
          const dy = proj.y - mouse.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < REPEL_RADIUS && dist > 0.0001) {
            const force = (1 - dist / REPEL_RADIUS) * REPEL_STRENGTH
            const dirAngle = Math.atan2(dy, dx) + phases[i] + t * spins[i]
            const pushX = Math.cos(dirAngle) * force
            const pushY = Math.sin(dirAngle) * force
            ox = pushX * cosA
            oy = pushY
            oz = pushX * sinA
          }
        }
        repel[i3] += (ox - repel[i3]) * dodge
        repel[i3 + 1] += (oy - repel[i3 + 1]) * dodge
        repel[i3 + 2] += (oz - repel[i3 + 2]) * dodge

        const fx = bx + repel[i3]
        const fy = by + repel[i3 + 1]
        const fz = bz + repel[i3 + 2]
        arr[i3] = fx
        arr[i3 + 1] = fy
        arr[i3 + 2] = fz

        const wx = fx * cosA + fz * sinA + MODEL_OFFSET_X
        const wz = -fx * sinA + fz * cosA
        if (trailReset) {
          const base = i * TRAIL_MAX * 3
          for (let s = 0; s < TRAIL_MAX; s++) {
            const o = base + s * 3
            history[o] = wx
            history[o + 1] = fy
            history[o + 2] = wz
          }
        } else {
          const h3 = (i * TRAIL_MAX + histHead) * 3
          history[h3] = wx
          history[h3 + 1] = fy
          history[h3 + 2] = wz
        }
      }
      trailReset = false
      posAttr.needsUpdate = true
      geometry.setDrawRange(0, count)

      // Build comet trails for active particles; unused segments are degenerate.
      for (let i = 0; i < count; i++) {
        const hBase = i * TRAIL_MAX
        const vBase = i * SEG_MAX * 2 * 3
        const headH = (hBase + histHead) * 3
        for (let k = 0; k < SEG_MAX; k++) {
          const v = vBase + k * 6
          if (k < seg) {
            const sNew = (histHead - k + TRAIL_MAX) % TRAIL_MAX
            const sOld = (histHead - k - 1 + TRAIL_MAX) % TRAIL_MAX
            const nh = (hBase + sNew) * 3
            const oh = (hBase + sOld) * 3
            trailPos[v] = history[nh]
            trailPos[v + 1] = history[nh + 1]
            trailPos[v + 2] = history[nh + 2]
            trailPos[v + 3] = history[oh]
            trailPos[v + 4] = history[oh + 1]
            trailPos[v + 5] = history[oh + 2]
            const cN = k * 3
            const cO = (k + 1) * 3
            trailCol[v] = depthColor[cN]
            trailCol[v + 1] = depthColor[cN + 1]
            trailCol[v + 2] = depthColor[cN + 2]
            trailCol[v + 3] = depthColor[cO]
            trailCol[v + 4] = depthColor[cO + 1]
            trailCol[v + 5] = depthColor[cO + 2]
          } else {
            // degenerate (zero-length) segment -> invisible
            trailPos[v] = history[headH]
            trailPos[v + 1] = history[headH + 1]
            trailPos[v + 2] = history[headH + 2]
            trailPos[v + 3] = history[headH]
            trailPos[v + 4] = history[headH + 1]
            trailPos[v + 5] = history[headH + 2]
          }
        }
      }
      trailGeo.attributes.position.needsUpdate = true
      trailGeo.attributes.color.needsUpdate = true
      trailGeo.setDrawRange(0, count * SEG_MAX * 2)

      group.rotation.y = a
      renderer.render(scene, camera)
      record('particles', performance.now() - frameStart)
      frameId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', updateScatter)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pointermove', onPointerMove)
      mount.removeEventListener('pointerleave', onPointerLeave)
      geometry.dispose()
      material.dispose()
      circleTex.dispose()
      trailGeo.dispose()
      trailMat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }
  }, [])

  return <div ref={mountRef} className="hero-background" />
}

export default HeroBackground
