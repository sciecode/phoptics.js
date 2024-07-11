import math_shader from 'phoptics/utils/modules/shaders/lib/math_shader.mjs';
import constants_shader from 'phoptics/utils/modules/shaders/lib/constants_shader.mjs';
import tonemap_shader from 'phoptics/utils/modules/shaders/lib/tonemap_shader.mjs';
import encoding_shader from 'phoptics/utils/modules/shaders/lib/encoding_shader.mjs';

export const builtin = {
  math: math_shader,
  tonemap: tonemap_shader,
  encoding: encoding_shader,
  constants: constants_shader
};