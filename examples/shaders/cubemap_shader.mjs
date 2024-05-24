export default `
const PI = 3.14159265359;

struct FragInput {
  @builtin(position) position : vec4f,
  @location(0) w_pos : vec3f
}

struct Globals {
  inverse: mat4x4f,
  camera_pos : vec3f,
}

@group(0) @binding(0) var<storage, read> globals: Globals;

@vertex fn vs(@builtin(vertex_index) vertexIndex : u32) -> FragInput {
  var output : FragInput;

  let pos = array(
    vec2f(0,  4),  // top center
    vec2f(-4, -4),  // bottom left
    vec2f(4, -4)   // bottom right
  );

  output.position = vec4f(pos[vertexIndex], 1, 1);
  let l = output.position * globals.inverse;
  output.w_pos = l.xyz * l.w;
  return output;
}

@group(2) @binding(0) var samp: sampler;
@group(2) @binding(1) var cubemap: texture_cube<f32>;

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  let uvw = normalize(in.w_pos - globals.camera_pos) * vec3f(1, 1, -1);
  return textureSample(cubemap, samp, uvw);
}
`;