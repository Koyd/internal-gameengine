import {
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  LinearFilter,
  Material,
  Mesh,
  NearestFilter,
  RepeatWrapping,
  RGBAFormat,
  Texture,
  type WebGLRenderer,
} from "@framework/three"
import { defineRenderProcess, type RenderProcess } from "./frame-pipeline.ts"

export interface GodotShaderUniform {
  readonly arraySize?: string
  readonly defaultValue?: string
  readonly hints: ReadonlyArray<string>
  readonly name: string
  readonly qualifier?: "global" | "instance"
  readonly raw: string
  readonly type: string
}

export interface GodotShader {
  readonly renderModes: ReadonlyArray<string>
  readonly shaderType?: string
  readonly uniforms: ReadonlyArray<GodotShaderUniform>
}

export type GodotShaderUniformValue = boolean | Color | number | ReadonlyArray<number> | Texture

export interface GodotSpatialShaderPreprocessEffectOptions {
  readonly name?: string
  readonly sampler2D?: Readonly<Record<string, Promise<Texture> | Texture>>
  readonly shader: Promise<string> | string
  readonly uniforms?: Readonly<Record<string, GodotShaderUniformValue>>
}

interface GodotSpatialShaderState {
  readonly shader: GodotShader
  readonly uniforms: Readonly<Record<string, GodotShaderUniformValue>>
}

type ShaderParameters = Parameters<Material["onBeforeCompile"]>[0]

export const createGodotSpatialShaderPreprocessEffect = ({
  name = "engine.preprocess.godot-spatial-shader",
  sampler2D = {},
  shader,
  uniforms = {},
}: GodotSpatialShaderPreprocessEffectOptions): RenderProcess => {
  const installedMaterials = new WeakSet<Material>()
  let state: GodotSpatialShaderState | undefined
  let failed = false

  void loadGodotSpatialShaderState(shader, sampler2D, uniforms).then(
    (loaded) => {
      state = loaded
    },
    (cause: unknown) => {
      failed = true
      console.error("Failed to load Godot spatial shader", cause)
    },
  )

  return defineRenderProcess(name, ({ scene }) => {
    const loadedState = state
    if (!loadedState || failed) return

    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (installedMaterials.has(material)) continue

        installGodotSpatialShader(material, name, loadedState)
        installedMaterials.add(material)
      }
    })
  })
}

export const parseGodotShader = (source: string): GodotShader => {
  const parseSource = stripGodotShaderComments(source)
  const shaderType = /^\s*shader_type\s+([A-Za-z_]\w*)\s*;/m.exec(parseSource)?.[1]
  const renderModes =
    /^\s*render_mode\s+([^;]+);/m
      .exec(parseSource)?.[1]
      ?.split(",")
      .map((mode) => mode.trim())
      .filter(Boolean) ?? []
  const uniforms: GodotShaderUniform[] = []
  const uniformPattern =
    /^\s*(?:(global|instance)\s+)?uniform\s+([A-Za-z_]\w*)\s+([A-Za-z_]\w*)(?:\s*\[([^\]]+)\])?\s*(?::\s*([^=;]+))?\s*(?:=\s*([^;]+))?\s*;/gm

  for (const match of parseSource.matchAll(uniformPattern)) {
    const [, qualifier, type, uniformName, arraySize, rawHints, defaultValue] = match
    if (!type || !uniformName) continue

    uniforms.push({
      ...(arraySize ? { arraySize: arraySize.trim() } : {}),
      ...(defaultValue ? { defaultValue: defaultValue.trim() } : {}),
      hints: splitGodotShaderHints(rawHints),
      name: uniformName,
      ...(qualifier === "global" || qualifier === "instance" ? { qualifier } : {}),
      raw: match[0].trim(),
      type,
    })
  }

  return {
    renderModes,
    ...(shaderType ? { shaderType } : {}),
    uniforms,
  }
}

const loadGodotSpatialShaderState = async (
  shader: Promise<string> | string,
  sampler2D: Readonly<Record<string, Promise<Texture> | Texture>>,
  uniforms: Readonly<Record<string, GodotShaderUniformValue>>,
): Promise<GodotSpatialShaderState> => {
  const parsed = parseGodotShader(await shader)
  if (parsed.shaderType && parsed.shaderType !== "spatial") {
    throw new Error(`Only Godot spatial shaders are supported; received "${parsed.shaderType}"`)
  }

  const resolvedUniforms: Record<string, GodotShaderUniformValue> = {}
  await Promise.all(
    parsed.uniforms.map(async (uniform) => {
      const override = uniforms[uniform.name]
      if (override !== undefined) {
        resolvedUniforms[uniform.name] = override
        return
      }

      if (uniform.type === "sampler2D") {
        const texture = await sampler2D[uniform.name]
        resolvedUniforms[uniform.name] = texture ?? createDefaultGodotSampler2D(uniform.name)
        return
      }

      const defaultValue = parseGodotShaderDefault(uniform)
      if (defaultValue !== undefined) resolvedUniforms[uniform.name] = defaultValue
    }),
  )

  for (const uniform of parsed.uniforms) {
    const value = resolvedUniforms[uniform.name]
    if (value instanceof Texture) applyGodotSamplerHints(value, uniform)
  }

  return {
    shader: parsed,
    uniforms: resolvedUniforms,
  }
}

