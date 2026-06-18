import { describe, it } from "vite-plus/test"
import { parseGodotShader } from "./godot-shader.ts"

describe("parseGodotShader", () => {
  it("extracts shader type, render modes, and uniforms from Godot shader source", () => {
    const shader = parseGodotShader(`
      shader_type spatial;
      render_mode unshaded, cull_disabled;

      uniform vec4 base_color : source_color = vec4(1.0);
      uniform sampler2D color_ramp : source_color, repeat_disable, filter_nearest;
      uniform float specular_size : hint_range(1.0, 256.0) = 8.0;
      uniform sampler2D noise_tex;
    `)

    assert(shader.shaderType === "spatial", "shader_type should be parsed")
    assert(shader.renderModes.join(",") === "unshaded,cull_disabled", "render modes should split")
    assert(shader.uniforms.length === 4, "all uniforms should be parsed")

    const colorRamp = shader.uniforms.find((uniform) => uniform.name === "color_ramp")
    assert(colorRamp?.type === "sampler2D", "sampler2D uniforms should keep their type")
    assert(
      colorRamp.hints.join(",") === "source_color,repeat_disable,filter_nearest",
      "sampler hints should split",
    )

    const specularSize = shader.uniforms.find((uniform) => uniform.name === "specular_size")
    assert(
      specularSize?.hints[0] === "hint_range(1.0, 256.0)",
      "hint arguments should not be split",
    )
    assert(specularSize.defaultValue === "8.0", "defaults should be parsed")
  })
})

const assert: (condition: boolean, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message)
}
