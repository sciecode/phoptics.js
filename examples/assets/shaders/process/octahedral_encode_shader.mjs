export default `
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

fn dec_oct_uv(uv : vec2f) -> vec3f {
  var v = oct_border(uv) * 2. - 1.;
  let z = - 1. + abs(v.x) + abs(v.y);
  let t = vec2f(saturate(z));
  v += select(t, -t, v > vec2f());
  return vec3f(v, z);
}

// offset = - outset * scale
// slope = scale
fn oct_border(qw : vec2f) -> vec2f {
  let uv = qw * dim.slope + dim.offset;
  var st = select(uv, vec2f(1. - fract(uv.x), 1. - uv.y), (uv.x < 0.) | (uv.x > 1.));
  st = select(st, vec2f(1. - st.x, 1. - fract(st.y)), (uv.y < 0.) | (uv.y > 1.));
  return st;
}

struct Mapping {
  offset: f32, 
  slope:  f32, 
  mip:  f32,
}

@group(1) @binding(0) var samp: sampler;
@group(1) @binding(1) var cubemap: texture_cube<f32>;
@group(1) @binding(2) var<storage, read> dim: Mapping;

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  var col = pow(textureSampleLevel(cubemap, samp, dec_oct_uv(in.uv), dim.mip).rgb, vec3f(2.2)); // LDR - sRGB
  return vec4f(col,1);
}`;