export default /* wgsl */`
// input: uv [-1,1]
// output: normal [-1,1]
fn dec_oct_uv(uv : vec2f) -> vec3f {
  let z = - 1. + abs(uv.x) + abs(uv.y);
  let t = vec2f(saturate(z));
  let v = uv + select(t, -t, uv > vec2f());
  return vec3f(v, -z);
}

// input: octahedral normal u16
// output: normal [-1,1]
fn dec_oct16(data : u32) -> vec3f {
  var v = vec2f(vec2u(data, data >> 8) & vec2u(255)) / 127.5 - 1;
  return dec_oct_uv(v);
}

// input: unit normal
// output: uv [-1,1]
fn enc_oct_uv(nor : vec3f) -> vec2f {
  var oct = 1. / (abs(nor.x) + abs(nor.y) + abs(nor.z));
  let t = vec2f(saturate(-nor.z));
  let n = (nor.xy + select(-t, t, nor.xy > vec2f())) * oct;
  return vec2f(n.x, -n.y);
}

// input: uv [0,1]
// output: uv [-1,1]
fn oct_expand(qw : vec2f, slope: f32, offset: f32) -> vec2f {
  let uv = qw * slope + offset;
  var st = select(uv, vec2f(1. - fract(uv.x), 1. - uv.y), (uv.x < 0.) | (uv.x > 1.));
  st = select(st, vec2f(1. - st.x, 1. - fract(st.y)), (uv.y < 0.) | (uv.y > 1.));
  return st * 2. - 1.;
}

// input: uv [0,1]
// output: uv [0,1]
fn oct_contract(uv : vec2f, slope: f32, offset: f32) -> vec2f { return uv * slope + offset; }
`;