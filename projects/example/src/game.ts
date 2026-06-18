import {
  createFovPostprocessEffect,
  createGodotSpatialShaderPreprocessEffect,
  defineGame,
  defineRenderProcess,
} from "@internal/engine"
import {
  AmbientLight,
  AnimationMixer,
  Box3,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  Vector3,
} from "@internal/three"
import { exampleGameConfig } from "./config.ts"

export const exampleGameEffects = {
  fovDegrees: 60,
}

export const exampleGame = defineGame(exampleGameConfig, {
  createWorld: ({ assets }) => {
    const scene = new Scene()
    scene.background = new Color(0x080c10)
    scene.add(new AmbientLight(0x88aacc, 1.5))

    const key = new DirectionalLight(0xffffff, 3)
    key.position.set(2, 3, 4)
    scene.add(key)

    let femaleMixer: AnimationMixer | undefined

    void assets
      .loadGLTF("://assets/female.glb")
      .then((gltf) => {
        const model = gltf.scene
        const bounds = new Box3().setFromObject(model)
        const center = bounds.getCenter(new Vector3())
        const size = bounds.getSize(new Vector3())
        const scale = 2.2 / Math.max(size.x, size.y, size.z)
        model.scale.setScalar(scale)
        model.position.copy(center.multiplyScalar(-scale))
        scene.add(model)

        const idle = gltf.animations.find((clip) => clip.name === "Idle") ?? gltf.animations[0]
        if (!idle) {
          console.warn("Female model loaded without animation clips")
          return
        }

        femaleMixer = new AnimationMixer(model)
        femaleMixer.clipAction(idle).play()
      })
      .catch((cause: unknown) => {
        console.error("Failed to load female model", cause)
      })

    const camera = new PerspectiveCamera(exampleGameEffects.fovDegrees, 1, 0.1, 100)
    camera.position.set(0, 1.2, 4)
    camera.lookAt(0, 0, 0)

    return {
      camera,
      scene,
      preprocess: [
        createGodotSpatialShaderPreprocessEffect({
          sampler2D: {
            noise_tex: assets.loadTexture("://assets/noise_texture.webp"),
          },
          shader: assets.loadText("://assets/shaders/test.gdshader"),
        }),
        defineRenderProcess("example.female-idle-animation", ({ deltaSeconds }) => {
          femaleMixer?.update(deltaSeconds)
        }),
      ],
      postprocess: [
        createFovPostprocessEffect({
          camera,
          fov: () => exampleGameEffects.fovDegrees,
        }),
      ],
    }
  },
})
