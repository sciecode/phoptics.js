import radix_sort from '../../common/radix_sort.mjs';

// TODO: clean-up
const ATTRIB_OFFSET = 0, ATTRIB_MASK = (1 << 10) - 1;
const INDEX_OFFSET = 10, INDEX_MASK = 1, INDEX_FILL = (1 << INDEX_OFFSET) - 1;
const DYNAMIC_OFFSET = 11, DYNAMIC_MASK = 1, DYNAMIC_FILL = (1 << DYNAMIC_OFFSET) - 1;
const PIPELINE_OFFSET = 12, PIPELINE_MASK = (1 << 10) - 1, PIPELINE_FILL = (1 << PIPELINE_OFFSET) - 1;

export default class Keys {
  static state = {
    index: -1,
    dynamic: -1,
    pipeline: -1,
  }

  static set_attributes(entry, bid) {
    entry.key |= (bid & ATTRIB_MASK) << ATTRIB_OFFSET;
  }

  static set_index(entry, index) {
    let val = (!!index) & INDEX_MASK;
    let swap = (Keys.state.index != -1) & (Keys.state.index != val);
    entry.key = (~entry.key * swap | entry.key * !swap) & INDEX_FILL | (val << INDEX_OFFSET);
    Keys.state.index = val;
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
    Keys.state.index = -1;
    Keys.state.dynamic = -1;
    Keys.state.pipeline = -1;
  }
}

const radix_get = { get: (el) => el.key };

