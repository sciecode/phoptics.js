
export class Shader {
  constructor(device, options = {}) {
    this.module = device.createShaderModule({
      code: options.code
    });

    this.vertex_entry = options.vertex_entry || 'vs';
    this.frag_entry = options.vertex_entry || 'fs';

    this.layout = (!options.bindings || !options.bindings.length) ? 
      'auto' :
      device.createPipelineLayout({
        bindGroupLayouts: options.bindings,
      });
  }

  get_pipeline_descriptor(formats) {
    return {
      layout: this.layout,
      vertex: {
        module: this.module,
        entryPoint: this.vertex_entry,
      },
      fragment: {
        module: this.module,
        entryPoint: this.frag_entry,
        targets: formats,
      },
    } 
  }
}