export default /* wgsl */`
@import constants, math;

struct FragInput {
  @builtin(position) position : vec4f,
  @location(0) @interpolate(flat) aa: vec2f,
  @location(1) @interpolate(flat) bb: vec2f,
  @location(2) @interpolate(flat) cc: vec2f,
  @location(3) pp: vec2f,
}

struct Globals {
  projection_matrix : mat4x4f,
  view_matrix : mat3x4f,
  camera_pos : vec3f,
}

@group(0) @binding(0) var<storage, read> globals: Globals;
@group(2) @binding(0) var<storage, read> attributes: array<f32>;
@group(3) @binding(0) var<storage, read> world_matrix: mat3x4f;

fn read_pos(vert : u32) -> vec3f {
  let p = vert * 3;
  return vec3f(attributes[p], attributes[p+1], attributes[p+2]);
}

fn sdf(p : vec2f, p0 : vec2f, p1 : vec2f, p2 : vec2f) -> f32{
    var e0 = p1 - p0; var e1 = p2 - p1; var e2 = p0 - p2;
    var v0 = p - p0; var v1 = p - p1; var v2 = p - p2;
    var pq0 = v0 - e0*clamp( dot(v0,e0)/dot(e0,e0), 0.0, 1.0 );
    var pq1 = v1 - e1*clamp( dot(v1,e1)/dot(e1,e1), 0.0, 1.0 );
    var pq2 = v2 - e2*clamp( dot(v2,e2)/dot(e2,e2), 0.0, 1.0 );
    var s = sign( e0.x * e2.y - e0.y * e2.x );
    var d = min(min(vec2f(dot(pq0,pq0), s*(v0.x*e0.y-v0.y*e0.x)),
                     vec2f(dot(pq1,pq1), s*(v1.x*e1.y-v1.y*e1.x))),
                     vec2f(dot(pq2,pq2), s*(v2.x*e2.y-v2.y*e2.x)));
    return -sqrt(d.x)*sign(d.y);
}

@vertex fn vs(@builtin(vertex_index) vert: u32) -> FragInput {
  var output : FragInput;

  var base = vert / 3;
  var a = mul34(world_matrix, read_pos(vert));
  var b = mul34(world_matrix, read_pos((vert + 1) % 3));
  var c = mul34(world_matrix, read_pos((vert + 2) % 3));
  var bar = (a + b + c) / 3.;

  output.aa = a.xy;
  output.bb = b.xy;
  output.cc = c.xy;
  a += vec3f(normalize(a.xy - bar.xy), 0);
  output.pp = a.xy;

  output.position = mul44(globals.projection_matrix, mul34(globals.view_matrix, a));

  return output;
}

// @group(1) @binding(0) var samp: sampler;
// @group(1) @binding(1) var luminance: texture_2d<f32>;

@fragment fn fs(in : FragInput) -> @location(0) vec4f {
  // var L = textureSample(luminance, samp, in.uv).rgb;

  var d = sdf(in.pp, in.aa, in.bb, in.cc);

  var color = 1. - sign(d) * vec3f(.1, .4, .7);
	color *= 1.0 - exp(-4.0 * abs(d));
	color *= 0.8 + 0.2 * cos(140.0 * d);
	color = mix(color, vec3f(1.0), 1.0 - smoothstep(0.0, 0.015, abs(d)));
  return vec4f(color, 1);

  // return vec4f(vec3f(d), 1);
}`;