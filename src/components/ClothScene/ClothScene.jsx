import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { record } from '../../debug/perfLog'
import { ParametricGeometry } from 'three/examples/jsm/geometries/ParametricGeometry.js'
import './ClothScene.css'

// Live-tunable defaults (exposed as debug controls)
const DEFAULT_WIND = 0.2 // ambient wind strength (when pointer is away)
const MOUSE_WIND = 3 // localized wind strength at the pointer
const MOUSE_RADIUS = 100 // local-space radius affected around the pointer hit
const HIT_GRACE_MS = 150 // keep "hovering" this long after the last ray hit (anti-flicker)
const DEFAULT_DISTANCE = 300 // camera distance on z (fixed)
const DEFAULT_FOCAL = 25 // camera focal length (mm)
const DEFAULT_CLOTH_SCALE_X = 1 // cloth width multiplier
const DEFAULT_CLOTH_SCALE_Y = 1 // cloth height multiplier (initial, before texture loads)
const HEIGHT_GRAVITY_COMP = 0.7 // shrink height a bit to offset gravity stretch (<1)
const DEFAULT_STIFFNESS = 1 // constraint stiffness (0 = soft, 1 = fully rigid)
const TOP_ANCHOR_Y = 40 // vertical world offset of the fixed top edge (+ up / - down)

// --- Cloth simulation constants (verlet integration) ---
const DAMPING = 0.04
const DRAG = 1 - DAMPING
const MASS = 0.1
const restDistance = 16
const xSegs = 20
const ySegs = 16
const clothWidth = restDistance * xSegs
const clothHeight = restDistance * ySegs

const GRAVITY = 981 * 1.4
const TIMESTEP = 18 / 1000
const TIMESTEP_SQ = TIMESTEP * TIMESTEP

// Plane centered on the origin so the camera can face it head-on.
const clothFunction = (u, v, target) => {
  const x = (u - 0.5) * clothWidth
  const y = (v - 0.5) * clothHeight
  target.set(x, y, 0)
}

class Particle {
  constructor(u, v, mass) {
    this.position = new THREE.Vector3()
    this.previous = new THREE.Vector3()
    this.original = new THREE.Vector3()
    this.a = new THREE.Vector3(0, 0, 0)
    this.mass = mass
    this.invMass = 1 / mass
    this.tmp = new THREE.Vector3()
    this.tmp2 = new THREE.Vector3()
    clothFunction(u, v, this.position)
    clothFunction(u, v, this.previous)
    clothFunction(u, v, this.original)
  }

  addForce(force) {
    this.a.add(this.tmp2.copy(force).multiplyScalar(this.invMass))
  }

  integrate(timesq) {
    const newPos = this.tmp.subVectors(this.position, this.previous)
    newPos.multiplyScalar(DRAG).add(this.position)
    newPos.add(this.a.multiplyScalar(timesq))
    this.tmp = this.previous
    this.previous = this.position
    this.position = newPos
    this.a.set(0, 0, 0)
  }
}

const index = (u, v) => u + v * (xSegs + 1)

const buildCloth = () => {
  const particles = []
  const constraints = []
  for (let v = 0; v <= ySegs; v++) {
    for (let u = 0; u <= xSegs; u++) {
      particles.push(new Particle(u / xSegs, v / ySegs, MASS))
    }
  }
  // Structural constraints
  for (let v = 0; v < ySegs; v++) {
    for (let u = 0; u < xSegs; u++) {
      constraints.push([particles[index(u, v)], particles[index(u, v + 1)], restDistance])
      constraints.push([particles[index(u, v)], particles[index(u + 1, v)], restDistance])
    }
  }
  for (let v = 0; v < ySegs; v++) {
    constraints.push([particles[index(xSegs, v)], particles[index(xSegs, v + 1)], restDistance])
  }
  for (let u = 0; u < xSegs; u++) {
    constraints.push([particles[index(u, ySegs)], particles[index(u + 1, ySegs)], restDistance])
  }
  return { particles, constraints }
}

const satisfyConstraint = (p1, p2, distance, diff, stiffness) => {
  diff.subVectors(p2.position, p1.position)
  const currentDist = diff.length()
  if (currentDist === 0) return
  const correction = diff.multiplyScalar((1 - distance / currentDist) * stiffness)
  const half = correction.multiplyScalar(0.5)
  p1.position.add(half)
  p2.position.sub(half)
}

