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

@group(0) @binding(0) var usampler: sampler;
@group(0) @binding(1) var data_tex: texture_2d<f32>;
@group(0) @binding(2) var srgb_tex: texture_2d<f32>;
@group(0) @binding(3) var ext_tex: texture_2d<f32>;

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  let x = clamp(in.uv.x * 2. - .5, 0, 1);
  const color1 = vec4f(1, 0, 0, 1) * 1;
  const color2 = vec4f(0, .5, 0, 1) * .25;
  var color = mix(color1, color2, x);

  let t_color = textureSample(data_tex, usampler, vec2f(in.uv.x, .5));
  let e_color = textureSample(ext_tex, usampler, vec2f(in.uv.x, .5));
  let s_color = textureSample(srgb_tex, usampler, vec2f(in.uv.x, .5));

  if (in.uv.y > .75) { color = s_color; }
  else if (in.uv.y > .5) { color = vec4f(e_color.rgb * e_color.a, e_color.a); }
  else if (in.uv.y > .25) { color = t_color; }

  var bg_blending = color + (1. - color.a) * vec4f(0, 0, 0, 1); // premultiplied-alpha blend with black-bg
  var undo_premul = bg_blending.rgb;
  if (bg_blending.a > 0.) { undo_premul /= bg_blending.a; }
  return vec4f(pow(undo_premul, vec3f(1./2.2)), 1.);
}`;