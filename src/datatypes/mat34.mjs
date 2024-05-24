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
    let tmp = this[1]; this[1] = this[4]; this[4] = tmp;
        tmp = this[2]; this[2] = this[8]; this[8] = tmp;
        tmp = this[6]; this[6] = this[9]; this[9] = tmp; 

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
    this[3] = pos[0]; this[7] = pos[1]; this[11] = pos[2];
    return this;
  }

  rotate(quat) {
    const x = quat[0], y = quat[1], z = quat[2], w = quat[3];
		const x2 = x + x,	y2 = y + y, z2 = z + z;
		const xx = x * x2, xy = x * y2, xz = x * z2;
		const yy = y * y2, yz = y * z2, zz = z * z2;
		const wx = w * x2, wy = w * y2, wz = w * z2;

		this[ 0 ] = ( 1 - ( yy + zz ) );
		this[ 1 ] = ( xy - wz );
		this[ 2 ] = ( xz + wy );

		this[ 4 ] = ( xy + wz );
		this[ 5 ] = ( 1 - ( xx + zz ) );
		this[ 6 ] = ( yz - wx );

		this[ 8 ] = ( xz - wy );
		this[ 9 ] = ( yz + wx );
		this[ 10 ] = ( 1 - ( xx + yy ) );
    return this;
  }

  rigid(pos, quat) {
    return this.translate(pos).rotate(quat);
  }

  affine(pos) { // pos / rot / scl
    return this.translate(pos).rotate(quat);
  }

  look_at(v) {
    const m = this;
    const _z = t0.set(m[3], m[7], m[11]).sub(v).unit();
    const _x = t1.set(0, 1, 0).cross(_z).unit();
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

    return this.view_inverse();
  }
}

const t0 = new Vec3(), t1 = new Vec3(), t2 = new Vec3();