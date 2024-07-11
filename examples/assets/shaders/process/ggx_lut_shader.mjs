export default /* wgsl */`
@import constants;

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
  sample_count : f32,
};

@group(0) @binding(0) var<storage, read> info : Info;

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
  cosT : f32,
  sinT : f32,
  phi : f32
};

fn GGX(xi : vec2f, a2 : f32) -> Sample {
  var ggx : Sample;
  ggx.cosT = saturate(sqrt((1. - xi.y) / (1.0 + (a2 - 1.0) * xi.y)));
  ggx.sinT = sqrt(1. - ggx.cosT * ggx.cosT);
  ggx.phi = 2.0 * PI * xi.x;

  return ggx;
}

fn importance_sample(idx : i32, N : vec3f, a2 : f32) -> vec3f {
  let xi = hammersley(idx, i32(info.sample_count));
  let sample = GGX(xi, a2);

  let local = normalize(vec3f(
    sample.sinT * cos(sample.phi), 
    sample.sinT * sin(sample.phi), 
    sample.cosT
  ));

  return TBN(N) * local;
}

fn V_Smith(a2 : f32, cosNL : f32, cosNV : f32) -> f32 {
  let GGXL = cosNV * sqrt((1. - a2) * (cosNL * cosNL) + a2);
  let GGXV = cosNL * sqrt((1. - a2) * (cosNV * cosNV) + a2);
  return .5 / (GGXV + GGXL);
}

fn LUT(cosNV : f32, roughness : f32) -> vec2f {
  let V = vec3f(sqrt(1.0 - cosNV * cosNV), 0.0, cosNV);
  let N = vec3(0.0, 0.0, 1.0);

  var A = 0.0;
  var B = 0.0;

  let a = roughness * roughness;
  let a2 = a * a;
  let count = i32(info.sample_count);

  for (var i = 0; i < count; i++) {
    let H = importance_sample(i, N, a2);
    let L = normalize(reflect(-V, H));

    let cosNL = saturate(L.z);
    let cosNH = saturate(H.z);
    let cosVH = saturate(dot(V, H));

    if (cosNV > 0.0) {
      let pdf = V_Smith(a2, cosNL, cosNV) * cosVH * cosNL / cosNH;
      let Fc = pow(1. - cosVH, 5.);
      A += (1. - Fc) * pdf;
      B += Fc * pdf;
    }
  }

  return vec2f(4.0 * A, 4.0 * B) / info.sample_count;
}

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  let lut = LUT(in.uv.x, in.uv.y);
  return vec4f(lut, 0, 1);
}
`;