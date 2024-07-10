export default /* wgsl */`
fn mul33(m : mat3x3f, v : vec3f) -> vec3f {
  return v * m;
}

fn mul34(m : mat3x4f, v : vec3f) -> vec3f {
  let mt = transpose(m);
  return v.x * mt[0] + (v.y * mt[1] + (v.z * mt[2] + mt[3]));
}

fn mul44(m : mat4x4f, v : vec3f) -> vec4f {
  let mt = transpose(m);
  return v.x * mt[0] + (v.y * mt[1] + (v.z * mt[2] + mt[3]));
}
`;