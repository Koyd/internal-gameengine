import {
  Color,
  Material,
  Mesh,
  PerspectiveCamera,
  type Camera,
  type WebGLRenderer,
} from "@framework/three"
import { defineRenderProcess, type FrameContext, type RenderProcess } from "./frame-pipeline.ts"

type EffectValue = number | ((context: FrameContext) => number)

export interface ExampleShaderPreprocessEffectOptions {
  readonly intensity?: EffectValue
  readonly name?: string
  readonly tint?: number
}

interface ExampleShaderUniforms {
  readonly intensity: { value: number }
  readonly time: { value: number }
  readonly tint: { value: Color }
}

type ShaderParameters = Parameters<Material["onBeforeCompile"]>[0]

export const createExampleShaderPreprocessEffect = (
  options: ExampleShaderPreprocessEffectOptions = {},
): RenderProcess => {
  const name = options.name ?? "engine.preprocess.example-shader"
  const intensity = options.intensity ?? 0.18
  const tint = new Color(options.tint ?? 0x3aa7ff)
  const installedMaterials = new WeakSet<Material>()
  const shaderUniforms = new Set<ExampleShaderUniforms>()

  return defineRenderProcess(name, (context) => {
    context.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!installedMaterials.has(material)) {
          const uniforms = installExampleShader(material, name, tint)
          installedMaterials.add(material)
          shaderUniforms.add(uniforms)
        }
      }
    })

    const resolvedIntensity = resolveEffectValue(intensity, context)
    for (const uniforms of shaderUniforms) {
      uniforms.time.value = context.elapsedSeconds
      uniforms.intensity.value = resolvedIntensity
    }
  })
}

export interface FovPostprocessEffectOptions {
  readonly camera?: Camera
  readonly fov: EffectValue
  readonly max?: number
  readonly min?: number
  readonly name?: string
}

export const createFovPostprocessEffect = (options: FovPostprocessEffectOptions): RenderProcess =>
  defineRenderProcess(options.name ?? "engine.postprocess.fov", (context) => {
    const camera = options.camera ?? context.camera
    if (!(camera instanceof PerspectiveCamera)) return

    const min = options.min ?? 35
    const max = options.max ?? 95
    const fov = Math.min(max, Math.max(min, resolveEffectValue(options.fov, context)))
    if (Math.abs(camera.fov - fov) < 0.001) return

    camera.fov = fov
    camera.updateProjectionMatrix()
  })

const installExampleShader = (
  material: Material,
  effectName: string,
  tint: Color,
): ExampleShaderUniforms => {
  const uniforms: ExampleShaderUniforms = {
    intensity: { value: 0 },
    time: { value: 0 },
    tint: { value: tint.clone() },
  }
  const onBeforeCompile = material.onBeforeCompile.bind(material)
  const customProgramCacheKey = material.customProgramCacheKey.bind(material)

  material.onBeforeCompile = (shader: ShaderParameters, renderer: WebGLRenderer) => {
    onBeforeCompile(shader, renderer)
    shader.uniforms["engineExampleShaderIntensity"] = uniforms.intensity
    shader.uniforms["engineExampleShaderTime"] = uniforms.time
    shader.uniforms["engineExampleShaderTint"] = uniforms.tint
    shader.fragmentShader = injectExampleShader(shader.fragmentShader)
  }
  material.customProgramCacheKey = () => `${customProgramCacheKey()}:${effectName}`
  material.needsUpdate = true

  return uniforms
}

const injectExampleShader = (fragmentShader: string): string => {
  const shader = `
uniform float engineExampleShaderIntensity;
uniform float engineExampleShaderTime;
uniform vec3 engineExampleShaderTint;
${fragmentShader}
`
  const effect = `
  float engineExampleShaderScan = 0.5 + 0.5 * sin((gl_FragCoord.y * 0.035) + (engineExampleShaderTime * 2.1));
  gl_FragColor.rgb += engineExampleShaderTint * engineExampleShaderIntensity * engineExampleShaderScan;
`

  return shader.includes("#include <dithering_fragment>")
    ? shader.replace("#include <dithering_fragment>", `${effect}\n#include <dithering_fragment>`)
    : `${shader}\n${effect}`
}

const resolveEffectValue = (value: EffectValue, context: FrameContext): number =>
  typeof value === "function" ? value(context) : value
