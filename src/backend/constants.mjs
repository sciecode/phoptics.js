export const NULL_HANDLE = -1;

export const DrawStreamBits = {
  pipeline:         0,
  bind_globals:     1,
  bind_material:    2,
  bind_geometry:    3,
  index_offset:     4,
  index:            5,
  draw_count:       6,
  vertex_offset:    7,
  instance_count:   8,
  instance_offset:  9,
  dynamic_group:    10,
  dynamic_offset:   11,
  MAX:              12,
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