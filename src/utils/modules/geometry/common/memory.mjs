export const aligned = (size) => (size + 3) & ~3;

export class Memory {

  static allocate_layout(layout) {
    let sum = 0;
    for (const key in layout) {
      const entry = layout[key];
      entry.start = sum;
      sum += aligned(entry.count * entry.type.bytes);
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
  return dst.set(src.subarray(src_offset, src_offset + length), dst_offset);
}