export const shader = `
struct GlobalUniforms {
  projection_matrix : mat4x4f,
  view_matrix : mat3x4f,
}

struct Attributes {
  @location(0) position: vec2f,
  @location(1) color: vec3f,
}

struct vOutput {
  @builtin(position) position : vec4f,
  @location(0) color : vec3f,
}

@group(0) @binding(0) var<storage, read> globals: GlobalUniforms;

@vertex fn vs(attrib : Attributes) -> vOutput {
  var output : vOutput;

  var v_pos = vec4f(attrib.position, 0, 1) * globals.view_matrix;
  var c_pos = vec4f(v_pos, 1) * globals.projection_matrix;

  output.position = c_pos;
  output.color = attrib.color;

  return output;
}

@fragment fn fs(in : vOutput) -> @location(0) vec4f {
  var l_color = vec3f(in.color * .5 + .5);
  return vec4f(l_color, 1.0);
}
`;