const BUFFER_OFFSET = 0, BUFFER_MASK = (1 << 10) - 1;
const INDEX_OFFSET = 10, INDEX_MASK = (1 << 4) - 1;
const PIPELINE_OFFSET = 14, PIPELINE_MASK = (1 << 10) - 1;
// const BLEND_OFFSET = 29;

export default class Keys {
  static set_pipeline(entry, bid) {
    entry.key |= (bid & PIPELINE_MASK) << PIPELINE_OFFSET;
  }

  static get_pipeline(entry) {
    return (entry.key >> PIPELINE_OFFSET) & PIPELINE_MASK;
  }

  static set_index(entry, bid) {
    entry.key |= (bid & INDEX_MASK) << INDEX_OFFSET;
  }

  static set_buffer(entry, bid) {
    entry.key |= (bid & BUFFER_MASK) << BUFFER_OFFSET;
  }

  // static set_blend(entry, blend) {
  //   entry.key |= blend << BLEND_OFFSET;
  // }
}