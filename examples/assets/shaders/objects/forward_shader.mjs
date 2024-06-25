export default `
enable f16;
const PI = 3.14159265359;

struct FragInput {
  @builtin(position) position : vec4f,
  @location(0) w_pos : vec3f,
  @location(1) w_normal : vec3f,
  @location(2) @interpolate(flat) inst: u32,
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
  color: vec4f,
}

struct Attributes {
  pos: vec3f,
  normal: vec3f,
}

@group(0) @binding(0) var<storage, read> globals: Globals;

@group(2) @binding(0) var<storage, read> attributes: array<u32>;
@group(3) @binding(0) var<storage, read> dynamic: array<vec4f>;

fn dec_oct16(data : u32) -> vec3f {
  let v = vec2f(vec2u(data, data >> 8) & vec2u(255)) / 127.5 - 1.0;
  var nor = vec3f(v, 1.0 - abs(v.x) - abs(v.y));
  let t = max(-nor.z, 0.0);
  nor.x += select(t, -t, nor.x > 0.);
  nor.y += select(t, -t, nor.y > 0.);
  return normalize(nor);
}

fn read_uniform(inst : u32) -> Uniforms {
  var uniform : Uniforms;

  var p = inst >> 2;
  uniform.world_matrix = mat3x4f(dynamic[p], dynamic[p+1], dynamic[p+2]);
  uniform.color = dynamic[p+3];
  return uniform;
}

fn read_attribute(vert : u32) -> Attributes {
  var attrib : Attributes;

  let p = vert * 2;
  attrib.pos = vec3f(bitcast<vec4h>(vec2u(attributes[p], attributes[p+1])).xyz);
  attrib.normal = dec_oct16(attributes[p+1] >> 16);
  return attrib;
}

@vertex fn vs(@builtin(vertex_index) vert : u32, @builtin(instance_index) inst : u32) -> FragInput {
  var output : FragInput;

  let uniform = read_uniform(inst);
  let attrib = read_attribute(vert);

  var w_pos = vec4f(attrib.pos, 1) * uniform.world_matrix;
  var c_pos = vec4f(vec4f(w_pos, 1) * globals.view_matrix, 1) * globals.projection_matrix;

  var normal_matrix = mat3x3f(uniform.world_matrix[0].xyz, uniform.world_matrix[1].xyz, uniform.world_matrix[2].xyz);

  output.position = c_pos;
  output.w_pos = w_pos;
  output.w_normal = attrib.normal * normal_matrix;
  output.inst = inst;

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

  let uniform = read_uniform(in.inst);
  let albedo = uniform.color.rgb;
  let L = albedo * frag.Ld_dif;

  let Ln = phoptics_tonemap(L, globals.exposure, globals.nits);
  let output = pow(Ln, vec3f(1./2.2));

  return vec4f(output, .5);
}`;