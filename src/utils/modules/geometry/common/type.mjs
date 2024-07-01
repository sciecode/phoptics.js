export const i32 = (v) => v | 0;
export const i16 = (v) => v << 16 >> 16;
export const i8 = (v) => v << 24 >> 24;

export const u32 = (v) => v >>> 0;
export const u16 = (v) => v & 0xFFFF;
export const u8 = (v) => v & 0xFF;

export class TYPE {
  static get i8() { return { id: 0, bytes: 1, array: Int8Array }; }
  static get u8() { return { id: 1, bytes: 1, array: Uint8Array }; }

  static get i16() { return { id: 2, bytes: 2, array: Int16Array }; }
  static get u16() { return { id: 3, bytes: 2, array: Uint16Array }; }
  static get f16() { return { id: 4, bytes: 2, array: Uint16Array }; }

  static get i32() { return { id: 5, bytes: 4, array: Int32Array }; }
  static get u32() { return { id: 6, bytes: 4, array: Uint32Array }; }
  static get f32() { return { id: 7, bytes: 4, array: Float32Array }; }

  static get i64() { return { id: 8, bytes: 8, array: BigInt64Array }; }
  static get u64() { return { id: 9, bytes: 8, array: BigUint64Array }; }
  static get f64() { return { id: 10, bytes: 8, array: Float64Array }; }

  static to_id(id) {
    switch (id) {
      case Int8Array: return TYPE.i8.id;
      case Uint8Array: return TYPE.u8.id;
      case Int16Array: return TYPE.i16.id;
      case Uint16Array: return TYPE.u16.id;
      // case 4: return TYPE.f16; // enable once Float16Array is available
      case Int32Array: return TYPE.i32.id;
      case Uint32Array: return TYPE.u32.id;
      case Float32Array: return TYPE.f32.id;
      case BigInt64Array: return TYPE.i64.id;
      case BigUint64Array: return TYPE.u64.id;
      case Float64Array: return TYPE.f64.id;
    }
  }

  static from_id(id) {
    switch (id) {
      case 0: return TYPE.i8;
      case 1: return TYPE.u8;
      case 2: return TYPE.i16;
      case 3: return TYPE.u16;
      case 4: return TYPE.f16;
      case 5: return TYPE.i32;
      case 6: return TYPE.u32;
      case 7: return TYPE.f32;
      case 8: return TYPE.i64;
      case 9: return TYPE.u64;
      case 10: return TYPE.f64;
    }
  }
}