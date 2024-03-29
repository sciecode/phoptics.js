
export class Shader {
  constructor(device, options = {}) {
    this.module = device.createShaderModule({
      code: options.code
    });

    this.vertex_entry = options.vertex_entry || 'vs';
    this.frag_entry = options.vertex_entry || 'fs';

    this.vertex_buffers = options.vertex_buffers;
    this.layout = (!options.group_layouts || !options.group_layouts.length) ? 
      'auto' :
      device.createPipelineLayout({
        bindGroupLayouts: options.group_layouts,
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