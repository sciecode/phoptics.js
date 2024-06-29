import radix_sort from '../../common/radix_sort.mjs';

const INFO = {
  attrib: { offset: 0, mask: (1 << 10) - 1 },
  index: { offset: 10, mask: 1, fill: (1 << 10) - 1, state: 0, },
  dynamic: { offset: 11, mask: 1, fill: (1 << 11) - 1, state: 1 },
  pipeline: { offset: 12, mask: (1 << 10) - 1, fill: (1 << 12) - 1, state: 2 },
};

export default class Keys {
  static state = [].fill(-1);

  static set_attributes(entry, bid) {
    entry.key |= (bid & INFO.attrib.mask) << INFO.attrib.offset;
  }

  static set_index(entry, index) { Keys.set_swap(entry, !!index, INFO.attrib); }
  static set_dynamic(entry, dynamic) { Keys.set_swap(entry, !!dynamic, INFO.dynamic); }
  static set_pipeline(entry, pipeline) { Keys.set_swap(entry, pipeline, INFO.pipeline); }

  static get_pipeline(entry) {
    return (entry.key >> INFO.pipeline.offset) & INFO.pipeline.mask;
  }

  static set_swap(entry, key, info) {
    let val = key & info.mask;
    let swap = (Keys.state[info.state] != -1) & (Keys.state[info.state] != val);
    entry.key = (~entry.key * swap | entry.key * !swap) & info.fill | (val << info.offset);
    Keys.state[info.state] = val;
  }

  static sort(list) {
    radix_sort(list, radix_get);
    Keys.state.fill(-1);
  }
}

const radix_get = { get: (el) => el.key };

