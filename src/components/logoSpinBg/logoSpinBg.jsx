import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'
import './logoSpinBg.css'

// Same CORS logo path as the particle background (viewBox 64.3 x 29.42).
const LOGO_PATH =
  'M64.3,19.6c-6.17-.08-12.02-.4-17.34-.91.53.63.98,1.21,1.35,1.72.29.4.55.78.79,1.15,2.11,3.18,2.75,5.52,1.64,6.73-3.98,4.36-22.82-4-50.74-23.36,22.89,15.72,38.97,19.51,41.58,16.9.36-.37.55-.86.61-1.41.06-.48.03-1.03-.12-1.64-.05-.2-.11-.42-.2-.66-13.44-1.74-22.36-4.81-22.36-8.32C19.51,4.58,39.29.31,64.3,0c-13.14.25-24.48,2.1-30.88,4.76-3.52,1.47-5.54,3.2-5.54,5.04,0,2.97,5.29,5.64,13.66,7.44-1.34-3.21-4.69-8.68-8.12-12.48,4.46,4.12,9.85,9.57,13.08,13.39,5.24.81,11.3,1.33,17.8,1.45Z'
const VIEW_W = 64.3
const VIEW_H = 29.42

const LOGO_WORLD_WIDTH = 7
const INITIAL_ANGLE = (20 * Math.PI) / 180
const SPIN = 0.05
const CAMERA_Z = 4
const EXTRUDE = 0.2

const logoSpinBg = () => {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.z = CAMERA_Z

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}"><path d="${LOGO_PATH}"/></svg>`
    const shapes = new SVGLoader()
      .parse(svg)
      .paths.flatMap((path) => SVGLoader.createShapes(path))
    const geometry = new THREE.ExtrudeGeometry(shapes, {
      depth: EXTRUDE,
      bevelEnabled: false,
    })
    geometry.computeBoundingBox()
    const box = geometry.boundingBox
    geometry.translate(
      -(box.min.x + box.max.x) / 2,
      -(box.min.y + box.max.y) / 2,
      -EXTRUDE / 2
    )
    const scale = LOGO_WORLD_WIDTH / (box.max.x - box.min.x)

    const gray =
      getComputedStyle(document.documentElement).getPropertyValue('--color-gray').trim() ||
      '#ebebeb'
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(gray),
        side: THREE.DoubleSide,
      })
    )
    mesh.scale.set(scale, -scale, scale)

    const group = new THREE.Group()
    group.add(mesh)
    scene.add(group)

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
    let last = performance.now()
    let elapsed = 0
    const animate = (now) => {
      elapsed += Math.min(now - last, 34) / 1000
      last = now
      group.rotation.y = INITIAL_ANGLE + elapsed * SPIN
      renderer.render(scene, camera)
      frameId = requestAnimationFrame(animate)
    }
    mount.classList.add('is-ready')
    animate(performance.now())

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      geometry.dispose()
      mesh.material.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }
  }, [])

  return <div ref={mountRef} className="logo-spin-bg" />
}

export default logoSpinBg
