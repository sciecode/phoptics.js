
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
  }

  get_pipeline_descriptor(formats) {
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
        targets: formats,
      },
    } 
  }
}