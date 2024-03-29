export const shader = `
const PI = 3.14159265359;

struct GlobalUniforms {
  projection_matrix : mat4x4f,
  view_matrix : mat3x4f,
  camera_pos : vec3f,
  nits : f32,
}

struct Attributes {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
}

struct FragInput {
  @builtin(position) position : vec4f,
  @location(0) w_pos : vec3f,
  @location(1) w_normal : vec3f,
}

@group(0) @binding(0) var<storage, read> globals: GlobalUniforms;

@vertex fn vs(attrib : Attributes) -> FragInput {
  var output : FragInput;

  var v_pos = vec4f(attrib.position, 1) * globals.view_matrix;
  var c_pos = vec4f(v_pos, 1) * globals.projection_matrix;

  output.position = c_pos;
  output.w_pos = attrib.position;
  output.w_normal = attrib.normal;

  return output;
}

struct RenderInfo {
  Ldd   : vec3f,
  pos   : vec3f,
  V     : vec3f,
  N     : vec3f,
  cosNV : f32
}

fn F_Schlick(cos : f32, f0 : f32, f90 : f32) -> f32 {
  return f0 + (f90 - f0) * pow(1.0 - cos, 5.0);
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
  
  (*frag).Ldd += Ep * Fd_Lambert() * cosNL;
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
  let L = albedo * frag.Ldd;
  let Lf = pow(L / globals.nits, vec3f(1./2.2));
  return vec4f(Lf, 1);
}
`;