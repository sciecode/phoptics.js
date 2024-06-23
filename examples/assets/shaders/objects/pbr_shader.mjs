export default `
enable f16;
const PI = 3.14159265359;
const R_PI = 0.3183098861837907;

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

struct Attributes {
  pos : vec3f,
  normal : vec3f,
  uv : vec2f,
}

@group(0) @binding(0) var<storage, read> globals: Globals;
@group(0) @binding(1) var gsamp: sampler;
@group(0) @binding(2) var lut: texture_2d<f32>;
@group(0) @binding(3) var cubemap: texture_cube<f32>;

@group(2) @binding(0) var<storage, read> attributes: array<u32>;
@group(3) @binding(0) var<storage, read> dynamic: array<f32>;

fn read_uniform(inst : u32) -> Uniforms {
  var uniform : Uniforms;

  var p = inst;
  uniform.world_matrix = mat3x4f(
    dynamic[p], dynamic[p+1], dynamic[p+2], dynamic[p+3],
    dynamic[p+4], dynamic[p+5], dynamic[p+6], dynamic[p+7],
    dynamic[p+8], dynamic[p+9], dynamic[p+10], dynamic[p+11],
  );
  return uniform;
}

fn read_attribute(vert : u32) -> Attributes {
  var attrib : Attributes;

  let p = vert * 3;
  attrib.pos = vec3f(bitcast<vec4h>(vec2u(attributes[p], attributes[p+1])).xyz);
  attrib.normal = dec_oct16(attributes[p+1] >> 16);
  attrib.uv = vec2f(bitcast<vec2h>(attributes[p+2]));
  return attrib;
}

fn dec_oct16(data : u32) -> vec3f {
  let v = vec2f(vec2u(data, data >> 8) & vec2u(255)) / 127.5 - 1.0;
  var nor = vec3f(v, 1.0 - abs(v.x) - abs(v.y));
  let t = max(-nor.z, 0.0);
  nor.x += select(t, -t, nor.x > 0.);
  nor.y += select(t, -t, nor.y > 0.);
  return normalize(nor);
}

fn normal_rg(v : vec2f) -> vec3f {
  let z = sqrt(saturate(1 - dot(v,v)));
	return normalize(vec3f(v, z));
}

@vertex fn vs(@builtin(vertex_index) vert: u32, @builtin(instance_index) inst: u32) -> FragInput {
  var output : FragInput;

  let attrib = read_attribute(vert);
  let uniform = read_uniform(inst);

  var w_pos = vec4f(attrib.pos, 1) * uniform.world_matrix;
  var c_pos = vec4f(vec4f(w_pos, 1) * globals.view_matrix, 1) * globals.projection_matrix;

  var normal_matrix = mat3x3f(uniform.world_matrix[0].xyz, uniform.world_matrix[1].xyz, uniform.world_matrix[2].xyz);

  output.position = c_pos;
  output.w_pos = w_pos;
  output.w_normal = attrib.normal * normal_matrix;
  output.uv = attrib.uv;

  return output;
}

struct RenderInfo {
  Ld_dif    : vec3f,
  Ld_spe    : vec3f,
  Li_dif    : vec3f,
  Li_spe    : vec3f,
  pos       : vec3f,
  V         : vec3f,
  N         : vec3f,
  f0        : vec3f,
  cosNV     : f32,
  a2        : f32,
}

fn Fd_Lambert() -> f32 {
  return R_PI;
}

fn F_Schlick(f0 : vec3f, cosVH : f32) -> vec3f {
	let r = exp2((- 5.55473 * cosVH - 6.98316) * cosVH);
	return f0 * (1.0 - r) + r;
}

fn V_Smith(a2 : f32, cosNL : f32, cosNV : f32) -> f32 {
  let GGXL = cosNV * sqrt((1. - a2) * (cosNL * cosNL) + a2);
  let GGXV = cosNL * sqrt((1. - a2) * (cosNV * cosNV) + a2);
  return .5 / (GGXV + GGXL);
}

fn D_GGX(a2 : f32, cosNH : f32) -> f32 {
  let q = (cosNH * cosNH) * (a2 - 1.) + 1.;
	return R_PI * a2 / (q * q);
}

fn Fr_GGX(frag : ptr<function, RenderInfo>, L : vec3f, cosNL : f32) -> vec3f {
  let H = normalize((*frag).V + L);

	let cosNH = saturate(dot((*frag).N, H));
	let cosVH = saturate(dot((*frag).V, H));

  let F = F_Schlick((*frag).f0, cosVH);
  let V = V_Smith((*frag).a2, cosNL, (*frag).cosNV);
  let D = D_GGX((*frag).a2, cosNH);

  return F * (V * D);
}

fn point_light(frag : ptr<function, RenderInfo>, l_pos : vec3f, l_color : vec3f, Il : f32) {
  let l = l_pos - (*frag).pos;
  let d2 = pow(length(l) / 100., 2.); // TODO: use metric coeficient
  let Ep = Il * l_color / d2;
  
  let L = normalize(l);
  let cosNL = saturate(dot((*frag).N, L));
  let E = Ep * cosNL;
  
  (*frag).Ld_dif += E * Fd_Lambert();
  (*frag).Ld_spe += E * Fr_GGX(frag, L, cosNL);
}

fn phoptics_tonemap(L : vec3f, ev2: f32, nits : f32) -> vec3f {
  let ev10 = (ev2 - 1.) * .301029995;
  let black = pow(10, -ev10);
  let base = (L - black) / (nits * black);
  
  let sat = max(vec3f(0), base - 1);
  let Ln = base + (sat.x + sat.y + sat.z) * .33333333;
  return Ln;
}

fn indirect(frag : ptr<function, RenderInfo>, r : f32) {
  // infinitely far skybox
  var dir = reflect(-(*frag).V, (*frag).N);
  dir.z *= -1.;

  let L = pow(textureSampleLevel(cubemap, gsamp, dir, r * 4.).rgb, vec3f(2.2));
  let dfg = textureSample(lut, gsamp, vec2f((*frag).cosNV, 1. - r)).xy;

  (*frag).Li_spe = (dfg.x * (*frag).f0 + dfg.y) * L * 350; // nits boost because of SDR cubemap
}

@group(1) @binding(0) var samp: sampler;
@group(1) @binding(1) var t_albedo: texture_2d<f32>;
@group(1) @binding(2) var t_metallic: texture_2d<f32>;
@group(1) @binding(3) var t_normal: texture_2d<f32>;

fn tbn_mat(eye : vec3f, norm : vec3f, uv : vec2f) -> mat3x3f {
	let q0 = dpdx(eye);
	let q1 = dpdy(eye);
	let st0 = dpdx(uv);
	let st1 = dpdy(uv);

	let q1perp = cross(q1, norm);
	let q0perp = cross(norm, q0);

	let T = q1perp * st0.x + q0perp * st1.x;
	let B = q1perp * st0.y + q0perp * st1.y;

	let det = max(dot(T,T), dot(B,B));
	let scale = select(inverseSqrt(det), 0, det == 0);

	return mat3x3f(T * scale, B * scale, norm);
}

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  let metalness = textureSample(t_metallic, samp, in.uv).r;
  let tbn_normal = normal_rg(textureSample(t_normal, samp, in.uv).rg * 2 - 1);

  const perceptual_roughness = .15;
  let a = max(perceptual_roughness * perceptual_roughness, 0.089);

  var frag : RenderInfo;
  frag.pos = in.w_pos;
  frag.V = normalize(globals.camera_pos - frag.pos);
  frag.N = normalize(tbn_mat(frag.V, normalize(in.w_normal), in.uv) * tbn_normal);
  frag.cosNV = saturate(dot(frag.V, frag.N)) + 1e-5;
  frag.a2 = a * a;

  var albedo = textureSample(t_albedo, samp, in.uv).rgb;
  frag.f0 = mix(vec3(0.04), albedo, metalness); // TODO: use reflectance for dielectric

  point_light(&frag,
    vec3f(0, 100, 100),   // position
    vec3f(1),             // color
    900.                  // intensity
  );

  point_light(&frag,
    vec3f(160, 0, 120),   // position
    vec3f(0, .1, 1),      // color
    900.                  // intensity
  );

  point_light(&frag,
    vec3f(-100, 30, -20), // position
    vec3f(1, .3, .2),     // color
    800.                  // intensity
  );

  frag.Li_dif += 60;
  indirect(&frag, perceptual_roughness);

  let L = albedo * (1. - metalness) * (frag.Ld_dif + frag.Li_dif) + (frag.Ld_spe + frag.Li_spe);
  let Ln = phoptics_tonemap(L, globals.exposure, globals.nits);
  let output = pow(Ln, vec3f(1./2.2));
  return vec4f(output, .5);
}`;