
export class Shader {
  constructor(device, resources, options = {}) {
    const formats = resources.get_render_target(options.render_target).formats;
    const empty_layout = resources.empty_layout;

    const groups = new Array(4);
    for (let i = 0; i < 3; i++)
      groups[i] = options.group_layouts[i] || empty_layout;
    groups[3] = options.dynamic_layout || empty_layout;

    const layout = device.createPipelineLayout({
      bindGroupLayouts: groups,
    });

    const module = device.createShaderModule({
      code: options.code,
      hints: {
        vertexMain: { layout: layout },
        fragmentMain: { layout: layout },
      }
    });

    const descriptor = {
      layout: layout,
      vertex: {
        module: module,
        constants: options.constants,
        entryPoint: options.vertex_entry || 'vs',
        buffers: options.vertex_buffers,
      },
      fragment: {
        module: module,
        constants: options.constants,
        entryPoint: options.frag_entry || 'fs',
        targets: formats.color,
      },
      depthStencil: !!formats.depth_stencil ? {
        depthWriteEnabled: options.depthWrite || true,
        depthCompare: options.depthTest || "greater-equal",
        depthBias: options.depthBias,
        format: formats.depth_stencil
      } : undefined,
      multisample: options.multisample,
      primitive: {
        cullMode: "back"
      }
    } 

    this.pipeline = device.createRenderPipeline(descriptor);
  }
}