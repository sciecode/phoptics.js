export class TextureTarget {
  constructor(device, width, height, options = {}) {
    this.texture = device.createTexture({
      format: options.format,
      size: [width, height],
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    
    this.format = options.format;
    this.clear = options.clear;
    this.loadOp = (options.clear !== undefined) ? 'clear' : 'load';
    this.storeOp = options.store || 'store';
  }

  get_view() {
    return this.texture.createView();
  }

  set_size(width, height, device) {
    this.texture.destroy();
    this.texture = device.createTexture({
      format: this.format,
      size: [width, height],
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
  }

  destroy() {
    this.texture.destroy();
  }
}