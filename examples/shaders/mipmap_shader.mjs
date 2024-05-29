export default `
struct FragInput {
  @builtin(position) position : vec4f,
  @location(0) uv : vec2f,
}

struct Info {
  face : f32,
  lod : f32
};

@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var cubemap: texture_cube<f32>;
@group(0) @binding(2) var<storage, read> info : Info;

fn uv_to_dir(face : i32, uv : vec2f) -> vec3f {
	if (face == 0) {      return vec3f(     1.f,   uv.y,    -uv.x); }
	else if (face == 1) { return vec3f(    -1.f,   uv.y,     uv.x); }
	else if (face == 2) { return vec3f(    uv.x,    1.f,    -uv.y); }
	else if (face == 3) { return vec3f(    uv.x,   -1.f,     uv.y); }
	else if (face == 4) { return vec3f(    uv.x,   uv.y,      1.f); }
	else {                return vec3f(   -uv.x,   uv.y,     -1.f); }
}

@vertex fn vs(@builtin(vertex_index) vertexIndex : u32) -> FragInput {
  var output : FragInput;

  let coord = vec2f(f32((vertexIndex & 1) << 2), f32((vertexIndex & 2) << 1));
  output.position = vec4f(coord - 1., .5, 1);
  output.uv = coord * .5;

  return output;
}

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  let uv = in.uv * 2. - 1.;
  let color = textureSampleLevel(cubemap, samp, uv_to_dir(i32(info.face), uv), info.lod).rgb;
  return vec4f(pow(color, vec3f(1./2.2)), 1);
}
`;