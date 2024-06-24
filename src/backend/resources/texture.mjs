import { Format } from "../../common/constants.mjs";

export class Texture {
  constructor(device, options = {}) {
    this.texture = device.createTexture({
      format: Format.internal(options.format),
      size: {
        width: options.size.width, 
        height: options.size.height,
        depthOrArrayLayers: options.size.depth,
      },
      usage: options.usage,
      sampleCount: options.samples,
      dimensions: options.dimensions,
      mipLevelCount: options.mip_levels || 1,
    });
    this.block = Format.block(options.format);
  }

  update_texture(device, size) {
    const current = this.texture;
    this.texture = device.createTexture({
      format: current.format,
      size: {
        width: size.width, 
        height: size.height,
        depthOrArrayLayers: size.depth,
      },
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