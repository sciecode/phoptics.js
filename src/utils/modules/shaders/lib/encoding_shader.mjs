export default /* wgsl */`
// input: uv [0,1]
fn dec_oct_uv(uv : vec2f) -> vec3f {
  var v = oct_border(uv) * 2. - 1.;
  let z = - 1. + abs(v.x) + abs(v.y);
  let t = vec2f(saturate(z));
  v += select(t, -t, v > vec2f());
  return vec3f(v, z);
}

// input: uv [0,1]
fn oct_border(qw : vec2f) -> vec2f {
  // slope = scale
  // offset = - outset * scale
  let uv = qw * dim.slope + dim.offset;
  var st = select(uv, vec2f(1. - fract(uv.x), 1. - uv.y), (uv.x < 0.) | (uv.x > 1.));
  st = select(st, vec2f(1. - st.x, 1. - fract(st.y)), (uv.y < 0.) | (uv.y > 1.));
  return st;
}
// input: uv [-1,1]
fn border_contract(uv : vec2f) -> vec2f { return uv * dim.slope + dim.offset; }

// input: unit normal
// output: uv [-1,1]
fn enc_oct_uv(nor : vec3f) -> vec2f {
  var oct = 1. / (abs(nor.x) + abs(nor.y) + abs(nor.z));
  let t = vec2f(saturate(-nor.z));
  let n = (nor.xy + select(-t, t, nor.xy > vec2f())) * oct;
  return border_contract(vec2f(n.x, -n.y));
}`;