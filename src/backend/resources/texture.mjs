export class Texture {
  constructor(device, options = {}) {
    this.texture = device.createTexture({
      format: options.format,
      size: options.size,
      usage: options.usage,
      sampleCount: options.samples,
      dimensions: options.dimensions,
      mipLevelCount: options.mip_levels || 1,
    });
  }

  update_texture(device, size) {
    const current = this.texture;
    this.texture = device.createTexture({
      format: current.format,
      size: size,
      usage: current.usage,
      sampleCount: current.sampleCount,
      dimensions: current.dimensions,
      mipLevelCount: current.mip_levels || 1,
    });
    current.destroy();
  }

  get_view(descriptor) {
    return this.texture.createView(descriptor);
  }

  destroy() {
    this.texture.destroy();
  }
}