const installGodotSpatialShader = (
  material: Material,
  effectName: string,
  state: GodotSpatialShaderState,
): void => {
  const onBeforeCompile = material.onBeforeCompile.bind(material)
  const customProgramCacheKey = material.customProgramCacheKey.bind(material)
  const godotUniforms = Object.fromEntries(
    state.shader.uniforms.map((uniform) => [
      uniform.name,
      { value: state.uniforms[uniform.name] ?? defaultGodotUniformValue(uniform) },
    ]),
  )
  const declarations = state.shader.uniforms.map(godotUniformDeclaration).join("\n")

  material.onBeforeCompile = (shader: ShaderParameters, renderer: WebGLRenderer) => {
    onBeforeCompile(shader, renderer)
    Object.assign(shader.uniforms, godotUniforms)
    shader.fragmentShader = injectGodotSpatialShader(shader.fragmentShader, declarations, state)
  }
  material.customProgramCacheKey = () => `${customProgramCacheKey()}:${effectName}`
  material.needsUpdate = true
}

const injectGodotSpatialShader = (
  fragmentShader: string,
  declarations: string,
  state: GodotSpatialShaderState,
): string => {
  const uniforms = new Set(state.shader.uniforms.map((uniform) => uniform.name))
  const shader = `${declarations}\n${fragmentShader}`
  const hasNormals =
    fragmentShader.includes("#include <normal_fragment_begin>") ||
    fragmentShader.includes("vec3 normal")
  const effect = hasNormals
    ? normalMappedGodotSpatialEffect(uniforms)
    : flatGodotSpatialEffect(uniforms)

  return shader.includes("#include <dithering_fragment>")
    ? shader.replace("#include <dithering_fragment>", `${effect}\n#include <dithering_fragment>`)
    : `${shader}\n${effect}`
}

const normalMappedGodotSpatialEffect = (uniforms: ReadonlySet<string>): string => {
  const baseColor = uniforms.has("base_color") ? "base_color.rgb" : "vec3(1.0)"
  const specularColor = uniforms.has("specular_color") ? "specular_color" : "vec3(1.0)"
  const specularSize = uniforms.has("specular_size") ? "specular_size" : "8.0"
  const specularThreshold = uniforms.has("specular_threshold") ? "specular_threshold" : "0.5"
  const specularStrength = uniforms.has("specular_strength") ? "specular_strength" : "1.0"
  const noisePow = uniforms.has("noise_pow") ? "noise_pow" : "2.0"
  const noiseScale = uniforms.has("noise_scl") ? "noise_scl" : "0.1"
  const rimPow = uniforms.has("rim_pow") ? "rim_pow" : "4.0"
  const rimStrength = uniforms.has("rim_str") ? "rim_str" : "1.0"
  const noise = uniforms.has("noise_tex")
    ? `pow(texture2D(noise_tex, engineGodotReflection.xy * ${noiseScale}).r, ${noisePow})`
    : "0.0"
  const toon = uniforms.has("color_ramp")
    ? "texture2D(color_ramp, vec2(engineGodotDiffuse, 0.5)).rgb"
    : "vec3(engineGodotDiffuse)"

  return `
  vec3 engineGodotNormal = normalize(normal);
  vec3 engineGodotView = normalize(vViewPosition);
  vec3 engineGodotLight = normalize(vec3(0.35, 0.82, 0.45));
  vec3 engineGodotReflection = reflect(engineGodotView, engineGodotNormal);
  float engineGodotNoise = ${noise};
  float engineGodotRim = pow(clamp((engineGodotReflection.z + 1.0) * 0.5, 0.0, 1.0), ${rimPow});
  float engineGodotDiffuse = clamp((dot(engineGodotNormal, engineGodotLight) + 1.0) * 0.5, 0.0, 1.0);
  engineGodotDiffuse *= clamp(engineGodotNoise + engineGodotRim * ${rimStrength}, 0.0, 1.0);
  vec3 engineGodotToon = ${toon};
  vec3 engineGodotHalf = normalize(engineGodotView + engineGodotLight);
  float engineGodotSpecular = pow(max(dot(engineGodotNormal, engineGodotHalf), 0.0), ${specularSize});
  engineGodotSpecular = step(${specularThreshold}, engineGodotSpecular) * ${specularStrength};
  gl_FragColor.rgb = engineGodotToon * ${baseColor} + ${specularColor} * engineGodotSpecular;
`
}

