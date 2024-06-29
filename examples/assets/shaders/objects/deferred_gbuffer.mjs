export default `
enable f16;
const PI = 3.14159265359;

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
@group(2) @binding(0) var<storage, read> dynamic: array<vec4f>;
@group(3) @binding(0) var<storage, read> attributes: array<u32>;

fn dec_oct16(data : u32) -> vec3f {
  let v = vec2f(vec2u(data, data >> 8) & vec2u(255)) / 127.5 - 1.0;
  var nor = vec3f(v, 1.0 - abs(v.x) - abs(v.y));
  let t = max(-nor.z, 0.0);
  nor.x += select(t, -t, nor.x > 0.);
  nor.y += select(t, -t, nor.y > 0.);
  return normalize(nor);
}

fn read_uniform(inst : u32) -> mat3x4f {
  var uniform : mat3x4f;

  var p = inst >> 2;
  uniform = mat3x4f(dynamic[p], dynamic[p+1], dynamic[p+2]);
  return uniform;
}

fn read_attribute(vert : u32) -> Attributes {
  var attrib : Attributes;

  let p = vert * 2;
  attrib.pos = vec3f(bitcast<vec4h>(vec2u(attributes[p], attributes[p+1])).xyz);
  attrib.normal = dec_oct16(attributes[p+1] >> 16);
  return attrib;
}

@vertex fn vs(@builtin(vertex_index) vert: u32, @builtin(instance_index) inst: u32) -> FragInput {
  var output : FragInput;

  let attrib = read_attribute(vert);

  var w_pos = vec4f(attrib.pos, 1) * read_uniform(inst);
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