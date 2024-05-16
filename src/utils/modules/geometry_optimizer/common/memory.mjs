const pad8 = (size) => (4 - (size & 3)) & 3;
const pad16 = (size) => size & 1;

export class Memory { 

  static allocate_layout(layout) {
    let sum = 0;
    for (const key in layout) {
      const entry = layout[key];
      let pad = 0, bytes = entry.type.bytes;
      if (bytes == 1) pad = pad8(entry.count);
      else if (bytes == 2) pad = pad16(entry.count);
      entry.start = sum;
      sum += (entry.count + pad) * bytes;
    }

    const buffer = new ArrayBuffer(sum);
    for (const key in layout) {
      const entry = layout[key];
      layout[key] = new entry.type.array(buffer, entry.start, entry.count);
    }
    
    return layout;
  }

}

export const memcpy = (dst, dst_offset, src, src_offset, length) => {
  return dst.set(src.subarray(src_offset,src_offset+length),dst_offset);
}