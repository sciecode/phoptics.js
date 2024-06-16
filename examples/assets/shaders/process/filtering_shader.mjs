export default `
const PI = 3.14159265359;
const R_PI = 0.3183098861837907;

struct FragInput {
  @builtin(position) position : vec4f,
  @location(0) uv : vec2f,
}

@vertex fn vs(@builtin(vertex_index) vertexIndex : u32) -> FragInput {
  var output : FragInput;
  
  let coord = vec2f(f32((vertexIndex & 1) << 2), f32((vertexIndex & 2) << 1));
  output.position = vec4f(coord - 1., .5, 1);
  output.uv = coord * .5;
  
  return output;
}

struct Info {
  face : f32,
  roughness : f32,
  sample_count : f32,
  width: f32,
};

@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var cubemap: texture_cube<f32>;
@group(0) @binding(2) var<storage, read> info : Info;

fn uv_to_dir(face : i32, uv : vec2f) -> vec3f {
  if (face == 0) {      return vec3f(     1.f,   uv.y,    -uv.x); }
  else if (face == 1) { return vec3f(    -1.f,   uv.y,     uv.x); }
  else if (face == 2) { return vec3f(    uv.x,    1.f,    -uv.y); }
  else if (face == 3) { return vec3f(    uv.x,   -1.f,     uv.y); }
  else if (face == 4) { return vec3f(    uv.x,   uv.y,      1.f); }
  else {                return vec3f(   -uv.x,   uv.y,     -1.f); }
}

fn get_lod(pdf : f32) -> f32 {
  return .5 * log2(6. * info.width * info.width / (info.sample_count * pdf));
}

fn TBN(normal : vec3f) -> mat3x3f {
  var bitangent = vec3f(0, 1, 0);

  let R = dot(normal, vec3f(0, 1, 0));
  const epsilon = 0.0000001;
  if (1.0 - abs(R) <= epsilon) {
    if (R > 0.0) { bitangent = vec3f(0.0, 0.0, 1.0); }
    else { bitangent = vec3f(0.0, 0.0, -1.0); }
  }

  let tangent = normalize(cross(bitangent, normal));
  bitangent = cross(normal, tangent);

  return mat3x3f(tangent, bitangent, normal);
}

fn radical(b : u32) -> f32 {
  var bits = b;
  bits = (bits << 16) | (bits >> 16);
  bits = ((bits & 0x55555555) << 1) | ((bits & 0xAAAAAAAA) >> 1);
  bits = ((bits & 0x33333333) << 2) | ((bits & 0xCCCCCCCC) >> 2);
  bits = ((bits & 0x0F0F0F0F) << 4) | ((bits & 0xF0F0F0F0) >> 4);
  bits = ((bits & 0x00FF00FF) << 8) | ((bits & 0xFF00FF00) >> 8);
  return f32(bits) * 2.3283064365386963e-10;
}

fn hammersley(i : i32, N : i32) -> vec2f {
  return vec2f(f32(i) / f32(N), radical(u32(i)));
}

struct Sample {
  pdf : f32,
  cosT : f32,
  sinT : f32,
  phi : f32
};

fn D_GGX(a2 : f32, cosNH : f32) -> f32 {
  let q = (cosNH * cosNH) * (a2 - 1.) + 1.;
	return R_PI * a2 / (q * q);
}

fn GGX(xi : vec2f, a2 : f32) -> Sample {
  var ggx : Sample;
  ggx.cosT = saturate(sqrt((1. - xi.y) / (1.0 + (a2 - 1.0) * xi.y)));
  ggx.sinT = sqrt(1. - ggx.cosT * ggx.cosT);
  ggx.phi = 2.0 * PI * xi.x;
  ggx.pdf = D_GGX(a2, ggx.cosT) / 4.;

  return ggx;
}

fn importance_sample(idx : i32, N : vec3f, a2 : f32) -> vec4f {
  let xi = hammersley(idx, i32(info.sample_count));
  let sample = GGX(xi, a2);

  let local = normalize(vec3f(
    sample.sinT * cos(sample.phi), 
    sample.sinT * sin(sample.phi), 
    sample.cosT
  ));
  let dir = TBN(N) * local;

  return vec4f(dir, sample.pdf);
}

fn apply_filter(N : vec3f) -> vec3f {
  var weight = 0.;
  var color = vec3f();

  let a = info.roughness * info.roughness;
  let a2 = a * a;
  let count = i32(info.sample_count);

  for (var i = 0; i < count; i++) {
    let sample = importance_sample(i, N, a2);
    
    let H = sample.xyz;
    let L = normalize(reflect(-N, H));
    let cosNL = dot(N, L);
    let lod = select(get_lod(sample.w), 0., info.roughness == 0.);

    if (cosNL > 0.) {
      let s = pow(textureSampleLevel(cubemap, samp, L, lod).rgb, vec3f(2.2));
      color += cosNL * s;
      weight += cosNL;
    }  
  }

  if (weight != 0.) { color /= weight; }
  else { color /= info.sample_count; }

  return color;
}

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  let uv = in.uv * 2. - 1.;

  let norm = normalize(uv_to_dir(i32(info.face), uv));
  let color = apply_filter(norm);
  
  return vec4f(pow(color, vec3f(1./2.2)), 1);
}
`;