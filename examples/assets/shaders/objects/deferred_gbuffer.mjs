export default /* wgsl*/`
enable f16;
@import constants, encoding;

struct FragInput {
  @builtin(position) position : vec4f,
  @location(0) w_pos : vec3f,
  @location(1) w_normal : vec3f,
}

struct Globals {
  projection_matrix : mat4x4f,
  view_matrix : mat3x4f,
  camera_pos : vec3f,
  nits : f32,
}

struct Attributes {
  pos: vec3f,
  normal: vec3f,
}

@group(0) @binding(0) var<storage, read> globals: Globals;
@group(2) @binding(0) var<storage, read> attributes: array<u32>;
@group(3) @binding(0) var<storage, read> world_matrix: mat3x4f;

fn read_attribute(vert : u32) -> Attributes {
  var attrib : Attributes;

  let p = vert * 2;
  attrib.pos = vec3f(bitcast<vec4h>(vec2u(attributes[p], attributes[p+1])).xyz);
  attrib.normal = dec_oct16(attributes[p+1] >> 16);
  return attrib;
}

@vertex fn vs(@builtin(vertex_index) vert: u32) -> FragInput {
  var output : FragInput;

  let attrib = read_attribute(vert);

  var w_pos = vec4f(attrib.pos, 1) * world_matrix;
  var c_pos = vec4f(vec4f(w_pos, 1) * globals.view_matrix, 1) * globals.projection_matrix;

  output.position = c_pos;
  output.w_pos = w_pos;
  output.w_normal = attrib.normal;

  return output;
}

struct GBuffer {
  @location(0) pos : vec4f,
  @location(1) norm : vec4f,
}

@fragment fn fs(in : FragInput) -> GBuffer {
  var gbuffer : GBuffer;
  gbuffer.pos = vec4f(in.w_pos, 1.);
  gbuffer.norm = vec4f(in.w_normal, 1.);
  return gbuffer;
}
`;