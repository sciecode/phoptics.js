
export const Format = {
  R8_UNORM:           0,
  R8_SNORM:           1,
  R8_UINT:            2,
  R8_SINT:            3,
  STENCIL8:           4,
  RG8_UNORM:          5,
  RG8_SNORM:          6,
  RG8_UINT:           7,
  RG8_SINT:           8,
  R16_FLOAT:          9,
  R16_UINT:           10,
  R16_SINT:           11,
  DEPTH16:            12,
  DEPTH24:            13,
  RGBA8_UNORM:        14,
  RGBA8_SNORM:        15,
  RGBA8_UNORM_SRGB:   16,
  BGRA8_UNORM:        17,
  BGRA8_UNORM_SRGB:   18,
  RGBA8_UINT:         19,
  RGBA8_SINT:         20,
  RG16_UINT:          21,
  RG16_SINT:          22,
  RG16_FLOAT:         23,
  RGB10A2_UNORM:      24,
  RG11B10_UFLOAT:     25,
  RGB9E5_UFLOAT:      26,
  R32_FLOAT:          27,
  R32_UINT:           28,
  R32_SINT:           29,
  DEPTH24STENCIL8:    30,
  DEPTH32:            31,
  DEPTH32STENCIL8:    32,
  RGBA16_FLOAT:       33,
  RGBA16_UINT:        34,
  RGBA16_SINT:        35,
  RG32_FLOAT:         36,
  RG32_UINT:          37,
  RG32_SINT:          38,
  RGBA32_FLOAT:       39,
  RGBA32_UINT:        40,
  RGBA32_SINT:        41,
  BC1_UNORM:          42,
  BC1_UNORM_SRGB:     43,
  BC4_UNORM:          44,
  BC4_SNORM:          45,
  BC3_UNORM:          46,
  BC3_UNORM_SRGB:     47,
  BC5_UNORM:          48,
  BC5_SNORM:          49,
  BC6_UFLOAT:         50,
  BC6_FLOAT:          51,
  BC7_UNORM:          52,
  BC7_UNORM_SRGB:     53,
};

Format.internal = (id) => {
  switch (id) {
    case Format.R8_UNORM:         return 'r8unorm';
    case Format.R8_SNORM:         return 'r8snorm';
    case Format.R8_UINT:          return 'r8uint';
    case Format.R8_SINT:          return 'r8sint';
    case Format.STENCIL8:         return 'stencil8';
    case Format.RG8_UNORM:        return 'rg8unorm';
    case Format.RG8_SNORM:        return 'rg8snorm';
    case Format.RG8_UINT:         return 'rg8uint';
    case Format.RG8_SINT:         return 'rg8sint';
    case Format.R16_FLOAT:        return 'rg16float';
    case Format.R16_UINT:         return 'rg16uint';
    case Format.R16_SINT:         return 'rg16sint';
    case Format.DEPTH16:          return 'depth16unorm';
    case Format.DEPTH24:          return 'depth24plus';
    case Format.RGBA8_UNORM:      return 'rgba8unorm';
    case Format.RGBA8_SNORM:      return 'rgba8snorm';
    case Format.RGBA8_UNORM_SRGB: return 'rgba8unorm-srgb';
    case Format.BGRA8_UNORM:      return 'bgra8unorm';
    case Format.BGRA8_UNORM_SRGB: return 'bgra8unorm-srgb';
    case Format.RGBA8_UINT:       return 'rgba8uint';
    case Format.RGBA8_SINT:       return 'rgba8sint';
    case Format.RG16_UINT:        return 'rg16uint';
    case Format.RG16_SINT:        return 'rg16sint';
    case Format.RG16_FLOAT:       return 'rg16float';
    case Format.RGB10A2_UNORM:    return 'rgb10a2unorm';
    case Format.RG11B10_UFLOAT:   return 'rg11b10ufloat';
    case Format.RGB9E5_UFLOAT:    return 'rgb9e5ufloat';
    case Format.R32_FLOAT:        return 'rg32float';
    case Format.R32_UINT:         return 'rg32uint';
    case Format.R32_SINT:         return 'rg32sint';
    case Format.DEPTH24STENCIL8:  return 'depth24plus-stencil8';
    case Format.DEPTH32:          return 'depth32float';
    case Format.DEPTH32STENCIL8:  return 'depth32float-stencil8';
    case Format.RGBA16_FLOAT:     return 'rgba16float';
    case Format.RGBA16_UINT:      return 'rgba16uint';
    case Format.RGBA16_SINT:      return 'rgba16sint';
    case Format.RG32_FLOAT:       return 'rg32float';
    case Format.RG32_UINT:        return 'rg32uint';
    case Format.RG32_SINT:        return 'rg32sint';
    case Format.RGBA32_FLOAT:     return 'rgba32float';
    case Format.RGBA32_UINT:      return 'rgba32uint';
    case Format.RGBA32_SINT:      return 'rgba32sint';

    // compressed
    case Format.BC1_UNORM:        return 'bc1-rgba-unorm';
    case Format.BC1_UNORM_SRGB:   return 'bc1-rgba-unorm-srgb';
    case Format.BC3_UNORM:        return 'bc3-rgba-unorm';
    case Format.BC3_UNORM_SRGB:   return 'bc3-rgba-unorm-srgb';
    case Format.BC4_UNORM:        return 'bc4-r-unorm';
    case Format.BC4_SNORM:        return 'bc4-r-snorm';
    case Format.BC5_UNORM:        return 'bc5-rg-unorm';
    case Format.BC5_SNORM:        return 'bc5-rg-snorm';
    case Format.BC6_UFLOAT:       return 'bc6h-rgb-ufloat';
    case Format.BC6_FLOAT:        return 'bc6h-rgb-float';
    case Format.BC7_UNORM:        return 'bc7-rgba-unorm';
    case Format.BC7_UNORM_SRGB:   return 'bc7-rgba-unorm-srgb';
  }
}

