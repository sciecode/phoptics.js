export const lighting_shader = `
const PI = 3.14159265359;

struct FragInput {
  @builtin(position) position : vec4f,
  @location(0) uv : vec2f,
}

struct GlobalUniforms {
  projection_matrix : mat4x4f,
  view_matrix : mat3x4f,
  camera_pos : vec3f,
  nits : f32,
}

@group(0) @binding(0) var<storage, read> globals: GlobalUniforms;
@group(1) @binding(0) var gsampler: sampler;
@group(1) @binding(1) var gbuffer_pos: texture_2d<f32>;
@group(1) @binding(2) var gbuffer_norm: texture_2d<f32>;

@vertex fn vs(@builtin(vertex_index) vertexIndex : u32) -> FragInput {
  var output : FragInput;

  let pos = array(
    vec2f( 0,  4),  // top center
    vec2f(-4, -4),  // bottom left
    vec2f( 4, -4)   // bottom right
  );

  let uv = pos[vertexIndex];
  var c_pos = vec4f(uv, 0.5, 1.0);

  output.position = c_pos;
  output.uv = (uv + vec2f(1.)) * .5;
  output.uv.y = 1. - output.uv.y;

  return output;
}

struct RenderInfo {
  Ldd   : vec3f,
  pos   : vec3f,
  V     : vec3f,
  N     : vec3f,
  cosNV : f32
}

fn Fd_Lambert() -> f32 {
  return 1.0 / PI;
}

fn point_light(frag : ptr<function, RenderInfo>, l_pos : vec3f, l_color : vec3f, Il : f32) {
  let l = l_pos - (*frag).pos;
  let d2 = pow(length(l) / 100., 2.);
  let Ep = Il * l_color / d2;

  let L = normalize(l);
  // let H = normalize((*frag).V + L);

  let cosNL = max(dot((*frag).N, L), 0.);
  // let cosLH = max(dot(L, H), 0.);

  (*frag).Ldd += Ep * Fd_Lambert() * cosNL;
}

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  let pos = textureSample(gbuffer_pos, gsampler, in.uv);
  if (pos.w != 1.) { discard; }

  let norm = textureSample(gbuffer_norm, gsampler, in.uv).rgb;

  var frag : RenderInfo;
  frag.pos = pos.xyz;
  frag.V = normalize(globals.camera_pos - frag.pos);
  frag.N = normalize(norm);
  frag.cosNV = max(dot(frag.V, frag.N), 0.);

  point_light(&frag,
    vec3f(0, 100, 100),   // position
    vec3f(1),             // color
    400.                  // intensity
  );

  point_light(&frag,
    vec3f(60, 0, 20),     // position
    vec3f(0, .1, 1),      // color
    200.                  // intensity
  );

  point_light(&frag,
    vec3f(-100, 30, -20), // position
    vec3f(1, .3, .2),     // color
    500.                  // intensity
  );

  let albedo = .5;
  let L = albedo * frag.Ldd;
  let Lf = pow(L / globals.nits, vec3f(1./2.2));
  return vec4f(Lf, 1);
}
`;