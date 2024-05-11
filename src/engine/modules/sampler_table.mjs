
export class SamplerTable {
  constructor(features) {
    this.float = features.has('float32-filterable') ? 'float' : 'unfilterable-float';
  }

  get_sample_type(format) {
    switch (format) {
      // float
      case 'r8unorm':
      case 'r8snorm':
      case 'rg8unorm':
      case 'rg8snorm':
      case 'rgba8unorm':
      case 'rgba8snorm':
      case 'rgba8unorm-srgb':
      case 'bgra8unorm':
      case 'bgra8unorm-srgb':
      case 'r16float':
      case 'rg16float':
      case 'rgba16float':
      case 'rgb10a2unorm':
      case 'rg11b10ufloat':
      case 'rgb9e5ufloat':
        return 'float';

      // unfilterable-float
      case 'r32float':
      case 'rg32float':
      case 'rgba32float':
        return this.float;

      case 'depth16unorm':
      case 'depth24plus':
      case 'depth24plus-stencil8':
      case 'depth32float':
      case 'depth32float-stencil8':
        return 'depth';

      // uint
      case 'r8uint':
      case 'rg8uint':
      case 'rgba8uint':
      case 'r16uint':
      case 'rg16uint':
      case 'rgba16uint':
      case 'r32uint':
      case 'rg32uint':
      case 'rgba32uint':
      case 'stencil8':
        return 'uint';

      // sint
      case 'r8sint':
      case 'rg8sint':
      case 'rgba8sint':
      case 'r16stnt':
      case 'rg16sint':
      case 'rgba15sint':
      case 'r32sint':
      case 'rg32sint':
      case 'rgba32sint':
        return 'sint';
        
    }
  }
}