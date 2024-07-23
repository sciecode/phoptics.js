export default /* wgsl */`
enable f16;
@import constants, math, encoding, tonemap;

struct FragInput {
  @builtin(position) position : vec4f,
  @location(0) pos : vec3f,
  @location(1) normal : vec3f,
  @location(2) tangent : vec3f,
  @location(3) @interpolate(flat) sign : f32,
  @location(4) uv : vec2f,
}

struct Globals {
  projection_matrix : mat4x4f,
  view_matrix : mat3x4f,
  camera_pos : vec3f,
  @align(16) nits : f32,
  exposure : f32,
}

struct Attributes {
  pos : vec3f,
  normal : vec3f,
  tangent : vec3f,
  sign : f32,
  uv : vec2f,
}

@group(0) @binding(0) var<storage, read> globals: Globals;
@group(0) @binding(1) var gsamp: sampler;
@group(0) @binding(2) var lut: texture_2d<f32>;
@group(0) @binding(3) var cubemap: texture_cube<f32>;
@group(2) @binding(0) var<storage, read> positions: array<vec2u>;
@group(2) @binding(1) var<storage, read> extras: array<vec2u>;
@group(3) @binding(0) var<storage, read> world_matrix: mat3x4f;

fn read_attribute(vert : u32) -> Attributes {
  var attrib : Attributes;

  let f = positions[vert];
  attrib.pos = vec3f(bitcast<vec4h>(f).xyz);
  attrib.sign = select(1., -1., (f.y >> 16) == 0);
  let e = extras[vert];
  attrib.normal = dec_oct16(e.x & 65535);
  attrib.tangent = dec_oct16(e.x >> 16);
  attrib.uv = vec2f(bitcast<vec2h>(e.y));
  return attrib;
}

fn normal_rg(v : vec2f) -> vec3f { // TODO: rename & move to encoding
  let z = sqrt(saturate(1 - dot(v,v)));
	return normalize(vec3f(v, z));
}

@vertex fn vs(@builtin(vertex_index) vert: u32) -> FragInput {
  var output : FragInput;

  let attrib = read_attribute(vert);
  output.uv = attrib.uv;
  output.sign = attrib.sign;
  output.pos = mul34(world_matrix, attrib.pos);
  output.position = mul44(globals.projection_matrix, mul34(globals.view_matrix, output.pos));
  let normal_matrix = mat3x3f(world_matrix[0].xyz, world_matrix[1].xyz, world_matrix[2].xyz);
  output.normal = mul33(normal_matrix, attrib.normal);
  output.tangent = mul33(normal_matrix, attrib.tangent);

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

fn tbn(N: vec3f, T: vec3f, S: f32, nT: vec3f) -> vec3f {
  let B = S * cross(N, T);
  return normalize(nT.x * T + nT.y * B + nT.z * N);
}

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  let metalness = textureSample(t_metallic, samp, in.uv).r;
  let nT = normal_rg(textureSample(t_normal, samp, in.uv).rg * 2 - 1);

  const perceptual_roughness = .35;
  let a = max(perceptual_roughness * perceptual_roughness, 0.089);

  var frag : RenderInfo;
  frag.pos = in.pos;
  frag.V = normalize(globals.camera_pos - frag.pos);
  frag.N = tbn(in.normal, in.tangent, in.sign, nT);
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