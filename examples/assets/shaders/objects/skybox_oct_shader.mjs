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

struct Mapping {
  outset: f32,
  scale: f32,
  mip: f32
}

@group(2) @binding(0) var samp: sampler;
@group(2) @binding(1) var envmap: texture_2d<f32>;
@group(2) @binding(2) var<storage, read> dim : Mapping;

fn phoptics_tonemap(L : vec3f, ev2: f32, nits : f32) -> vec3f {
  let ev10 = (ev2 - 1.) * .301029995;
  let black = pow(10, -ev10);
  let base = (L - black) / (nits * black);
  
  let sat = max(vec3f(0), base - 1);
  let Ln = base + (sat.x + sat.y + sat.z) * .33333333;
  return Ln;
}

fn border_contract(qw : vec2f) -> vec2f {
  return qw / dim.scale + dim.outset;
}

fn enc_oct_uv(nor : vec3f) -> vec2f {
  var n = nor.xy / (abs(nor.x) + abs(nor.y) + abs(nor.z));
  let sgn = select(vec2f(-1.), vec2f(1.), n >= vec2f(0));
  n = select((1.0-abs(n.yx)) * sgn, n.xy, nor.z >= 0.0);
  // outputs WebGPU uv [0,0] top-left corner
  return vec2f(n.x, -n.y) * .5 + .5;
}

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  var dir = in.dir;
  var st = border_contract(enc_oct_uv(normalize(dir)));
  var L = textureSampleLevel(envmap, samp, st, dim.mip).rgb;
  let Ln = phoptics_tonemap(L, globals.exposure, globals.nits);
  let output = pow(Ln, vec3f(1./2.2));
  return vec4f(output, 1);
}
`;