import { defineGame, defineRenderProcess } from "@internal/engine"
import {
  AmbientLight,
  Box3,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
} from "@internal/three"
import { exampleGameConfig } from "./config.ts"

export const exampleGame = defineGame(exampleGameConfig, {
  createWorld: ({ assets }) => {
    const scene = new Scene()
    scene.background = new Color(0x080c10)
    scene.add(new AmbientLight(0x88aacc, 1.5))

    const key = new DirectionalLight(0xffffff, 3)
    key.position.set(2, 3, 4)
    scene.add(key)

    const cube = new Mesh(
      new BoxGeometry(1.4, 1.4, 1.4),
      new MeshStandardMaterial({ color: 0x4f9cff, metalness: 0.35, roughness: 0.3 }),
    )
    scene.add(cube)

    void assets
      .loadModel("://assets/adamHead/adamHead.gltf")
      .then((model) => {
        const bounds = new Box3().setFromObject(model)
        const center = bounds.getCenter(new Vector3())
        const size = bounds.getSize(new Vector3())
        const scale = 2.4 / Math.max(size.x, size.y, size.z)
        model.scale.setScalar(scale)
        model.position.copy(center.multiplyScalar(-scale))
        model.position.x = 2.2
        scene.add(model)
      })
      .catch((cause: unknown) => {
        console.error("Failed to load Adam head model", cause)
      })

    const camera = new PerspectiveCamera(60, 1, 0.1, 100)
    camera.position.set(4, 2.2, 4)
    camera.lookAt(cube.position)

    return {
      camera,
      scene,
      preprocess: [
        defineRenderProcess("example.cube-translation", ({ elapsedSeconds }) => {
          cube.position.y = Math.sin(elapsedSeconds * 1.8) * 0.85
          cube.rotation.x = elapsedSeconds * 0.35
          cube.rotation.y = elapsedSeconds * 0.55
        }),
        defineRenderProcess("example.camera-orbit", ({ elapsedSeconds }) => {
          const orbit = elapsedSeconds * 0.55
          camera.position.set(Math.cos(orbit) * 5, 2.4, Math.sin(orbit) * 5)
          camera.lookAt(cube.position)
        }),
      ],
    }
  },
})
