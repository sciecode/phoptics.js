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

fn read_attribute(vert : u32) -> Attributes {
  var attrib : Attributes;

  let p = vert * 3;
  attrib.pos = vec3f(attributes[p], attributes[p+1], attributes[p+2]);
  return attrib;
}

@vertex fn vs(@builtin(vertex_index) vert: u32) -> FragInput {
  var output : FragInput;

  var view = globals.view_matrix;
  view[0].w = 0;
  view[1].w = 0;
  view[2].w = 0;

  var attrib = read_attribute(vert);
  var c_pos = vec4f(vec4f(attrib.pos, 1) * view, 1) * globals.projection_matrix;
  c_pos.z = 0.00000001;

  output.position = c_pos;
  output.dir = attrib.pos;
  
  return output;
}


@group(1) @binding(0) var samp: sampler;
@group(1) @binding(1) var cubemap: texture_cube<f32>;

const R3_3 = vec3f(.333333333333333);
fn phoptics_tonemap(L : vec3f, ev2: f32, nits : f32) -> vec3f {
  let black = exp2(1 - ev2);

  // remap luminance to (L-black) / (nits * black)
  let r_nits = 1 / nits;
  let r_nb = (1 / black) * r_nits;  // should force rcp once available
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