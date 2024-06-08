export const NULL_HANDLE = -1;

export const DrawStreamBits = {
  pipeline:         0,
  bind_globals:     1,
  bind_variant:     2,
  bind_material:    3,
  dynamic_group:    4,
  dynamic_offset:   5,
  attribute0:       6,
  attribute1:       7,
  attribute2:       8,
  attribute4:       9,
  index_offset:     10,
  index:            11,
  draw_count:       12,
  vertex_offset:    13,
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