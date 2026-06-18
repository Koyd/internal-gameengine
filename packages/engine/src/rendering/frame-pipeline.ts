import {
  Camera,
  Clock,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderTarget,
  WebGLRenderer,
} from "@framework/three"

export interface FrameContext {
  readonly camera: Camera
  readonly deltaSeconds: number
  readonly elapsedSeconds: number
  readonly framebuffer: WebGLRenderTarget
  readonly renderer: WebGLRenderer
  readonly scene: Scene
}

export interface RenderProcess {
  readonly name: string
  readonly run: (context: FrameContext) => void
}

export const defineRenderProcess = (name: string, run: RenderProcess["run"]): RenderProcess => ({
  name,
  run,
})

export interface FramePipelineOptions {
  readonly camera: Camera
  readonly canvas: HTMLCanvasElement
  readonly postprocess?: ReadonlyArray<RenderProcess>
  readonly preprocess?: ReadonlyArray<RenderProcess>
  readonly scene: Scene
}

export class FramePipeline {
  readonly #camera: Camera
  readonly #clock = new Clock()
  readonly #postprocess: ReadonlyArray<RenderProcess>
  readonly #preprocess: ReadonlyArray<RenderProcess>
  readonly #presentCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  readonly #presentScene = new Scene()
  readonly #renderer: WebGLRenderer
  readonly #scene: Scene
  readonly #framebuffer: WebGLRenderTarget
  #frame: number | undefined

  constructor(options: FramePipelineOptions) {
    this.#camera = options.camera
    this.#postprocess = options.postprocess ?? []
    this.#preprocess = options.preprocess ?? []
    this.#renderer = new WebGLRenderer({ antialias: true, canvas: options.canvas })
    this.#scene = options.scene
    this.#framebuffer = new WebGLRenderTarget(1, 1)
    this.#presentScene.add(
      new Mesh(new PlaneGeometry(2, 2), new MeshBasicMaterial({ map: this.#framebuffer.texture })),
    )
  }

  start(): void {
    if (this.#frame !== undefined) return
    this.#clock.start()
    this.#frame = requestAnimationFrame(this.#render)
  }

  stop(): void {
    if (this.#frame === undefined) return
    cancelAnimationFrame(this.#frame)
    this.#frame = undefined
    this.#clock.stop()
  }

  resize(width: number, height: number, pixelRatio = window.devicePixelRatio): void {
    const renderWidth = Math.max(1, Math.floor(width * pixelRatio))
    const renderHeight = Math.max(1, Math.floor(height * pixelRatio))
    this.#renderer.setPixelRatio(pixelRatio)
    this.#renderer.setSize(width, height, false)
    this.#framebuffer.setSize(renderWidth, renderHeight)
  }

  dispose(): void {
    this.stop()
    this.#framebuffer.dispose()
    this.#renderer.dispose()
  }

  readonly #render = (): void => {
    const context: FrameContext = {
      camera: this.#camera,
      deltaSeconds: this.#clock.getDelta(),
      elapsedSeconds: this.#clock.elapsedTime,
      framebuffer: this.#framebuffer,
      renderer: this.#renderer,
      scene: this.#scene,
    }

    this.#renderer.setRenderTarget(this.#framebuffer)
    for (const process of this.#preprocess) process.run(context)
    this.#renderer.render(this.#scene, this.#camera)

    for (const process of this.#postprocess) process.run(context)

    this.#renderer.setRenderTarget(null)
    this.#renderer.render(this.#presentScene, this.#presentCamera)
    this.#frame = requestAnimationFrame(this.#render)
  }
}
