export class Texture {
  constructor(device, options = {}) {
    this.texture = device.createTexture({
      format: options.format,
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
    this.stride = get_texture_stride(options.format);
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

const get_texture_stride = (format) => {
  switch (format) {
    case 'r8unorm':
    case 'r8snorm':
    case 'r8uint':
    case 'r8sint':
    case 'stencil8':
      return 1;

    case 'rg8unorm':
    case 'rg8snorm':
    case 'rg8uint':
    case 'rg8sint':
    case 'r16float':
    case 'r16uint':
    case 'r16sint':
    case 'depth16unorm':
      return 2;
      
    case 'depth24plus':
      return 3;

    case 'rgba8unorm':
    case 'rgba8snorm':
    case 'rgba8unorm-srgb':
    case 'bgra8unorm':
    case 'bgra8unorm-srgb':
    case 'rgba8uint':
    case 'rgba8sint':
    case 'rg16uint':
    case 'rg16sint':
    case 'rg16float':
    case 'rgb10a2unorm':
    case 'rg11b10ufloat':
    case 'rgb9e5ufloat':
    case 'r32uint':
    case 'r32sint':
    case 'r32float':
    case 'depth24plus-stencil8':
    case 'depth32float':
      return 4;

    case 'depth32float-stencil8':
      return 5;

    case 'rgba16float':
    case 'rgba16uint':
    case 'rgba16sint':
    case 'rg32sint':
    case 'rg32uint':
    case 'rg32float':
      return 8;

    case 'rgba32float':
    case 'rgba32uint':
    case 'rgba32sint':
      return 16;
  }
}