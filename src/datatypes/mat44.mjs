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

  transpose() {
    let tmp = this[1];  this[1]   = this[4];  this[4]   = tmp;
        tmp = this[2];  this[2]   = this[8];  this[8]   = tmp;
        tmp = this[6];  this[6]   = this[9];  this[9]   = tmp; 

    		tmp = this[3];  this[3]   = this[12]; this[12]  = tmp;
    		tmp = this[7];  this[7]   = this[13]; this[13]  = tmp;
    		tmp = this[11]; this[11]  = this[14]; this[14]  = tmp;
    return this;
  }

  inverse() {
    // TODO: optimize with adjugate method
	  const a11 = this[0], a21 = this[4], a31 = this[8], a41 = this[12],
			    a12 = this[1], a22 = this[5], a32 = this[9], a42 = this[13],
			    a13 = this[2], a23 = this[6], a33 = this[10], a43 = this[14],
			    a14 = this[3], a24 = this[7], a34 = this[11], a44 = this[15],

			    t11 = a23 * a34 * a42 - a24 * a33 * a42 + a24 * a32 * a43 - a22 * a34 * a43 - a23 * a32 * a44 + a22 * a33 * a44,
			    t12 = a14 * a33 * a42 - a13 * a34 * a42 - a14 * a32 * a43 + a12 * a34 * a43 + a13 * a32 * a44 - a12 * a33 * a44,
			    t13 = a13 * a24 * a42 - a14 * a23 * a42 + a14 * a22 * a43 - a12 * a24 * a43 - a13 * a22 * a44 + a12 * a23 * a44,
			    t14 = a14 * a23 * a32 - a13 * a24 * a32 - a14 * a22 * a33 + a12 * a24 * a33 + a13 * a22 * a34 - a12 * a23 * a34;

		const scl = 1 / ( a11 * t11 + a21 * t12 + a31 * t13 + a41 * t14);

		this[0] = t11 * scl;
		this[4] = (a24 * a33 * a41 - a23 * a34 * a41 - a24 * a31 * a43 + a21 * a34 * a43 + a23 * a31 * a44 - a21 * a33 * a44) * scl;
		this[8] = (a22 * a34 * a41 - a24 * a32 * a41 + a24 * a31 * a42 - a21 * a34 * a42 - a22 * a31 * a44 + a21 * a32 * a44) * scl;
		this[12] = (a23 * a32 * a41 - a22 * a33 * a41 - a23 * a31 * a42 + a21 * a33 * a42 + a22 * a31 * a43 - a21 * a32 * a43) * scl;

		this[1] = t12 * scl;
		this[5] = (a13 * a34 * a41 - a14 * a33 * a41 + a14 * a31 * a43 - a11 * a34 * a43 - a13 * a31 * a44 + a11 * a33 * a44) * scl;
		this[9] = (a14 * a32 * a41 - a12 * a34 * a41 - a14 * a31 * a42 + a11 * a34 * a42 + a12 * a31 * a44 - a11 * a32 * a44) * scl;
		this[13] = (a12 * a33 * a41 - a13 * a32 * a41 + a13 * a31 * a42 - a11 * a33 * a42 - a12 * a31 * a43 + a11 * a32 * a43) * scl;

		this[2] = t13 * scl;
		this[6] = (a14 * a23 * a41 - a13 * a24 * a41 - a14 * a21 * a43 + a11 * a24 * a43 + a13 * a21 * a44 - a11 * a23 * a44) * scl;
		this[10] = (a12 * a24 * a41 - a14 * a22 * a41 + a14 * a21 * a42 - a11 * a24 * a42 - a12 * a21 * a44 + a11 * a22 * a44) * scl;
		this[14] = (a13 * a22 * a41 - a12 * a23 * a41 - a13 * a21 * a42 + a11 * a23 * a42 + a12 * a21 * a43 - a11 * a22 * a43) * scl;

		this[3] = t14 * scl;
		this[7] = (a13 * a24 * a31 - a14 * a23 * a31 + a14 * a21 * a33 - a11 * a24 * a33 - a13 * a21 * a34 + a11 * a23 * a34) * scl;
		this[11] = (a14 * a22 * a31 - a12 * a24 * a31 - a14 * a21 * a32 + a11 * a24 * a32 + a12 * a21 * a34 - a11 * a22 * a34) * scl;
		this[15] = (a12 * a23 * a31 - a13 * a22 * a31 + a13 * a21 * a32 - a11 * a23 * a32 - a12 * a21 * a33 + a11 * a22 * a33) * scl;

    return this;
  }

  perspective(fov, aspect, near, far) {
    const m = this;
    const range = 1 / (far - near);
    const focal_length = Math.tan((Math.PI - fov) * .5);

    m[0] = focal_length / aspect; m[1] = 0;             m[2] = 0;             m[3] = 0;
    m[4] = 0;                     m[5] = focal_length;  m[6] = 0;             m[7] = 0;
    m[8] = 0;                     m[9] = 0;             m[10] = near * range; m[11] = near * far * range;
    m[12] = 0;                    m[13] = 0;            m[14] = -1;           m[15] = 0;
    return this;
  }
}