export class Texture {
  constructor(device, options = {}) {
    this.texture = device.createTexture({
      format: options.format,
      size: { 
        width: options.width,
        height: options.height, 
      },
      usage: options.usage,
      sampleCount: options.sampleCount,
      dimensions: options.dimensions,
      mipLevelCount: options.mipLevelCount,
    });
  }

  update_texture(device, options) {
    const current = this.texture;
    this.texture = device.createTexture({
      format: current.format,
      size: { 
        width: options.width || current.width,
        height: options.height || current.height,
      },
      usage: current.usage,
      sampleCount: current.sampleCount,
      dimensions: options.dimensions,
      mipLevelCount: options.mipLevelCount,
    });
    current.destroy();
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