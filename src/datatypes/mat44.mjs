export class Mat4x4 extends Float32Array {
  static byte_size = 64;

  constructor(array_buffer, byte_offset) {
    if (array_buffer) {
      super(array_buffer, byte_offset, 16);
      this.fill(0);
    } else super(16);
    this[0] = this[5] = this[10] = this[15] = 1;
  }

  to(buf, offset) {
    buf.set(this, offset);
    return this;
  }

  copy(mat) {
    super.set(mat);
    return this;
  }

  mul(mat) {
    let x, y, z, w;
    const m = this, n = mat;

    x = m[0], y = m[1], z = m[2], w = m[3];
    m[0]  = x * n[0] + y * n[4] + z * n[8]  + w * n[12];
    m[1]  = x * n[1] + y * n[5] + z * n[9]  + w * n[13];
    m[2]  = x * n[2] + y * n[6] + z * n[10] + w * n[14];
    m[3]  = x * n[3] + y * n[7] + z * n[11] + w * n[15];

    x = m[4], y = m[5], z = m[6], w = m[7];
    m[4]  = x * n[0] + y * n[4] + z * n[8]  + w * n[12];
    m[5]  = x * n[1] + y * n[5] + z * n[9]  + w * n[13];
    m[6]  = x * n[2] + y * n[6] + z * n[10] + w * n[14];
    m[7]  = x * n[3] + y * n[7] + z * n[11] + w * n[15];

    x = m[8], y = m[9], z = m[10], w = m[11];
    m[8]  = x * n[0] + y * n[4] + z * n[8]  + w * n[12];
    m[9]  = x * n[1] + y * n[5] + z * n[9]  + w * n[13];
    m[10] = x * n[2] + y * n[6] + z * n[10] + w * n[14];
    m[11] = x * n[3] + y * n[7] + z * n[11] + w * n[15];

    x = m[12], y = m[13], z = m[14], w = m[15];
    m[12] = x * n[0] + y * n[4] + z * n[8]  + w * n[12];
    m[13] = x * n[1] + y * n[5] + z * n[9]  + w * n[13];
    m[14] = x * n[2] + y * n[6] + z * n[10] + w * n[14];
    m[15] = x * n[3] + y * n[7] + z * n[11] + w * n[15];

    return this;
  }

  affine(mat) {
    let x, y, z;
    const m = this, n = mat;

    x = m[0], y = m[1], z = m[2];
    m[0]  = x * n[0] + y * n[4] + z * n[8];
    m[1]  = x * n[1] + y * n[5] + z * n[9];
    m[2]  = x * n[2] + y * n[6] + z * n[10];
    m[3] += x * n[3] + y * n[7] + z * n[11];

    x = m[4], y = m[5], z = m[6];
    m[4]  = x * n[0] + y * n[4] + z * n[8];
    m[5]  = x * n[1] + y * n[5] + z * n[9];
    m[6]  = x * n[2] + y * n[6] + z * n[10];
    m[7] += x * n[3] + y * n[7] + z * n[11];

    x = m[8], y = m[9], z = m[10];
    m[8]    = x * n[0] + y * n[4] + z * n[8];
    m[9]    = x * n[1] + y * n[5] + z * n[9];
    m[10]   = x * n[2] + y * n[6] + z * n[10];
    m[11]  += x * n[3] + y * n[7] + z * n[11];

    x = m[12], y = m[13], z = m[14];
    m[12]  = x * n[0] + y * n[4] + z * n[8];
    m[13]  = x * n[1] + y * n[5] + z * n[9];
    m[14]  = x * n[2] + y * n[6] + z * n[10];
    m[15] += x * n[3] + y * n[7] + z * n[11];

    return this;
  }

  perspective(fov, aspect, near, far) {
    const m = this;
    const range = 1 / (far - near);
    const focal_length = Math.tan((Math.PI - fov) * .5);

    m.fill(0);

    m[0] = focal_length / aspect;
    m[5] = focal_length;
    m[10] = near * range;
    m[11] = near * far * range;
    m[14] = -1;
    return this;
  }
}