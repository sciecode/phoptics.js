export default `
enable f16;
const PI = 3.14159265359;

struct FragInput {
  @builtin(position) position : vec4f,
  @location(0) uv : vec2f,
}

struct Globals {
  projection_matrix : mat4x4f,
  view_matrix : mat3x4f,
  camera_pos : vec3f,
  null0 : f32, // unused
  nits : f32,
  exposure : f32,
  scl : f32,
}

struct Uniforms {
  world_matrix: mat3x4f,
}

@group(0) @binding(0) var<storage, read> globals: Globals;
@group(2) @binding(0) var<storage, read> attrib: array<f32>;
@group(3) @binding(0) var<storage, read> uniforms: Uniforms;

@vertex fn vs(@builtin(vertex_index) vert: u32, @builtin(instance_index) inst: u32) -> FragInput {
  var output : FragInput;

  let p = vert * 3;
  var pos = vec3f(attrib[p], attrib[p+1], attrib[p+2]);
  var w_pos = vec4f(pos + vec3f(0, 3, 0) * f32(inst), 1) * uniforms.world_matrix;
  var c_pos = vec4f(vec4f(w_pos, 1) * globals.view_matrix, 1) * globals.projection_matrix;

  output.position = c_pos;
  output.uv = vec2f(pos.x, -pos.y) * .5 + .5;

  return output;
}

fn phoptics_tonemap(L : vec3f, ev2: f32, nits : f32) -> vec3f {
  let ev10 = (ev2 - 1.) * .301029995;
  let black = pow(10, -ev10);
  let base = (L - black) / (nits * black);
  
  let sat = max(vec3f(0), base - 1);
  let Ln = base + (sat.x + sat.y + sat.z) * .33333333;
  return Ln;
}

@group(1) @binding(0) var samp: sampler;
@group(1) @binding(1) var luminance: texture_2d<f32>;

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  var L = textureSample(luminance, samp, in.uv).rgb;
  let Ln = phoptics_tonemap(L, globals.exposure, globals.nits);
  let output = pow(Ln, vec3f(1./2.2));

  return vec4f(output, 1.);
}`;