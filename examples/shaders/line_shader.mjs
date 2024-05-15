export default `
const PI = 3.14159265359;

struct Attributes {
  @location(0) position: vec3f,
}

struct FragInput {
  @builtin(position) position : vec4f,
}

struct Globals {
  projection_matrix : mat4x4f,
  view_matrix : mat3x4f,
  camera_pos : vec3f,
  nits : f32,
}

struct Uniforms {
  world_matrix: mat3x4f,
}

@group(0) @binding(0) var<storage, read> globals: Globals;
@group(3) @binding(0) var<storage, read> uniforms: Uniforms;

@vertex fn vs(attrib : Attributes) -> FragInput {
  var output : FragInput;

  var w_pos = vec4f(attrib.position, 1) * uniforms.world_matrix;
  var c_pos = vec4f(vec4f(w_pos, 1) * globals.view_matrix, 1) * globals.projection_matrix;

  output.position = c_pos;
  return output;
}

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  return vec4f(1.);
}`;