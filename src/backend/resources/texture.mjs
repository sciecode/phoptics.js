export class Texture {
  constructor(device, options = {}) {
    this.version = 0;
    this.texture = device.createTexture({
      format: options.format,
      size: [options.width, options.height],
      usage: options.usage,
      sampleCount: options.sampleCount
    });
  }

  update_texture(device, options) {
    const current = this.texture;
    const w = options.width || current.width;
    const h = options.height || current.height;
    this.texture = device.createTexture({
      format: current.format,
      size: [w, h],
      usage: current.usage,
      sampleCount: current.sampleCount
    });
    current.destroy();
    this.version++;
  }

  get_format() {
    return this.texture.format;
  }

  get_view(descriptor) {
    return this.texture.createView(descriptor);
  }

  destroy() {
    this.texture.destroy();
  }
}