export const NULL_HANDLE = -1;

export const DrawStreamBits = {
  pipeline: 0,
  bind_globals: 1,
  bind_material: 2,
  bind_attributes: 3,
  bind_dynamic: 4,
  dynamic_offset: 5,
  index_offset: 6,
  index: 7,
  draw_count: 8,
  vertex_offset: 9,
  instance_count: 10,
  instance_offset: 11,
  MAX: 12,
};

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