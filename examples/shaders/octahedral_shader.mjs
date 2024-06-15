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

@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var cubemap: texture_cube<f32>;
@group(0) @binding(2) var<storage, read> globals: vec4f;

fn dec_oct_uv(uv : vec2f) -> vec3f {
  let v = uv / .5 - 1.;
  var nor = vec3f(v, 1.0 - abs(v.x) - abs(v.y));
  let t = max(-nor.z, 0);
  nor.x += select(t, -t, nor.x > 0.);
  nor.y += select(t, -t, nor.y > 0.);
  return normalize(nor);
}

fn oct_border(qw : vec2f) -> vec2f {
  let ext = globals.x; let border = globals.y;
  let I = ext - 2. * border;
  let uv = (qw - border/ext) * ext/I;
  var st = uv;
  st = select(st, vec2f(1. - fract(st.x), 1. - st.y), uv.x < 0. || uv.x > 1.);
  st = select(st, vec2f(1. - st.x, 1. - fract(st.y)), uv.y < 0. || uv.y > 1.);
  return st;
}

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  let st = oct_border(in.uv);
  let dir = dec_oct_uv(st);
  var col = pow(textureSampleLevel(cubemap, samp, dir, globals.z).rgb, vec3f(2.2)); // LDR - sRGB
  // if (abs(dir.x) < 0.005) {
  //   col = vec3f(1, .5, .5);
  // } else if ( abs(dir.y) < 0.005) {
  //   col = vec3f(.5, 1, .5);
  // } else if (abs(dir.z) < 0.005) {
  //   col = vec3f(.5, .5, 1);
  // }
  return vec4f(col,1);
}`;