export class Texture {
  constructor(device, options = {}) {
    this.version = 0;
    this.device = device;
    this.texture = device.createTexture({
      format: options.format,
      size: [options.width, options.height],
      usage: options.usage,
      sampleCount: options.sampleCount
    });
  }

  set_size(w, h) {
    const current = this.texture;
    this.texture = this.device.createTexture({
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