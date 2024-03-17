
export class Shader {
  constructor(device, options = {}) {
    this.module = device.createShaderModule({
      code: options.code
    });

    this.vertex_entry = options.vertex_entry || 'vs';
    this.frag_entry = options.vertex_entry || 'fs';
  }
}