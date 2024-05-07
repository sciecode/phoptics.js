export default `
struct FragInput {
  @builtin(position) position : vec4f,
  @location(0) uv : vec2f,
}

struct Globals {
  projection_matrix : mat4x4f,
  view_matrix : mat3x4f,
  camera_pos : vec3f,
  nits : f32,
}

@group(0) @binding(0) var<storage, read> globals: Globals;
@group(3) @binding(0) var<storage, read> obj: mat3x4f; 

@vertex fn vs(@builtin(vertex_index) vertexIndex : u32) -> FragInput {
  var output : FragInput;

  let pos_arr = array(
    vec2f( -1, -1 ),
    vec2f(  1, -1 ),
    vec2f(  1,  1 ),
    vec2f( -1, -1 ),
    vec2f(  1,  1 ),
    vec2f( -1,  1 ),
  );

  let uv_arr = array(
    vec2f(0, 1),
    vec2f(1, 1),
    vec2f(1, 0),
    vec2f(0, 1),
    vec2f(1, 0),
    vec2f(0, 0),
  );

  var w_pos = vec4f( pos_arr[vertexIndex], 0, 1 ) * obj;
  var c_pos = vec4f( vec4f(w_pos, 1 ) * globals.view_matrix, 1 ) * globals.projection_matrix;
  output.position = c_pos;
  output.uv = uv_arr[vertexIndex];
  return output;
}

@group(2) @binding(0) var samp: sampler;
@group(2) @binding(1) var mipmap: texture_2d<f32>;

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  let color = textureSample(mipmap, samp, in.uv).rgb;
  return vec4f(pow(color, vec3f(1./2.2)), 1.);
}`;