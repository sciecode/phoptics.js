export const shader = `
struct GlobalUniforms {
  projection_matrix : mat4x4f,
  view_matrix : mat3x4f,
}

struct Attributes {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
}

struct vOutput {
  @builtin(position) position : vec4f,
  @location(0) w_pos : vec3f,
  @location(1) w_normal : vec3f,
}

@group(0) @binding(0) var<storage, read> globals: GlobalUniforms;

@vertex fn vs(attrib : Attributes) -> vOutput {
  var output : vOutput;

  var v_pos = vec4f(attrib.position, 1) * globals.view_matrix;
  var c_pos = vec4f(v_pos, 1) * globals.projection_matrix;

  output.position = c_pos;
  output.w_pos = attrib.position;
  output.w_normal = attrib.normal;

  return output;
}

fn point_light(in : vOutput, l_pos : vec3f, l_color : vec3f, l_intensity : f32) -> vec3f {

  let l = l_pos - in.w_pos;
  let d2 = pow(length(l) / 100., 2.);

  let dotNL = clamp(dot(in.w_normal, normalize(l)), 0., 1.);
  let perp_illuminance = l_intensity * l_color / d2;

  const BRDF_diff = .5 / 3.141592;

  return BRDF_diff * perp_illuminance * dotNL;

}

@fragment fn fs(in : vOutput) -> @location(0) vec4f {

  var luminance = vec3f();
  
  luminance += point_light(in, 
    vec3f(0, 100, 100),   // position
    vec3f(1),             // color
    400.                  // intensity
  );

  luminance += point_light(in,
    vec3f(60, 0, 20),     // position
    vec3f(0, .1, 1),      // color
    200.                  // intensity
  );

  luminance += point_light(in, 
    vec3f(-100, 30, -20), // position
    vec3f(1, .3, .2),     // color 
    500.                  // intensity
  );

  let l_color = pow(luminance / 250., vec3f(1./2.4));

  // var l_color = vec3f(in.w_normal * .5 + .5);

  return vec4f(l_color, 1);
}
`;