export const shader = `
struct GlobalUniforms {
  aspect : f32,
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
  output.position = vec4f(attrib.position / vec2f(globals.aspect, 1), 0.0, 1.0);
  output.color = attrib.color;
  return output;
}

@fragment fn fs(in : vOutput) -> @location(0) vec4f {

  return vec4f(in.color * .5 + .5, 1.0);
}
`;