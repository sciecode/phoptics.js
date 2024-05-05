export default `
const PI = 3.14159265359;

struct Attributes {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
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

@vertex fn vs(attrib : Attributes) -> FragInput {
  var output : FragInput;

  var w_pos = vec4f(attrib.position, 1) * obj;
  var c_pos = vec4f( vec4f(w_pos, 1 ) * globals.view_matrix, 1 ) * globals.projection_matrix;

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