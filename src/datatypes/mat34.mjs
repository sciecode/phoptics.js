
export class Mat3x4 {
  static byte_size = 48;

  constructor() {
    this.d = new Float32Array(12);
    this.d[0] = this.d[5] = this.d[10] = 1;
  }
}