Format.block = (id) => {
  switch (id) {
    case Format.R8_UNORM:
    case Format.R8_SNORM:
    case Format.R8_UINT:
    case Format.R8_SINT:
    case Format.STENCIL8:
      return { width: 1, height: 1, bytes: 1 };

    case Format.RG8_UNORM:
    case Format.RG8_SNORM:
    case Format.RG8_UINT:
    case Format.RG8_SINT:
    case Format.R16_FLOAT:
    case Format.R16_UINT:
    case Format.R16_SINT:
    case Format.DEPTH16:
      return { width: 1, height: 1, bytes: 2 };

    case Format.DEPTH24:
      return { width: 1, height: 1, bytes: 3 };

    case Format.RGBA8_UNORM:
    case Format.RGBA8_SNORM:
    case Format.RGBA8_UNORM_SRGB:
    case Format.BGRA8_UNORM:
    case Format.BGRA8_UNORM_SRGB:
    case Format.RGBA8_UINT:
    case Format.RGBA8_SINT:
    case Format.RG16_UINT:
    case Format.RG16_SINT:
    case Format.RG16_FLOAT:
    case Format.RGB10A2_UNORM:
    case Format.RG11B10_UFLOAT:
    case Format.RGB9E5_UFLOAT:
    case Format.R32_FLOAT:
    case Format.R32_UINT:
    case Format.R32_SINT:
    case Format.DEPTH24STENCIL8:
    case Format.DEPTH32:
      return { width: 1, height: 1, bytes: 4 };

    case Format.DEPTH32STENCIL8:
      return { width: 1, height: 1, bytes: 5 };

    case Format.RGBA16_FLOAT:
    case Format.RGBA16_UINT:
    case Format.RGBA16_SINT:
    case Format.RG32_FLOAT:
    case Format.RG32_UINT:
    case Format.RG32_SINT:
      return { width: 1, height: 1, bytes: 8 };

    case Format.RGBA32_FLOAT:
    case Format.RGBA32_UINT:
    case Format.RGBA32_SINT:
      return { width: 1, height: 1, bytes: 16 };

    // compressed
    case Format.BC1_UNORM:
    case Format.BC1_UNORM_SRGB:
    case Format.BC4_UNORM:
    case Format.BC4_SNORM:
      return { width: 4, height: 4, bytes: 8 };

    case Format.BC3_UNORM:
    case Format.BC3_UNORM_SRGB:
    case Format.BC5_UNORM:
    case Format.BC5_SNORM:
    case Format.BC6_UFLOAT:
    case Format.BC6_FLOAT:
    case Format.BC7_UNORM:
    case Format.BC7_UNORM_SRGB:
      return { width: 4, height: 4, bytes: 16 };
  }
}