export default `
const PI = 3.14159265359;

struct FragInput {
  @builtin(position) position : vec4f,
  @location(0) uv : vec2f,
}

struct Globals {
  boost: f32,
}

@group(0) @binding(0) var<storage, read> globals: Globals;

@vertex fn vs(@builtin(vertex_index) vertexIndex : u32) -> FragInput {
  var output : FragInput;

  let pos = array(
    vec2f( 0,  4),  // top center
    vec2f(-4, -4),  // bottom left
    vec2f( 4, -4)   // bottom right
  );

  let c_pos = pos[vertexIndex];

  output.position = vec4f(c_pos, .5, 1);
  output.uv = (c_pos + 1) * .5;
  output.uv.y = 1. - output.uv.y;

  return output;
}

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  var data = vec3f(in.uv, 0) * globals.boost;
  return vec4f(data, 1);
}
`;