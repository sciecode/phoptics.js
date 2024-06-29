import radix_sort from '../../common/radix_sort.mjs';

const INFO = {
  attrib:   { offset: 0,  mask: (1 << 10) - 1 },
  index:    { offset: 10, mask: 1,              fill: (1 << 10) - 1 },
  dynamic:  { offset: 11, mask: 1,              fill: (1 << 11) - 1 },
  pipeline: { offset: 12, mask: (1 << 10) - 1,  fill: (1 << 12) - 1 },
}


export default class Keys {
  static state = {
    index: -1,
    dynamic: -1,
    pipeline: -1,
  }

  static set_attributes(entry, bid) {
    entry.key |= (bid & INFO.attrib.mask) << INFO.attrib.offset;
  }

  static set_index(entry, index) { Keys.set_swap(entry, !!index, 'index'); }
  static set_dynamic(entry, dynamic) { Keys.set_swap(entry, !!dynamic, 'dynamic'); }
  static set_pipeline(entry, pipeline) { Keys.set_swap(entry, pipeline, 'pipeline'); }
  
  static get_pipeline(entry) {
    return (entry.key >> INFO.pipeline.offset) & INFO.pipeline.mask;
  }
  
  static set_swap(entry, key, name) {
    let val = key & INFO[name].mask;
    let swap = (Keys.state[name] != -1) & (Keys.state[name] != val);
    entry.key = (~entry.key * swap | entry.key * !swap) & INFO[name].fill | (val << INFO[name].offset);
    Keys.state[name] = val;
  }

  static sort(list) {
    radix_sort(list, radix_get);
    Keys.state.index = -1;
    Keys.state.dynamic = -1;
    Keys.state.pipeline = -1;
  }
}

const radix_get = { get: (el) => el.key };

