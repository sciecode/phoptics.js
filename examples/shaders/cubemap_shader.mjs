export default `
const PI = 3.14159265359;

struct FragInput {
  @builtin(position) position : vec4f,
}

struct Globals {
  camera_pos : vec3f,
  res: vec2f,
}

@group(0) @binding(0) var<storage, read> globals: Globals;
@group(2) @binding(0) var samp: sampler;
@group(2) @binding(1) var cubemap: texture_cube<f32>;

@vertex fn vs(@builtin(vertex_index) vertexIndex : u32) -> FragInput {
  var output : FragInput;

  let pos = array(
    vec2f( 0,  4),  // top center
    vec2f(-4, -4),  // bottom left
    vec2f( 4, -4)   // bottom right
  );

  output.position = vec4f(pos[vertexIndex], 0, 1);
  return output;
}

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  var p = (2 * in.position.xy - globals.res.xy) / globals.res.y * vec2f(1, -1);
  let ww = -normalize(globals.camera_pos);
  let uu = normalize(cross(ww,vec3f(0.0,1.0,0.0)));
  let vv = normalize(cross(uu,ww));
  let uvw = normalize(p.x*uu + p.y*vv + .9*ww) * vec3f(1, 1, -1);
  return textureSample(cubemap, samp, uvw);
}
`;