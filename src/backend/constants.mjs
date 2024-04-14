
export const DrawStreamBits = {
  pipeline:         0,
  bind_group0:      1,
  bind_group1:      2,
  bind_group2:      3,
  dynamic_group:    4,
  dynamic_offset0:  5,
  dynamic_offset1:  6,
  dynamic_offset2:  7,
  dynamic_offset3:  8,
  attribute0:       9,
  attribute1:       10,
  attribute2:       11,
  attribute4:       12,
  index:            13,
  draw_count:       14,
  vertex_offset:    15,
  index_offset:     16,
}

export const DrawStreamFlags = Object.entries(DrawStreamBits)
  .reduce((obj, entry) => {
    obj[entry[0]] = 1 << entry[1];
    return obj;
  }, {}
);


export const GPUResource = {
  BUFFER: 0,
  TEXTURE: 1,
  SAMPLER: 2,
};