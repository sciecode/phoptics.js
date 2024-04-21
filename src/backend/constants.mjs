export const NULL_HANDLE = -1 >>> 0;

export const DrawStreamBits = {
  pipeline:         0,
  bind_group0:      1,
  bind_group1:      2,
  bind_group2:      3,
  dynamic_group:    4,
  dynamic_offset:   5,
  attribute0:       6,
  attribute1:       7,
  attribute2:       8,
  attribute4:       9,
  index:            10,
  draw_count:       11,
  vertex_offset:    12,
  index_offset:     13,
  MAX:              14,
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