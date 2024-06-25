import radix_sort from '../../common/radix_sort.mjs';

// TODO: clean-up
const BUFFER_OFFSET = 0, BUFFER_MASK = (1 << 10) - 1;
const GEOMETRY_OFFSET = 10, GEOMETRY_MASK = 1, GEOMETRY_FILL = (1 << GEOMETRY_OFFSET) - 1;
const DYNAMIC_OFFSET = 11, DYNAMIC_MASK = 1, DYNAMIC_FILL = (1 << DYNAMIC_OFFSET) - 1;
const PIPELINE_OFFSET = 12, PIPELINE_MASK = (1 << 10) - 1, PIPELINE_FILL = (1 << PIPELINE_OFFSET) - 1;

export default class Keys {
  static state = {
    geometry: -1,
    dynamic: -1,
    pipeline: -1,
  }

  static set_buffer(entry, bid) {
    entry.key |= (bid & BUFFER_MASK) << BUFFER_OFFSET;
  }

  static set_geometry(entry, geometry) {
    let val = (!!geometry.index) & GEOMETRY_MASK;
    let swap = (Keys.state.geometry != -1) & (Keys.state.geometry != val);
    entry.key = (~entry.key * swap | entry.key * !swap) & GEOMETRY_FILL | (val << GEOMETRY_OFFSET);
    Keys.state.geometry = val;
  }
  
  static set_dynamic(entry, dynamic) {
    let val = (!!dynamic) & DYNAMIC_MASK;
    let swap = (Keys.state.dynamic != -1) & (Keys.state.dynamic != val);
    entry.key = (~entry.key * swap | entry.key * !swap) & DYNAMIC_FILL | (val << DYNAMIC_OFFSET);
    Keys.state.dynamic = val;
  }

  static set_pipeline(entry, pipeline) {
    let val = pipeline & PIPELINE_MASK;
    let swap = (Keys.state.pipeline != -1) & (Keys.state.pipeline != val);
    entry.key = (~entry.key * swap | entry.key * !swap) & PIPELINE_FILL | (val << PIPELINE_OFFSET);
    Keys.state.pipeline = val;
  }

  static get_pipeline(entry) {
    return (entry.key >> PIPELINE_OFFSET) & PIPELINE_MASK;
  }

  static sort(list) {
    radix_sort(list, radix_get);
    Keys.state.buffer = -1;
    Keys.state.geometry = -1;
    Keys.state.dynamic = -1; 
  }
}

const radix_get = { get: (el) => el.key };

