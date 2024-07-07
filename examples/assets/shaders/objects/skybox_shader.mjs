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

@group(1) @binding(0) var samp: sampler;
@group(1) @binding(1) var cubemap: texture_cube<f32>;

const R3_3 = vec3f(1./3.);
fn phoptics_tonemap(L : vec3f, ev2: f32, nits : f32) -> vec3f {
  // remap luminance to (L-black) / (nits * black)
  let r_nits = 1 / nits;
  let r_nb = .5 * exp2(ev2) * r_nits; // can pre-calculate reciprocals on CPU
  let base = fma(L, vec3f(r_nb), -vec3f(r_nits));

  // distribute saturated luminance between channels
  let sat = saturate(fma(base, R3_3, -R3_3));
  return base + (sat.x + sat.y + sat.z);
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