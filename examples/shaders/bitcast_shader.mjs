export default `
enable f16;
struct FragInput { @builtin(position) position : vec4f }
struct Globals { resolution : vec2f }

@vertex fn vs(@builtin(vertex_index) vertexIndex : u32) -> FragInput {
  var output : FragInput;

  let pos_arr = array(
    vec3f( -5, -5, .5 ),
    vec3f(  5, -5, .5 ),
    vec3f(  5,  5, .5 ),
    vec3f( -5, -5, .5 ),
    vec3f(  5,  5, .5 ),
    vec3f( -5,  5, .5 ),
  );

  output.position = vec4f(pos_arr[vertexIndex], 1.);
  return output;
}

@group(0) @binding(0) var<storage, read> globals: Globals;

@fragment fn fs(in : FragInput) -> @location(0) vec4f {

  var h = .5 * globals.resolution.y * globals.resolution.x;
  var ff = in.position.y * globals.resolution.x + in.position.x;
  var id = u32(fract(ff / h) * 0xffff);

  if (in.position.y > globals.resolution.y * .5) {
    var ff = bitcast<vec2h>(id);
    id = bitcast<u32>(ff) & 0xffff;
  }

  var color = vec3f(f32(id & 255), f32((id >> 8) & 255), 0) / 255.;
  return vec4f(color, 1.);
}`;