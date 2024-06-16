export default `
enable f16;
const PI = 3.14159265359;

struct Attributes {
  @location(0) packed: vec2u,
}

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

@group(0) @binding(0) var<storage, read> globals: Globals;
@group(3) @binding(0) var<storage, read> obj: mat3x4f;

fn dec_oct16(data : u32) -> vec3f {
  let v = vec2f(vec2u(data, data >> 8) & vec2u(255)) / 127.5 - 1.0;
  var nor = vec3f(v, 1.0 - abs(v.x) - abs(v.y));
  let t = max(-nor.z, 0.0);
  nor.x += select(t, -t, nor.x > 0.);
  nor.y += select(t, -t, nor.y > 0.);
  return normalize(nor);
}

@vertex fn vs(attrib : Attributes) -> FragInput {
  var output : FragInput;

  var pos = vec3f(bitcast<vec4h>(attrib.packed).xyz);
  var norm16 = attrib.packed.y >> 16;

  var w_pos = vec4f(pos, 1) * obj;
  var c_pos = vec4f(vec4f(w_pos, 1) * globals.view_matrix, 1) * globals.projection_matrix;

  output.position = c_pos;
  output.w_pos = w_pos;
  output.w_normal = dec_oct16(norm16);

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