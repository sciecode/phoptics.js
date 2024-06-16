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
  output.uv.y = 1 - output.uv.y;
  
  return output;
}

fn dec_oct_uv(uv : vec2f) -> vec3f {
  let v = uv / .5 - 1.;
  // assumes input uv [0,0] top-left corner (WebGPU)
  var nor = vec3f(v.x, -v.y, 1.0 - abs(v.x) - abs(v.y));
  let t = max(-nor.z, 0);
  nor.x += select(t, -t, nor.x > 0.);
  nor.y += select(t, -t, nor.y > 0.);
  return normalize(nor);
}

fn oct_border(qw : vec2f) -> vec2f {
  let uv = (qw - dim.outset) * dim.scale;
  var st = uv;
  st = select(st, vec2f(1. - fract(st.x), 1. - st.y), uv.x < 0. || uv.x > 1.);
  st = select(st, vec2f(1. - st.x, 1. - fract(st.y)), uv.y < 0. || uv.y > 1.);
  return st;
}

struct Mapping {
  outset: f32,
  scale:  f32,
  mip:  f32,
}

@group(2) @binding(0) var samp: sampler;
@group(2) @binding(1) var cubemap: texture_cube<f32>;
@group(2) @binding(2) var<storage, read> dim: Mapping;

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  var st = oct_border(in.uv);
  let dir = dec_oct_uv(st) * vec3(1, 1, -1);
  var col = pow(textureSampleLevel(cubemap, samp, dir, dim.mip).rgb, vec3f(2.2)); // LDR - sRGB
  return vec4f(col,1);
}`;