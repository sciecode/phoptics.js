export default /* wgsl */`
const PI = 3.14159265359;

@import math;

struct FragInput {
  @builtin(position) position : vec4f,
  @location(0) w_pos : vec3f,
}

struct Globals {
  projection_matrix : mat4x4f,
  view_matrix : mat3x4f,
  camera_pos : vec3f,
  @align(16) nits : f32,
  exposure : f32,
}

struct Attributes {
  pos: vec3f,
}

@group(0) @binding(0) var<storage, read> globals: Globals;
@group(2) @binding(0) var<storage, read> pos: array<f32>;
@group(3) @binding(0) var<storage, read> world_matrix: mat3x4f;

fn read_attribute(vert : u32) -> Attributes {
  var attrib : Attributes;

  let p = vert * 3;
  attrib.pos = vec3f(pos[p], pos[p+1], pos[p+2]);
  return attrib;
}

const R3_3 = vec3f(1./3.);
fn phoptics_tonemap(L : vec3f, r_nb: f32, r_nits : f32) -> vec3f {
  // remap luminance to (L-black) / (nits * black)
  let base = fma(L, vec3f(r_nb), -vec3f(r_nits));

  // distribute saturated luminance between channels
  let sat = saturate(fma(base, R3_3, -R3_3));
  return base + (sat.x + sat.y + sat.z);
}

@vertex fn vs(@builtin(vertex_index) vert : u32) -> FragInput {
  var output : FragInput;

  let attrib = read_attribute(vert);
  output.w_pos = mul34(world_matrix, attrib.pos);
  output.position = mul44(globals.projection_matrix, mul34(globals.view_matrix, output.w_pos));
  return output;
}

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  return vec4f(phoptics_tonemap(in.position.xyz, globals.exposure, globals.nits), 1);
}`;