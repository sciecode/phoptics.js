const msign = (v) => v >= 0 ? 1 : -1;

export const encode_oct32 = (v) => {
  v.mul_f32(1 / (Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.z)));
  let vx, vy;

  if (v.z >= 0) {
    vx = v.x;
    vy = v.y;
  } else {
    vx = (1. - Math.abs(v.y)) * msign(v.x);
    vy = (1. - Math.abs(v.x)) * msign(v.y);
  }

  const dx = Math.round(32767.5 + vx * 32767.5), dy = Math.round(32767.5 + vy * 32767.5);
  return dx | (dy << 16);
}

export const encode_oct16 = (v) => {
  v.mul_f32(1 / (Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.z)));
  let vx, vy;

  if (v.z >= 0) {
    vx = v.x;
    vy = v.y;
  } else {
    vx = (1. - Math.abs(v.y)) * msign(v.x);
    vy = (1. - Math.abs(v.x)) * msign(v.y);
  }
  const dx = Math.round(127.5 + vx * 127.5), dy = Math.round(127.5 + vy * 127.5);
  return dx | (dy << 8);
}

var f32 = new Float32Array(1);
var i32 = new Int32Array(f32.buffer);
var u32 = new Uint32Array(f32.buffer);

// temporary while f16 support isn't available in JS
export const encode_f16 = (fval) => {
  f32[0] = fval;
  const fbits = i32[0];
  const sign = (fbits >> 16) & 0x8000;
  let val = (fbits & 0x7fffffff) + 0x1000;

  if (val >= 0x47800000) {
    if (fbits & 0x7fffffff >= 0x47800000) {
      if (val < 0x7f800000) return sign | 0x7c00;
      return sign | 0x7c00 | ( fbits & 0x007fffff ) >> 13;
    }
    return sign | 0x7bff;
  }

  if (val >= 0x38800000) return sign | val - 0x38000000 >> 13;
  if (val < 0x33000000) return sign;

  val = (fbits & 0x7fffffff) >> 23;
  return sign | ((fbits & 0x7fffff | 0x800000) + (0x800000 >>> val - 102) >> 126 - val);
};

export const encode_rgb9e5 = (v) => {
  const extract_f9 = (n) => {
    f32[0] = n;
    const bits = u32[0];

    let exp = (bits >> 23) & 0xff;
    let mantissa = (bits & 0x7fffff) >> 14;

    if (exp) mantissa = (mantissa >> 1) | 0b100000000, exp += 1;

    return { exp, mantissa };
  };

  const { exp: r_exp, mantissa: r_man } = extract_f9(v[0]);
  const { exp: g_exp, mantissa: g_man } = extract_f9(v[1]);
  const { exp: b_exp, mantissa: b_man } = extract_f9(v[2]);

  // Use the largest exponent, and shift the mantissa accordingly
  const max_exp = Math.max(r_exp, g_exp, b_exp);
  const r = r_man >> (max_exp - r_exp);
  const g = g_man >> (max_exp - g_exp);
  const b = b_man >> (max_exp - b_exp);

  const exp = max_exp ? max_exp - 112 : 0;
  return r | (g << 9) | (b << 18) | (exp << 27);
}