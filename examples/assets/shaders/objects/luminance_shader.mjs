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

struct Attributes {
  pos : vec3f,
}

@group(0) @binding(0) var<storage, read> globals: Globals;
@group(2) @binding(0) var<storage, read> dynamic: array<vec4f>;
@group(3) @binding(0) var<storage, read> attributes: array<f32>;

fn read_uniform(inst : u32) -> Uniforms {
  var uniform : Uniforms;

  var p = inst >> 2;
  uniform.world_matrix = mat3x4f(dynamic[p], dynamic[p+1], dynamic[p+2]);
  return uniform;
}

fn read_attributes(vert : u32) -> Attributes {
  var attrib : Attributes;

  let p = vert * 3;
  attrib.pos = vec3f(attributes[p], attributes[p+1], attributes[p+2]);
  return attrib;
}

@vertex fn vs(@builtin(vertex_index) vert: u32, @builtin(instance_index) inst: u32) -> FragInput {
  var output : FragInput;

  var attrib = read_attributes(vert);
  var w_pos = vec4f(attrib.pos, 1) * read_uniform(inst).world_matrix;
  var c_pos = vec4f(vec4f(w_pos, 1) * globals.view_matrix, 1) * globals.projection_matrix;

  output.position = c_pos;
  output.uv = vec2f(attrib.pos.x, -attrib.pos.y) * .5 + .5;

  return output;
}

const R3_3 = vec3f(.333333333333333);
fn phoptics_tonemap(L : vec3f, ev2: f32, nits : f32) -> vec3f {
  let black = exp2(1 - ev2);

  // remap luminance to (L-black) / (nits * black)
  let r_nits = 1 / nits;
  let r_nb = (1 / black) * r_nits;  // should force rcp once available
  let base = fma(L, vec3f(r_nb), -vec3f(r_nits));

  // distribute saturated luminance between channels
  let sat = saturate(fma(base, R3_3, -R3_3));
  return base + (sat.x + sat.y + sat.z);
}

@group(1) @binding(0) var samp: sampler;
@group(1) @binding(1) var luminance: texture_2d<f32>;

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  var L = textureSample(luminance, samp, in.uv).rgb;
  let Ln = phoptics_tonemap(L, globals.exposure, globals.nits);
  let output = pow(Ln, vec3f(1./2.2));

  return vec4f(output, 1.);
}`;