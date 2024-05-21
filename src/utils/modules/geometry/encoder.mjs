export const encode_oct32 = (v) => {
  const abs = Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.z);
  let nx = v.x / abs, ny = v.y / abs, vx, vy;

  if (v.z >= 0) {
    vx = nx;
    vy = ny;
  } else {
    vx = (1. - Math.abs(ny)) * Math.sign(nx);
    vy = (1. - Math.abs(nx)) * Math.sign(ny);
  }

  const dx = Math.round(32767.5 + vx * 32767.5), dy = Math.round(32767.5 + vy * 32767.5);
  return dx | (dy << 16);
}

export const encode_oct16 = (v) => {
  const abs = Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.z);
  let nx = v.x / abs, ny = v.y / abs, vx, vy;

  if (v.z >= 0) {
    vx = nx;
    vy = ny;
  } else {
    vx = (1. - Math.abs(ny)) * Math.sign(nx);
    vy = (1. - Math.abs(nx)) * Math.sign(ny);
  }
  const dx = Math.round(127.5 + vx * 127.5), dy = Math.round(127.5 + vy * 127.5);
  return dx | (dy << 8);
}

var f32 = new Float32Array(1);
var i32 = new Int32Array(f32.buffer);

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
