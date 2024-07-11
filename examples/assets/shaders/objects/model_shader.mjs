export default /* wgsl */`
@import constants, math, tonemap;

struct FragInput {
  @builtin(position) position : vec4f,
  @location(0) w_pos : vec3f,
  @location(1) w_normal : vec3f,
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
  normal: vec3f,
}

@group(0) @binding(0) var<storage, read> globals: Globals;
@group(2) @binding(0) var<storage, read> pos: array<f32>;
@group(2) @binding(1) var<storage, read> norm: array<f32>;
@group(3) @binding(0) var<storage, read> world_matrix: mat3x4f;

fn read_attribute(vert : u32) -> Attributes {
  var attrib : Attributes;

  let p = vert * 3;
  attrib.pos = vec3f(pos[p], pos[p+1], pos[p+2]);
  attrib.normal = vec3f(norm[p], norm[p+1], norm[p+2]);
  return attrib;
}

@vertex fn vs(@builtin(vertex_index) vert : u32) -> FragInput {
  var output : FragInput;

  let attrib = read_attribute(vert);
  output.w_pos = mul34(world_matrix, attrib.pos);
  let normal_matrix = mat3x3f(world_matrix[0].xyz, world_matrix[1].xyz, world_matrix[2].xyz);
  output.w_normal = mul33(normal_matrix, attrib.normal);
  output.position = mul44(globals.projection_matrix, mul34(globals.view_matrix, output.w_pos));

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
  frag.cosNV = saturate(dot(frag.V, frag.N)) + 1e-5;

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

  let albedo = .5;
  let L = albedo * frag.Ld_dif;

  let Ln = phoptics_tonemap(L, globals.exposure, globals.nits);
  let output = pow(Ln, vec3f(1./2.2));

  return vec4f(output, .5);
}`;