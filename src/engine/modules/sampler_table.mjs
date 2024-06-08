import { Format } from "../../common/constants.mjs";

export class SamplerTable {
  constructor(features) {
    this.float = features.has('float32-filterable') ? 'float' : 'unfilterable-float';
  }

  get_sample_type(format) {
    switch (format) {
      // float
      case Format.R8_UNORM:
      case Format.R8_SNORM:
      case Format.RG8_UNORM:
      case Format.RG8_SNORM:
      case Format.RGBA8_UNORM:
      case Format.RGBA8_SNORM:
      case Format.RGBA8_UNORM_SRGB:
      case Format.BGRA8_UNORM:
      case Format.BGRA8_UNORM_SRGB:
      case Format.R16_FLOAT:
      case Format.RG16_FLOAT:
      case Format.RGBA16_FLOAT:
      case Format.RGB10A2_UNORM:
      case Format.RG11B10_UFLOAT:
      case Format.RGB9E5_UFLOAT:
        return 'float';

      // unfilterable-float
      case Format.R32_FLOAT:
      case Format.RG32_FLOAT:
      case Format.RGBA32_FLOAT:
      case Format.BC1_UNORM:
      case Format.BC1_UNORM_SRGB:
      case Format.BC4_UNORM:
      case Format.BC4_SNORM:
      case Format.BC3_UNORM:
      case Format.BC3_UNORM_SRGB:
      case Format.BC5_UNORM:
      case Format.BC5_SNORM:
      case Format.BC6_UFLOAT:
      case Format.BC6_FLOAT:
      case Format.BC7_UNORM:
      case Format.BC7_UNORM_SRGB:
        return this.float;

      case Format.DEPTH16:
      case Format.DEPTH24:
      case Format.DEPTH24STENCIL8:
      case Format.DEPTH32:
      case Format.DEPTH32STENCIL8:
        return 'depth';

      // uint
      case Format.R8_UINT:
      case Format.RG8_UINT:
      case Format.RGBA8_UINT:
      case Format.R16_UINT:
      case Format.RG16_UINT:
      case Format.RGBA16_UINT:
      case Format.R32_UINT:
      case Format.RG32_UINT:
      case Format.RGBA32_UINT:
      case Format.STENCIL8:
        return 'uint';

      // sint
      case Format.R8_SINT:
      case Format.RG8_SINT:
      case Format.RGBA8_SINT:
      case Format.R16_SINT:
      case Format.RG16_SINT:
      case Format.RGBA16_SINT:
      case Format.R32_SINT:
      case Format.RG32_SINT:
      case Format.RGBA32_SINT:
        return 'sint';
        
    }
  }
}