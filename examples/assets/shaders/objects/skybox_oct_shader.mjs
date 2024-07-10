export default `
struct FragInput {
  @builtin(position) position : vec4f,
  @location(0) dir : vec3f,
}

struct Globals {
  projection_matrix : mat4x4f,
  view_matrix : mat3x4f,
  camera_pos : vec3f,
  null0 : f32, // unused
  nits : f32,
  exposure : f32,
}

struct Attributes {
  pos: vec3f,
}

@group(0) @binding(0) var<storage, read> globals: Globals;
@group(2) @binding(0) var<storage, read> attributes: array<f32>;

fn mul34(m : mat3x4f, v : vec3f) -> vec3f {
  let mt = transpose(m);
  return v.x * mt[0] + (v.y * mt[1] + (v.z * mt[2] + mt[3]));
}

fn mul44(m : mat4x4f, v : vec3f) -> vec4f {
  let mt = transpose(m);
  return v.x * mt[0] + (v.y * mt[1] + (v.z * mt[2] + mt[3]));
}

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

struct Mapping {
  offset: f32,  
  slope: f32,
  mip: f32
}

@group(1) @binding(0) var samp: sampler;
@group(1) @binding(1) var envmap: texture_2d<f32>;
@group(1) @binding(2) var<storage, read> dim : Mapping;

const R3_3 = vec3f(1./3.);
fn phoptics_tonemap(L : vec3f, r_nb: f32, r_nits : f32) -> vec3f {
  // remap luminance to (L-black) / (nits * black)
  let base = fma(L, vec3f(r_nb), -vec3f(r_nits));

  // distribute saturated luminance between channels
  let sat = saturate(fma(base, R3_3, -R3_3));
  return base + (sat.x + sat.y + sat.z);
}

// offset = .5 / scale + outset
// slope = .5 / scale
fn border_contract(qw : vec2f) -> vec2f { return qw * dim.slope + dim.offset; }

fn enc_oct_uv(nor : vec3f) -> vec2f {
  var oct = 1. / (abs(nor.x) + abs(nor.y) + abs(nor.z));
  let t = vec2f(saturate(-nor.z * oct));
  let n = nor.xy * oct + select(-t, t, nor.xy > vec2f());
  // outputs WebGPU uv [0,0] top-left corner
  return border_contract(vec2f(n.x, -n.y));
}

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  var L = textureSampleLevel(envmap, samp, enc_oct_uv(in.dir), dim.mip).rgb;
  let Ln = phoptics_tonemap(L, globals.exposure, globals.nits);
  let output = pow(Ln, vec3f(1./2.2));
  return vec4f(output, 1);
}
`;