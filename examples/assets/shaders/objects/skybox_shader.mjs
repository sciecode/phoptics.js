export default /* wgsl */`

@import math, tonemap;

struct FragInput {
  @builtin(position) position : vec4f,
  @location(0) dir : vec3f,
}

struct Globals {
  projection_matrix : mat4x4f,
  view_matrix : mat3x4f,
  camera_pos : vec3f,
  @align(16) nits : f32,
  exposure : f32,
}

struct Attributes {
  pos: vec3f,
}

@group(0) @binding(0) var<storage, read> globals: Globals;
@group(2) @binding(0) var<storage, read> attributes: array<f32>;

fn read_attribute(vert : u32) -> Attributes {
  var attrib : Attributes;

  let p = vert * 3;
  attrib.pos = vec3f(attributes[p], attributes[p+1], attributes[p+2]);
  return attrib;
}

@vertex fn vs(@builtin(vertex_index) vert: u32) -> FragInput {
  var output : FragInput;

  output.dir = read_attribute(vert).pos;

  var view = globals.view_matrix;
  view[0].w = 0; view[1].w = 0; view[2].w = 0;

  output.position = mul44(globals.projection_matrix, mul34(view, output.dir));
  output.position.z = 0.00000001;

  return output;
}

@group(1) @binding(0) var samp: sampler;
@group(1) @binding(1) var cubemap: texture_cube<f32>;

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  var dir = in.dir;
  dir.z *= -1;
  var L = pow(textureSample(cubemap, samp, dir).rgb, vec3f(2.2)) * 250; // nits boost SDR cubemap
  let Ln = phoptics_tonemap(L, globals.exposure, globals.nits);
  let output = pow(Ln, vec3f(1./2.2));
  return vec4f(output, 1);
}
`;