export class Mat3x4 {
  static byte_size = 48;

  constructor() {
    this.data = new Float32Array(12);
    this.data[0] = this.d[5] = this.d[10] = 1;
  }

  to(buf, offset) {
    buf.set(this.data, offset);
    return this;
  }

  copy(mat) {
    this.data.set(mat.data);
    return this;
  }

  mul(mat) {
    let x, y, z;
    const m = this.data, n = mat.data;

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
    return this;
  }
}