import { DataReader } from "../common/data_reader.mjs";

const model = (id) => {
  switch (id) {
    case 128: return { name: 'BC1', id: id };
    case 129: return { name: 'BC2', id: id };
    case 130: return { name: 'BC3', id: id };
    case 131: return { name: 'BC4', id: id };
    case 132: return { name: 'BC5', id: id };
    case 133: return { name: 'BC6', id: id };
    case 134: return { name: 'BC7', id: id };
    case 166: return { name: 'ASTC', id: id };
    default: throw 'unsupported texture format';
  }
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
      vk_format: reader.u32(),
      bytes: reader.u32(),
      size: {
        width: reader.u32(),
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

    const index = {
      data_offset: reader.u32(),
      data_size: reader.u32(),
      kvd_offset: reader.u32(),
      kvd_size: reader.u32(),
      sgd_offset: reader.u64(),
      sgd_size:  reader.u64(),
      levels: [],
    }

    for (let i = 0; i < header.levels; i++) {
      index.levels.push({
        offset: reader.u64(),
        compressed: reader.u64(),
        uncompressed: reader.u64(),
      });
    }

    reader.skip(10);
    const base_end = reader.u16() - 8 + reader.offset;

    const format = {
      model: model(reader.u8()),
      gamma: reader.skip(1) || reader.u8() < 2 ? { name: 'LINEAR', id: 0 } : { name: 'SRGB', id: 1 },
      premultiplied: !!reader.u8(),
      block: {
        width: reader.u8(),
        height: reader.u8(),
        depth: reader.u8(),
      }
    };

    reader.skip(base_end - reader.offset);

    console.log(header, index, format);
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