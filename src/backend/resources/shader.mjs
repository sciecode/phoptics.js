
export class Shader {
  constructor(device, empty_layout, options = {}) {
    this.module = device.createShaderModule({
      code: options.code
    });

    this.vertex_entry = options.vertex_entry || 'vs';
    this.frag_entry = options.vertex_entry || 'fs';

    this.vertex_buffers = options.vertex_buffers;

    const groups = new Array(4);
    for (let i = 0; i < 3; i++)
      groups[i] = options.group_layouts[i] || empty_layout;
    groups[3] = options.dynamic_layout || empty_layout;

    this.layout = device.createPipelineLayout({
      bindGroupLayouts: groups,
    });

    this.graphics_pipeline = {
      multisample: options.multisample
    };
  }

  get_pipeline_descriptor(formats) {
    const has_depth = !!formats.depth_stencil;
    return {
      layout: this.layout,
      vertex: {
        module: this.module,
        entryPoint: this.vertex_entry,
        buffers: this.vertex_buffers,
      },
      fragment: {
        module: this.module,
        entryPoint: this.frag_entry,
        targets: formats.color,
      },
      depthStencil: has_depth ? {
        depthWriteEnabled: true,
        depthCompare: "greater",
        format: formats.depth_stencil
      } : undefined,
      multisample: this.graphics_pipeline.multisample,
      primitive: {
        cullMode: "back"
      }
    } 
  }
}