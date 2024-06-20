import radix_sort from '../../common/radix_sort.mjs';

const BUFFER_OFFSET = 0, BUFFER_MASK = (1 << 10) - 1;
const GEOMETRY_OFFSET = 10, GEOMETRY_MASK = (1 << 4) - 1;
const PIPELINE_OFFSET = 14, PIPELINE_MASK = (1 << 10) - 1;

export default class Keys {
  static set_pipeline(entry, bid) {
    entry.key |= (bid & PIPELINE_MASK) << PIPELINE_OFFSET;
  }

  static get_pipeline(entry) {
    return (entry.key >> PIPELINE_OFFSET) & PIPELINE_MASK;
  }

  static set_buffer(entry, bid) {
    entry.key |= (bid & BUFFER_MASK) << BUFFER_OFFSET;
  }

  static set_geometry(entry, geometry) {
    const geo_key = (!!geometry.index) << 3 | geometry.attributes.length;
    entry.key |= (geo_key & GEOMETRY_MASK) << GEOMETRY_OFFSET;
  }

  static sort(list) {
    radix_sort(list, { get: get_key });
  }
}

const get_key = (el) => el.key;

