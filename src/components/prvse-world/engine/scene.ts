/**
 * Scene — Three.js scene, camera, renderer setup
 *
 * Orthographic-like perspective camera for the "space" feel.
 * Handles resize, render loop, and cleanup.
 */

import * as THREE from 'three'
import { BG_COLOR } from '../constants'

export interface SceneContext {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  raycaster: THREE.Raycaster
  mouse: THREE.Vector2
  clock: THREE.Clock
  /** The group holding all PRVSE entities */
  worldGroup: THREE.Group
  /** Start the render loop */
  start: () => void
  /** Stop the render loop and dispose */
  dispose: () => void
  /** Resize to container */
  resize: (w: number, h: number) => void
}

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(BG_COLOR)

  // Very subtle fog — low density so labels stay readable at all zoom levels
  scene.fog = new THREE.FogExp2(BG_COLOR, 0.0003)

  const camera = new THREE.PerspectiveCamera(50, 1, 1, 5000)
  // Initial position will be set by zoom-engine's tickZoom on first frame
  camera.position.set(0, -400, 500)
  camera.lookAt(0, 0, 0)

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace

  // Ambient light — slightly blue-tinted for cyberpunk feel
  const ambient = new THREE.AmbientLight(0x8899bb, 0.5)
  scene.add(ambient)
  // Directional — warm key light from top-right
  const directional = new THREE.DirectionalLight(0xffffff, 0.5)
  directional.position.set(100, 200, 300)
  scene.add(directional)
  // Subtle fill from below — neon bounce
  const fill = new THREE.DirectionalLight(0x4466ff, 0.15)
  fill.position.set(-50, -100, 100)
  scene.add(fill)

  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()
  const clock = new THREE.Clock()

  // Ground reference grid for depth perception
  // Ground reference grid for depth perception
  const gridHelper = new THREE.GridHelper(800, 20, 0x111122, 0x111122)
  gridHelper.position.z = -60
  gridHelper.rotation.x = Math.PI / 2 // rotate to XY plane
  const gridMats = Array.isArray(gridHelper.material) ? gridHelper.material : [gridHelper.material]
  gridMats.forEach(m => { m.transparent = true; m.opacity = 0.08; m.depthWrite = false })
  scene.add(gridHelper)

  const worldGroup = new THREE.Group()
  scene.add(worldGroup)

  let animId = 0
  let onFrame: (() => void) | null = null

  function loop() {
    animId = requestAnimationFrame(loop)
    onFrame?.()
    renderer.render(scene, camera)
  }

  return {
    scene,
    camera,
    renderer,
    raycaster,
    mouse,
    clock,
    worldGroup,

    start() {
      loop()
    },

    dispose() {
      cancelAnimationFrame(animId)
      renderer.dispose()
      scene.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose()
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose())
          } else {
            obj.material.dispose()
          }
        }
      })
    },

    resize(w: number, h: number) {
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    },
  }
}
