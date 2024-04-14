import { Vec3 } from "./vec3.mjs";

export class Mat3x4 extends Float32Array {
  static byte_size = 48;

  constructor(array_buffer, byte_offset) {
    if (array_buffer) {
      super(array_buffer, byte_offset, 12);
      this.fill(0);
    } else super(12);
    this[0] = this[5] = this[10] = 1;
  }

  to(buf, offset) {
    buf.set(this, offset);
    return this;
  }

  copy(mat) {
    super.set(mat);
    return this;
  }

  transpose() {
    const m = this;
    let tmp = m[1]; m[1] = m[4]; m[4] = tmp;
        tmp = m[2]; m[2] = m[8]; m[8] = tmp;
        tmp = m[6]; m[6] = m[9]; m[9] = tmp; 

    return this;
  }

  mul(mat) {
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

    return this;
  }

  translate(pos) {
    const m = this, v = pos;

    m[3] = v[0]; m[7] = v[1]; m[11] = v[2];
    return this;
  }

  compose_rigid(pos) {
    return this.translate(pos);
  }

  look_at(v) {
    const m = this;
    const _z = t0.set(m[3], m[7], m[11]).sub(v).normalize();
    const _x = t1.set(0, 1, 0).cross(_z);
    const _y = t2.copy(_z).cross(_x);

    m[0] = _x[0], m[1] = _y[0], m[2]  = _z[0];
    m[4] = _x[1], m[5] = _y[1], m[6]  = _z[1];
    m[8] = _x[2], m[9] = _y[2], m[10] = _z[2];

    return this;
  }

  view_inverse() {
    const m = this;

    this.transpose();

    const x = m[3], y = m[7], z = m[11];
    m[3]  = -(x * m[0] + y * m[1] + z * m[2]);
    m[7]  = -(x * m[4] + y * m[5] + z * m[6]);
    m[11] = -(x * m[8] + y * m[9] + z * m[10]);

    return this;
  }

  inverse() {
    const m = this;

    let x = m[0], y = m[4], z = m[8];
    const sx = 1 / (x * x + y * y + z * z);
    
    x = m[1], y = m[5], z = m[9];
    const sy = 1 / (x * x + y * y + z * z);

    x = m[2], y = m[6], z = m[10];
    const sz = 1 / (x * x + y * y + z * z);

    m[0] *= sx; m[4] *= sx; m[8] *= sx;
    m[1] *= sy; m[5] *= sy; m[9] *= sy;
    m[2] *= sz; m[6] *= sz; m[10] *= sz;

    return this.view();
  }
}

const t0 = new Vec3(), t1 = new Vec3(), t2 = new Vec3();