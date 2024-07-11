export default /* wgsl */`
enable f16;
@import constants, math, tonemap;

struct FragInput {
  @builtin(position) position : vec4f,
  @location(0) uv : vec2f,
}

struct Globals {
  projection_matrix : mat4x4f,
  view_matrix : mat3x4f,
  camera_pos : vec3f,
  @align(16) r_nits : f32,
  r_nb : f32,
}

struct Attributes {
  pos : vec3f,
}

@group(0) @binding(0) var<storage, read> globals: Globals;
@group(2) @binding(0) var<storage, read> attributes: array<f32>;
@group(3) @binding(0) var<storage, read> world_matrix: mat3x4f;

fn read_attributes(vert : u32) -> Attributes {
  var attrib : Attributes;

  let p = vert * 3;
  attrib.pos = vec3f(attributes[p], attributes[p+1], attributes[p+2]);
  return attrib;
}

@vertex fn vs(@builtin(vertex_index) vert: u32) -> FragInput {
  var output : FragInput;

  var attrib = read_attributes(vert);
  output.position = mul44(globals.projection_matrix, mul34(globals.view_matrix, mul34(world_matrix, attrib.pos)));
  output.uv = vec2f(attrib.pos.x, -attrib.pos.y) * .5 + .5;

  return output;
}

@group(1) @binding(0) var samp: sampler;
@group(1) @binding(1) var luminance: texture_2d<f32>;

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  var L = textureSample(luminance, samp, in.uv).rgb;
  let Ln = phoptics_tonemap(L, globals.r_nb, globals.r_nits);
  let output = pow(Ln, vec3f(1./2.2));

  return vec4f(output, 1.);
}`;