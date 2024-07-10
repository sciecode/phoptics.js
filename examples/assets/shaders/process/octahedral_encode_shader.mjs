export default /* wgsl */`
@import encoding;

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

struct Mapping {
  offset: f32, 
  slope:  f32, 
  mip:  f32,
}

@group(1) @binding(0) var samp: sampler;
@group(1) @binding(1) var cubemap: texture_cube<f32>;
@group(1) @binding(2) var<storage, read> dim: Mapping;

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  let dir = dec_oct_uv(oct_expand(in.uv, dim.slope, dim.offset)) * vec3f(1, 1, -1);
  var col = pow(textureSampleLevel(cubemap, samp, dir, dim.mip).rgb, vec3f(2.2)); // LDR - sRGB
  return vec4f(col,1);
}`;