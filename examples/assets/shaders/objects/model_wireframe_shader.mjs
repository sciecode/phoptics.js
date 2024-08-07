export default /* wgsl */`
@import constants, math, tonemap;

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