export class Texture {
  constructor(device, options = {}) {
    this.texture = device.createTexture({
      format: options.format,
      size: [options.width, options.height],
      usage: options.usage,
    });
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