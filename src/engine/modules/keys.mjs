const BUFFER_OFFSET = 0n, BUFFER_MASK = (1n << 10n) - 1n;
const INDEX_OFFSET = 10n, INDEX_MASK = (1n << 4n) - 1n;
const PIPELINE_OFFSET = 14n, PIPELINE_MASK = (1n << 10n) - 1n;

export default class Keys {
  static set_pipeline(entry, bid) {
    entry.key |= BigInt(bid) << PIPELINE_OFFSET;
  }

  static get_pipeline(entry) {
    return Number((entry.key >> PIPELINE_OFFSET) & PIPELINE_MASK);
  }

  static set_index(entry, bid) {
    entry.key |= (BigInt(bid) & INDEX_MASK) << INDEX_OFFSET;
  }

  static set_buffer(entry, bid) {
    entry.key |= (BigInt(bid) & BUFFER_MASK) << BUFFER_OFFSET;
  }
}