const ClothScene = () => {
  const mountRef = useRef(null)

  // Cloth height scale, derived from the texture aspect ratio (set on image load).
  const autoScaleYRef = useRef(DEFAULT_CLOTH_SCALE_Y)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000)
    camera.position.set(0, 0, DEFAULT_DISTANCE)
    camera.setFocalLength(DEFAULT_FOCAL)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    // Lights so the cloth surface reads clearly.
    scene.add(new THREE.AmbientLight(0xffffff, 1.2))
    const dir = new THREE.DirectionalLight(0xffffff, 1.4)
    dir.position.set(0, 1, 1)
    scene.add(dir)

    // Cloth mesh
    const clothGeometry = new ParametricGeometry(clothFunction, xSegs, ySegs)
    const clothTexture = new THREE.TextureLoader().load(
      '/assets/works/issue001/issue001_main_hero.jpg',
      (tex) => {
        // Match the cloth's rendered aspect ratio to the image so it isn't distorted.
        const img = tex.image
        if (img && img.width) {
          const imgRatio = img.height / img.width
          autoScaleYRef.current =
            imgRatio * (clothWidth / clothHeight) * HEIGHT_GRAVITY_COMP
        }
      }
    )
    clothTexture.colorSpace = THREE.SRGBColorSpace
    const material = new THREE.MeshPhongMaterial({
      map: clothTexture,
      side: THREE.FrontSide, // only the face toward the camera
      flatShading: false,
      shininess: 20,
    })
    const clothMesh = new THREE.Mesh(clothGeometry, material)
    scene.add(clothMesh)

    // --- Debug wireframe indicators (temporarily disabled) ---
    // // Ambient wind direction (cyan): a small wireframe sphere + arrow.
    // const windIndicator = new THREE.Group()
    // const windSphereGeo = new THREE.SphereGeometry(20, 12, 8)
    // const windSphereMat = new THREE.MeshBasicMaterial({
    //   color: 0x00ffff,
    //   wireframe: true,
    // })
    // windIndicator.add(new THREE.Mesh(windSphereGeo, windSphereMat))
    // const windArrow = new THREE.ArrowHelper(
    //   new THREE.Vector3(0, 0, -1),
    //   new THREE.Vector3(0, 0, 0),
    //   70,
    //   0x00ffff
    // )
    // windIndicator.add(windArrow)
    // windIndicator.position.set(-clothWidth * 0.22, clothHeight * 0.5, 60)
    // scene.add(windIndicator)

    // // Mouse-affected region (lime): wireframe sphere; child of the cloth so it
    // // inherits the cloth scale and matches the actual affected area.
    // const mouseSphereGeo = new THREE.SphereGeometry(MOUSE_RADIUS, 16, 12)
    // const mouseSphereMat = new THREE.MeshBasicMaterial({
    //   color: 0x00ff00,
    //   wireframe: true,
    //   depthTest: false, // always draw on top, avoids z-fighting with the cloth
    //   depthWrite: false,
    // })
    // const mouseSphere = new THREE.Mesh(mouseSphereGeo, mouseSphereMat)
    // mouseSphere.visible = false
    // clothMesh.add(mouseSphere)

    const { particles, constraints } = buildCloth()

    const gravity = new THREE.Vector3(0, -GRAVITY, 0).multiplyScalar(MASS)
    const windForce = new THREE.Vector3()
    // const windDir = new THREE.Vector3() // only used by the (disabled) wind indicator
    const tmpForce = new THREE.Vector3()
    const normal = new THREE.Vector3()
    const diff = new THREE.Vector3()

    // Pointer raycasting onto the cloth surface.
    const pointer = new THREE.Vector2()
    let pointerActive = false
    let lastHitMs = -Infinity // timestamp of the last successful ray hit (for grace buffer)
    const raycaster = new THREE.Raycaster()
    const localHit = new THREE.Vector3()

    const onPointerMove = (e) => {
      const rect = mount.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      pointerActive = true
    }
    const onPointerLeave = () => {
      pointerActive = false
    }
    mount.addEventListener('pointermove', onPointerMove)
    mount.addEventListener('pointerleave', onPointerLeave)

    const simulate = (now) => {
      const baseStrength = Math.cos(now / 7000) * 20 + 45

      // Raycast the pointer onto the cloth. Because the cloth is always moving,
      // the ray hits/misses intermittently; a grace buffer keeps the state stable.
      if (pointerActive) {
        clothMesh.updateMatrixWorld()
        raycaster.setFromCamera(pointer, camera)
        const hits = raycaster.intersectObject(clothMesh)
        if (hits.length) {
          lastHitMs = now
          localHit.copy(hits[0].point)
          clothMesh.worldToLocal(localHit) // localHit persists between misses
        }
      }
      // Stay "hovering" for a short grace period after the last hit (anti-flicker).
      const hovering = pointerActive && now - lastHitMs < HIT_GRACE_MS

      // // Update the mouse-region indicator.
      // mouseSphere.visible = hovering
      // if (hovering) mouseSphere.position.copy(localHit)

      // Ambient random wind is always on, applied along each vertex normal.
      const ambientStrength = baseStrength * DEFAULT_WIND
      windForce
        .set(
          Math.sin(now / 2000) * 1.5,
          Math.cos(now / 3000) * 1.5,
          -(Math.sin(now / 1000) + 0.6) * 0.4
        )
        .normalize()
        .multiplyScalar(ambientStrength)

      // // Update the ambient wind direction indicator.
      // windDir.copy(windForce).normalize()
      // windArrow.setDirection(windDir)

      const indices = clothGeometry.index
      const normals = clothGeometry.attributes.normal
      for (let i = 0, il = indices.count; i < il; i += 3) {
        for (let j = 0; j < 3; j++) {
          const idx = indices.getX(i + j)
          normal.fromBufferAttribute(normals, idx)
          tmpForce.copy(normal).normalize().multiplyScalar(normal.dot(windForce))
          particles[idx].addForce(tmpForce)
        }
      }

      // On top of the ambient wind, add a localized gust at the pointer.
      if (hovering) {
        const strength = baseStrength * MOUSE_WIND
        const r2 = MOUSE_RADIUS * MOUSE_RADIUS
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]
          const dx = p.position.x - localHit.x
          const dy = p.position.y - localHit.y
          const dz = p.position.z - localHit.z
          const d2 = dx * dx + dy * dy + dz * dz
          if (d2 < r2) {
            const falloff = 1 - Math.sqrt(d2) / MOUSE_RADIUS
            tmpForce.set(0, 0, -1).multiplyScalar(strength * falloff)
            p.addForce(tmpForce)
          }
        }
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.addForce(gravity)
        p.integrate(TIMESTEP_SQ)
      }

      for (let i = 0; i < constraints.length; i++) {
        const c = constraints[i]
        satisfyConstraint(c[0], c[1], c[2], diff, DEFAULT_STIFFNESS)
      }

      // Pin the top row so the cloth hangs and flutters.
      for (let u = 0; u <= xSegs; u++) {
        const p = particles[index(u, ySegs)]
        p.position.copy(p.original)
        p.previous.copy(p.original)
      }
    }

    const resize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    window.addEventListener('resize', resize)

    let frameId
    const positionAttribute = clothGeometry.attributes.position

    const animate = (now) => {
      const frameStart = performance.now()
      // Height comes from the texture aspect ratio; scales from the TOP edge.
      const sy = autoScaleYRef.current
      clothMesh.scale.set(DEFAULT_CLOTH_SCALE_X, sy, 1)
      clothMesh.position.y = TOP_ANCHOR_Y - ((sy - 1) * clothHeight) / 2

      simulate(now)
      for (let i = 0; i < particles.length; i++) {
        const v = particles[i].position
        positionAttribute.setXYZ(i, v.x, v.y, v.z)
      }
      positionAttribute.needsUpdate = true
      clothGeometry.computeVertexNormals()
      clothGeometry.computeBoundingSphere() // keep raycasting in sync with the moving cloth
      renderer.render(scene, camera)
      record('cloth', performance.now() - frameStart)
      frameId = requestAnimationFrame(animate)
    }
    animate(performance.now())

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      mount.removeEventListener('pointermove', onPointerMove)
      mount.removeEventListener('pointerleave', onPointerLeave)
      clothGeometry.dispose()
      clothTexture.dispose()
      material.dispose()
      // windSphereGeo.dispose()
      // windSphereMat.dispose()
      // windArrow.dispose()
      // mouseSphereGeo.dispose()
      // mouseSphereMat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div className="cloth-scene">
      <div ref={mountRef} className="cloth-canvas" />
    </div>
  )
}

export default ClothScene
