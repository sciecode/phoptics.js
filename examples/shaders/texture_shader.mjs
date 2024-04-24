
export default `
struct FragInput {
  @builtin(position) position : vec4f,
  @location(0) uv : vec2f,
}

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

  return output;
}

@group(0) @binding(0) var tex: texture_2d<f32>;
@group(0) @binding(1) var usampler: sampler;

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  let color = vec3f(in.uv.x);
  var p : f32;
  let tex_color = textureSample(tex, usampler, vec2f(.5)).rgb;
  return vec4f(pow(select(color, tex_color, in.uv.y < .5), vec3f(1./2.2)), 1);
}`;