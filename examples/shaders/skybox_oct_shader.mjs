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
@group(2) @binding(1) var envmap: texture_2d<f32>;
@group(2) @binding(2) var<storage, read> size : vec2f;

fn phoptics_tonemap(L : vec3f, ev2: f32, nits : f32) -> vec3f {
  let ev10 = (ev2 - 1.) * .301029995;
  let black = pow(10, -ev10);
  let base = (L - black) / (nits * black);
  
  let sat = max(vec3f(0), base - 1);
  let Ln = base + (sat.x + sat.y + sat.z) * .33333333;
  return Ln;
}

fn border_contract(qw : vec2f) -> vec2f {
  let ext = size.x; let border = size.y;
  let I = ext - 2. * border;
  let uv = qw / (ext/I) + border/ext;
  return uv;
}

fn msign(v : vec2f) -> vec2f {
  return vec2f( 
    select(-1., 1., v.x >= 0), 
    select(-1., 1., v.y >= 0) 
  );
}

fn enc_oct_uv(nor : vec3f) -> vec2f {
  var n = nor.xy;
  n /= (abs(nor.x) + abs(nor.y) + abs(nor.z));
  n = select((1.0-abs(n.yx)) * msign(n.xy), n.xy, nor.z >= 0.0);
  return n * .5 + .5;
}

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  var dir = in.dir * vec3(1, 1, -1);
  var st = border_contract(enc_oct_uv(normalize(dir)));
  st.y = 1. - st.y;
  var L = textureSample(envmap, samp, st).rgb * globals.nits; // nits boost SDR cubemap
  let Ln = phoptics_tonemap(L, globals.exposure, globals.nits);
  let output = pow(Ln, vec3f(1./2.2));
  return vec4f(output, 1);
}
`;