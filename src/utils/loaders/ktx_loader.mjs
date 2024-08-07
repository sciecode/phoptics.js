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
      break;
    case 134:
      f = gamma.id ? Format.BC7_UNORM_SRGB : Format.BC7_UNORM;
      break;
    default: throw `unsupported texture format - ${id}`;
  }
  return { name: Format.internal(f), format: f };
};

export class KTXLoader {
  constructor(options) {}

  async load(url) {
    return fetch(url).then(async response => {
      if (!response.ok) return undefined;
      return this.parse(await response.arrayBuffer());
    });
  }

  async parse(buffer) {
    const reader = new KTXReader(buffer);
    const header = this.#header(reader);
    const textures = await this.#decoder(header, reader);
    return { textures, header };
  }

  #header(reader) {

    if (!reader.magic()) throw `KTXLoader: file not KTX format.`;

    const header = {
      size: {
        width: reader.skip(8) || Math.max(1, reader.u32()),
        height: Math.max(1, reader.u32()),
        depth: Math.max(1, reader.u32()) * Math.max(1, reader.u32()),
      },
      cubemap: reader.u32() == 6,
      levels: Math.max(1, reader.u32()),
      compression: reader.u32(),
    };

    if (header.compression) {
      if (header.compression == 1) throw `KTXLoader: basis universal is stupid, don't use it.`;
      else throw `KTXLoader: compression scheme unsupported`;
    }

    // header offsets
    reader.skip(32);

    // if you try to load more than 4GB (U32_MAX) - I'm gonna be so disappointed at you
    const levels = [];
    for (let i = 0; i < header.levels; i++) {
      levels.push({
        offset: Number(reader.u64()),
        compressed: Number(reader.u64()),
        uncompressed: Number(reader.u64()),
      });
    }
    header.levels = levels;

    // dfdblock offsets
    reader.skip(12);

    header.info = {
      ktx_id: reader.u8(),
      gamma: reader.skip(1) || reader.u8() < 2 ? { name: 'LINEAR', id: 0 } : { name: 'SRGB', id: 1 },
    };

    header.premultiplied = !!reader.u8(),
      header.info.block = {
        width: reader.u8() + 1,
        height: reader.u8() + 1,
        depth: reader.u8() + 1,
      };
    header.info.signed = false;

    reader.skip(12); // planes
    const ch_info = reader.u8();

    header.info.signed = !!(ch_info & (1 << 6));
    const { name, format } = model(header.info.ktx_id, header.info.signed, header.info.gamma);

    header.format = format;
    header.info.name = name;

    return header;
  }

  async #decoder(header, reader) {
    const textures = [], input = reader.bytes;
    for (let i = 0, il = header.levels.length; i < il; i++) {
      const level = header.levels[i];
      textures.push(input.subarray(level.offset, level.offset + level.uncompressed));
    }

    return textures;
  }
}

const MAGIC = [
  0xAB, 0x4B, 0x54, 0x58, 0x20, 0x32, 0x30, 0xBB, 0x0D, 0x0A, 0x1A, 0x0A
];

class KTXReader extends DataReader {
  constructor(buffer) { super(buffer); };
  magic() {
    for (let i = 0; i < 12; i++) if (this.u8() != MAGIC[i]) return false;
    return true;
  }
}