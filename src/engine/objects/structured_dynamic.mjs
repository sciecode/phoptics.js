
import { ResourceType } from "../constants.mjs";

export class StructuredDynamic {
  constructor(options) {
    this.type = ResourceType.StructuredDynamic;
    
    const arr = [];
    const buffer = new ArrayBuffer(parse_struct(this, arr, options));
    this.data = new Uint8Array(buffer);

    let current_offset = 0;
    for (let entry of arr) {
      entry.parent[entry.name] = new entry.type(buffer, current_offset);
      current_offset += entry.size;
    }
  }
}

const parse_struct = (parent, arr, desc) => {
  let total_bytes = 0;
  for (let entry of desc) {
    if (typeof entry.type == 'function') {
      if (!entry.count || entry.count < 2) {
        total_bytes += entry.type.byte_size;
        arr.push({ parent: parent, name: entry.name, type: entry.type, size: entry.type.byte_size });
      } else {
        const par = parent[entry.name] = [];
        for (let i = 0; i < entry.count; i++) {
          total_bytes += entry.type.byte_size;
          arr.push({ parent: par, name: i, type: entry.type, size: entry.type.byte_size });
        }
      }
    } else {
      if (!entry.count || entry.count < 2) {
        parent[entry.name] = {};
        total_bytes += parse_struct(parent[entry.name], arr, entry.type);
      } else {
        const par = parent[entry.name] = [];
        for (let i = 0; i < entry.count; i++) {
          par[i] = {};
          total_bytes += parse_struct(par[i], arr, entry.type);
        }
      }
    }
  }

  return total_bytes;
}