export const shader = `
struct GlobalUniforms {
  aspect : f32,
}

struct Attributes {
  @location(0) position: vec2f,
}

@group(0) @binding(0) var<storage, read> globals: GlobalUniforms;

@vertex fn vs(attrib : Attributes) -> @builtin(position) vec4f {
  return vec4f(attrib.position / vec2f(globals.aspect, 1), 0.0, 1.0);
}

@fragment fn fs() -> @location(0) vec4f {
  return vec4f(1.0, 0.0, 0.0, 1.0);
}
`;