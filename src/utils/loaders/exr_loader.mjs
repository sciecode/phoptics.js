import { decode_f16 } from 'phoptics/utils/data/decoder.mjs';

export class EXRLoader {
  constructor() {}

  load(url) {
    return fetch(url).then( async response => {
      if (!response.ok) return undefined;
      return this.parse(await response.arrayBuffer());
    });
  }

  parse(buffer) {
    const view = new EXRView(buffer);
    const header = new EXRHeader(view);
    return { header };
  }
}

class EXRHeader {
  constructor(view) {
    if (view.u32() != 20000630) // magic
      throw 'EXRLoader: file not OpenEXR format.';

    this.version = view.u8();

    const spec = view.u8();
    this.spec = {
			tiled: !! ( spec & 2 ),
			deep: !! ( spec & 8 ),
			multi: !! ( spec & 16 ),
		};

    view.skip(2); // preamble

    let name;
    this.attributes = {};
    while (name = view.string()) {
      const type = view.string();
      const size = view.u32();
      this.attributes[name] = view.attribute(type, size);
    }
  }
}

class EXRView {
  constructor(buffer) {
    this.offset = 0;
    this.dv = new DataView(buffer);
    this.bytes = new Uint8Array(buffer);
    this.decoder = new TextDecoder();
  }

  u8()  {
    const v = this.dv.getUint8(this.offset, true)
    this.offset += 1;
    return v;
  };

  i8()  {
    const v = this.dv.getInt8(this.offset, true)
    this.offset += 1;
    return v;
  };

  u16()  {
    const v = this.dv.getUint16(this.offset, true)
    this.offset += 2;
    return v;
  };

  i16()  {
    const v = this.dv.getInt16(this.offset, true)
    this.offset += 2;
    return v;
  };

  u32()  {
    const v = this.dv.getUint32(this.offset, true)
    this.offset += 4;
    return v;
  };

  i32()  {
    const v = this.dv.getInt32(this.offset, true)
    this.offset += 4;
    return v;
  };

  u64()  {
    const v = this.dv.getBigUint64(this.offset, true)
    this.offset += 8;
    return v;
  };

  i64()  {
    const v = this.dv.getBigInt64(this.offset, true)
    this.offset += 8;
    return v;
  };

  f16()  {
    const v = decode_f16(this.dv.getUint16(this.offset, true))
    this.offset += 2;
    return v;
  };

  f32()  {
    const v = this.dv.getFloat32(this.offset, true)
    this.offset += 4;
    return v;
  };

  f64()  {
    const v = this.dv.getFloat64(this.offset, true)
    this.offset += 8;
    return v;
  };

  string() {
		let start = this.offset;
		while (this.bytes[this.offset++] != 0);
		return this.decoder.decode(this.bytes.slice(start, this.offset - 1));;
  }

  string_len(len) {
    let start = this.offset;
    this.offset += len;
		return this.decoder.decode(this.bytes.slice(start, this.offset));
  }

  channels(len) {
    const channels = [], end = this.offset + len - 1;
		while (this.offset < end) {
			channels.push({
				name: this.string(),
				type: this.i32(),
        linear: this.u8(),
        sampling: this.skip(3) || [this.i32(), this.i32()]
			});
		}
		this.skip(1);
		return channels;
  }

  attribute(type, len) {
    let code;
    switch(type) {
      case 'float': return this.f32();
      case 'int': return this.i32();
      case 'v2f': return [this.f32(), this.f32()];
      case 'v3f': return [this.f32(), this.f32(), this.f32()];
      case 'box2i': return { min: [this.i32(), this.i32()], max: [this.i32(), this.i32()] };
      case 'compression': return { name: compressions[code = this.u8()], code };
      case 'lineOrder': return { name: orders[code = this.u8()], code };
      case 'chlist': return this.channels(len);
      case 'string': return this.string_len(len);
      default:
        this.offset += len;
        return type + "/skipped";
    }
  }

  skip(b) { this.offset += b }
}

const ORDERS = { UP: 0, DOWN: 1, RAND: 2 };
const orders = ['INCREASING_Y','DECREASING_Y','RANDOM_Y'];
const COMPRESS = { NO: 0, RLE: 1, ZIPS: 2, ZIP: 3, PIZ: 4, PXR: 5, B44: 6, B44A: 7, DWAA: 8, DWAB: 9 }; 
const compressions = ['NO','RLE','ZIPS','ZIP','PIZ','PXR24','B44','B44A','DWAA','DWAB'];