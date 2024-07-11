export default /* wgsl */`
@import constants;
fn phoptics_tonemap(L : vec3f, r_nb: f32, r_nits : f32) -> vec3f {
  // remap luminance to (L-black) / (nits * black)
  let base = fma(L, vec3f(r_nb), -vec3f(r_nits));

  // distribute saturated luminance between channels
  let sat = saturate(fma(base, vec3f(R_3), -vec3f(R_3)));
  return base + (sat.x + sat.y + sat.z);
}
`;