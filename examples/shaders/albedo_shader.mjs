export default `
enable f16;
const PI = 3.14159265359;

struct Attributes {
  @location(0) packed: vec3u,
}

struct FragInput {
  @builtin(position) position : vec4f,
  @location(0) w_pos : vec3f,
  @location(1) w_normal : vec3f,
  @location(2) uv : vec2f,
}

struct Globals {
  projection_matrix : mat4x4f,
  view_matrix : mat3x4f,
  camera_pos : vec3f,
  null0 : f32, // unused
  nits : f32,
  exposure : f32,
}

struct Uniforms {
  world_matrix: mat3x4f,
}

@group(0) @binding(0) var<storage, read> globals: Globals;
@group(3) @binding(0) var<storage, read> uniforms: Uniforms;

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

  var pos = vec3f(bitcast<vec4h>(attrib.packed.xy).xyz);
  var norm16 = attrib.packed.y >> 16;
  var uv = vec2f(bitcast<vec2h>(attrib.packed.z));

  var w_pos = vec4f(pos, 1) * uniforms.world_matrix;
  var c_pos = vec4f(vec4f(w_pos, 1) * globals.view_matrix, 1) * globals.projection_matrix;

  var normal_matrix = mat3x3f(uniforms.world_matrix[0].xyz, uniforms.world_matrix[1].xyz, uniforms.world_matrix[2].xyz);

  output.position = c_pos;
  output.w_pos = w_pos;
  output.w_normal = dec_oct16(norm16) * normal_matrix;
  output.uv = uv;

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

fn phoptics_tonemap(L : vec3f, ev2: f32, nits : f32) -> vec3f {
  let ev10 = (ev2 - 1.) * .301029995;
  let black = pow(10, -ev10);
  let base = (L - black) / (nits * black);
  
  let sat = max(vec3f(0), base - 1);
  let Ln = base + (sat.x + sat.y + sat.z) * .33333333;
  return Ln;
}

@group(2) @binding(0) var samp: sampler;
@group(2) @binding(1) var t_albedo: texture_2d<f32>;

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  var frag : RenderInfo;
  frag.pos = in.w_pos;
  frag.V = normalize(globals.camera_pos - frag.pos);
  frag.N = normalize(in.w_normal);
  frag.cosNV = max(dot(frag.V, frag.N), 0.);

  frag.Ld_dif += 4; // ambient

  point_light(&frag,
    vec3f(0, 100, 100),   // position
    vec3f(1),             // color
    900.                  // intensity
  );

  point_light(&frag,
    vec3f(160, 0, 120),     // position
    vec3f(0, .1, 1),      // color
    800.                  // intensity
  );

  point_light(&frag,
    vec3f(-100, 30, -20), // position
    vec3f(1, .3, .2),     // color
    800.                  // intensity
  );

  let albedo = textureSample(t_albedo, samp, in.uv).rgb;
  let L = albedo * frag.Ld_dif;

  let Ln = phoptics_tonemap(L, globals.exposure, globals.nits);
  // let Ln = frag.N * .5 + .5;
  let output = pow(Ln, vec3f(1./2.2));

  return vec4f(output, .5);
}`;