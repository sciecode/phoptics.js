export default `
struct FragInput {
  @builtin(position) position : vec4f,
  @location(0) dir : vec3f,
}

struct Attributes {
  @location(0) pos: vec3f,
}

struct Globals {
  projection_matrix : mat4x4f,
  view_matrix : mat3x4f,
  camera_pos : vec3f,
  null0 : f32, // unused
  nits : f32,
  exposure : f32,
}

@group(0) @binding(0) var<storage, read> globals: Globals;

@vertex fn vs(attrib : Attributes) -> FragInput {
  var output : FragInput;

  var view = globals.view_matrix;
  view[0].w = 0;
  view[1].w = 0;
  view[2].w = 0;

  var c_pos = vec4f(vec4f(attrib.pos, 1) * view, 1) * globals.projection_matrix;
  c_pos.z = 0.00000001;

  output.position = c_pos;
  output.dir = attrib.pos;
  
  return output;
}

@group(2) @binding(0) var samp: sampler;
@group(2) @binding(1) var cubemap: texture_cube<f32>;

fn phoptics_tonemap(L : vec3f, ev2: f32, nits : f32) -> vec3f {
  let ev10 = (ev2 - 1.) * .301029995;
  let black = pow(10, -ev10);
  let base = (L - black) / (nits * black);
  
  let sat = max(vec3f(0), base - 1);
  let Ln = base + (sat.x + sat.y + sat.z) * .33333333;
  return Ln;
}

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  var dir = in.dir;
  dir.z *= -1;
  var L = pow(textureSample(cubemap, samp, dir).rgb, vec3f(2.2)) * globals.nits; // nits boost SDR cubemap
  let Ln = phoptics_tonemap(L, globals.exposure, globals.nits);
  let output = pow(Ln, vec3f(1./2.2));
  return vec4f(output, 1);
}
`;