const flatGodotSpatialEffect = (uniforms: ReadonlySet<string>): string => {
  const baseColor = uniforms.has("base_color") ? "base_color.rgb" : "vec3(1.0)"
  const noisePow = uniforms.has("noise_pow") ? "noise_pow" : "2.0"
  const noiseScale = uniforms.has("noise_scl") ? "noise_scl" : "0.1"
  const noise = uniforms.has("noise_tex")
    ? `pow(texture2D(noise_tex, gl_FragCoord.xy * ${noiseScale} * 0.01).r, ${noisePow})`
    : "1.0"
  const toon = uniforms.has("color_ramp")
    ? "texture2D(color_ramp, vec2(engineGodotNoise, 0.5)).rgb"
    : "vec3(engineGodotNoise)"

  return `
  float engineGodotNoise = ${noise};
  gl_FragColor.rgb = ${toon} * ${baseColor};
`
}

const godotUniformDeclaration = (uniform: GodotShaderUniform): string =>
  `uniform ${uniform.type} ${uniform.name}${uniform.arraySize ? `[${uniform.arraySize}]` : ""};`

const defaultGodotUniformValue = (uniform: GodotShaderUniform): GodotShaderUniformValue => {
  if (uniform.type === "bool") return false
  if (uniform.type === "sampler2D") return createDefaultGodotSampler2D(uniform.name)
  if (uniform.type === "vec2") return [0, 0]
  if (uniform.type === "vec3") return [0, 0, 0]
  if (uniform.type === "vec4") return [1, 1, 1, 1]
  return 0
}

const parseGodotShaderDefault = (
  uniform: GodotShaderUniform,
): GodotShaderUniformValue | undefined => {
  const value = uniform.defaultValue
  if (!value) return undefined
  if (uniform.type === "bool") return value === "true"
  if (uniform.type === "float" || uniform.type === "int" || uniform.type === "uint") {
    return Number(value.match(numberPattern)?.[0] ?? 0)
  }
  if (uniform.type === "vec2" || uniform.type === "vec3" || uniform.type === "vec4") {
    const length = Number(uniform.type.slice(3))
    const numbers = [...value.matchAll(numberPattern)].map(([number]) => Number(number))
    if (numbers.length === 1) return Array.from({ length }, () => numbers[0] ?? 0)
    return Array.from({ length }, (_value, index) => numbers[index] ?? 0)
  }
  return undefined
}

const createDefaultGodotSampler2D = (name: string): Texture => {
  if (name.includes("ramp")) {
    const texture = new DataTexture(
      new Uint8Array([28, 36, 48, 255, 90, 116, 156, 255, 232, 238, 248, 255]),
      3,
      1,
      RGBAFormat,
    )
    texture.magFilter = NearestFilter
    texture.minFilter = NearestFilter
    texture.wrapS = ClampToEdgeWrapping
    texture.wrapT = ClampToEdgeWrapping
    texture.needsUpdate = true
    return texture
  }

  const texture = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat)
  texture.needsUpdate = true
  return texture
}

const applyGodotSamplerHints = (texture: Texture, uniform: GodotShaderUniform): void => {
  const hints = new Set(uniform.hints)
  texture.wrapS = hints.has("repeat_disable") ? ClampToEdgeWrapping : RepeatWrapping
  texture.wrapT = hints.has("repeat_disable") ? ClampToEdgeWrapping : RepeatWrapping
  texture.magFilter = hints.has("filter_nearest") ? NearestFilter : LinearFilter
  texture.minFilter = hints.has("filter_nearest") ? NearestFilter : LinearFilter
  texture.needsUpdate = true
}

const splitGodotShaderHints = (rawHints: string | undefined): ReadonlyArray<string> => {
  if (!rawHints) return []

  const hints: string[] = []
  let current = ""
  let depth = 0
  for (const character of rawHints) {
    if (character === "(") depth += 1
    if (character === ")") depth = Math.max(0, depth - 1)
    if (character === "," && depth === 0) {
      const hint = current.trim()
      if (hint) hints.push(hint)
      current = ""
      continue
    }
    current += character
  }
  const hint = current.trim()
  if (hint) hints.push(hint)
  return hints
}

const stripGodotShaderComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

const numberPattern = /-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g
