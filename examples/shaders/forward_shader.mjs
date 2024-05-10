export default `
const PI = 3.14159265359;

struct Attributes {
  @location(0) position: vec3f,
  @location(1) normal: u32,
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

fn dec_oct32(data : u32) -> vec3f {
  let v = vec2f(vec2u(data & 65535, data >> 16)) / 32767.5 - 1.0;
  var nor = vec3f(v, 1.0 - abs(v.x) - abs(v.y));
  let t = vec2f(max(-nor.z, 0.0));
  nor += vec3f(select(t, -t, nor.xy > vec2f()), nor.z);
  return normalize(nor);
}

@vertex fn vs(attrib : Attributes) -> FragInput {
  var output : FragInput;

  var w_pos = vec4f(attrib.position, 1) * obj;
  var c_pos = vec4f( vec4f(w_pos, 1 ) * globals.view_matrix, 1 ) * globals.projection_matrix;

  output.position = c_pos;
  output.w_pos = w_pos;
  output.w_normal = dec_oct32(attrib.normal);

  return output;
}

struct RenderInfo {
  Ld_dif    : vec3f,
  pos       : vec3f,
  V         : vec3f,
  N         : vec3f,
  cosNV     : f32
}

fn Fd_Lambert() -> f32 {
  return 1.0 / PI;
}

fn point_light(frag : ptr<function, RenderInfo>, l_pos : vec3f, l_color : vec3f, Il : f32) {
  let l = l_pos - (*frag).pos;
  let d2 = pow(length(l) / 100., 2.);
  let Ep = Il * l_color / d2;
  
  let L = normalize(l);
  // let H = normalize((*frag).V + L);

  let cosNL = max(dot((*frag).N, L), 0.);
  // let cosLH = max(dot(L, H), 0.);
  
  (*frag).Ld_dif += Ep * Fd_Lambert() * cosNL;
}

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  var frag : RenderInfo;
  frag.pos = in.w_pos;
  frag.V = normalize(globals.camera_pos - frag.pos);
  frag.N = normalize(in.w_normal);
  frag.cosNV = max(dot(frag.V, frag.N), 0.);
  
  point_light(&frag,
    vec3f(0, 100, 100),   // position
    vec3f(1),             // color
    400.                  // intensity
  );

  point_light(&frag,
    vec3f(60, 0, 20),     // position
    vec3f(0, .1, 1),      // color
    200.                  // intensity
  );

  point_light(&frag,
    vec3f(-100, 30, -20), // position
    vec3f(1, .3, .2),     // color 
    500.                  // intensity
  );

  let albedo = .5;
  let L = albedo * frag.Ld_dif;
  let Lf = pow(L / globals.nits, vec3f(1./2.2));
  return vec4f(Lf, 1);
}
`;