import { Format } from 'phoptics';
import { DataReader } from "../common/data_reader.mjs";

const model = (id, signed, gamma) => {
  let f;
  switch (id) {
    case 128: 
      f = gamma.id ? Format.BC1_UNORM_SRGB : Format.BC1_UNORM;
      break;
      
    case 130:
      f = gamma.id ? Format.BC3_UNORM_SRGB : Format.BC3_UNORM;
      break;
    case 131: 
      f = signed ? Format.BC4_SNORM : Format.BC4_UNORM;
      break;
    case 132:
      f = signed ? Format.BC5_SNORM : Format.BC5_UNORM;
      break;
    case 133:
      f = signed ? Format.BC6_FLOAT : Format.BC6_UFLOAT;
      break
    case 134: 
      f = gamma.id ? Format.BC7_UNORM_SRGB : Format.BC7_UNORM;
      break;
    default: throw 'unsupported texture format';
  }
  return { name: Format.internal(f), format: f };
}

export class KTXLoader {
  constructor (options) {}

  load(url) {
    return fetch(url).then( async response => {
      if (!response.ok) return undefined;
      return this.parse(await response.arrayBuffer());
    });
  }

  parse(buffer, reader) {
    if (!reader) reader = new KTXReader(buffer);

    if (!reader.magic()) throw `KTXLoader: file not KTX format.`;

    const header = {
      size: {
        width: reader.skip(8) || reader.u32(),
        height: reader.u32(),
        depth: reader.u32(),
      },
      layers: reader.u32(),
      faces: reader.u32(),
      levels: Math.max(1, reader.u32()),
      compression: reader.u32(),
    };

    if (header.compression) {
      if (header.compression == 1) throw `KTXLoader: basis universal is stupid, don't use it.`;
      else throw `KTXLoader: compression scheme unsupported`;
    }

    // header offsets
    reader.skip(32);

    const levels = [];
    for (let i = 0; i < header.levels; i++) {
      levels.push({
        offset: reader.u64(),
        compressed: reader.u64(),
        uncompressed: reader.u64(),
      });
    }
    header.levels = levels;

    // dfdblock offsets
    reader.skip(12);

    const header_format = {
      model: reader.u8(),
      gamma: reader.skip(1) || reader.u8() < 2 ? { name: 'LINEAR', id: 0 } : { name: 'SRGB', id: 1 },
      premultiplied: !!reader.u8(),
      block: {
        width: reader.u8(),
        height: reader.u8(),
        depth: reader.u8(),
      },
      signed: false,
    };

    reader.skip(9); // planes
    const ch_offset = reader.u16();
    const ch_length = reader.u8();
    const ch_info = reader.u8();

    header_format.signed = !!(ch_info & (1 << 6));
    header_format.model = model(header_format.model, header_format.signed, header_format.gamma);
    header.format = header_format;

    console.log(header, header.format.model);
  }
}

const MAGIC = [
  0xAB, 0x4B, 0x54, 0x58, 0x20, 0x32, 0x30, 0xBB, 0x0D, 0x0A, 0x1A, 0x0A
]

class KTXReader extends DataReader {
  constructor(buffer) { super(buffer) };
  magic() {
    for (let i = 0; i < 12; i++) if (this.u8() != MAGIC[i]) return false;
    return true;
  }
}