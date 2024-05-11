import { NULL_HANDLE } from "../../backend/constants.mjs";

const PIPELINE_OFFSET = 8n, PIPELINE_MASK = (1n << 10n) - 1n;
const INDEX_OFFSET = 4n, INDEX_MASK = (1n << 4n) - 1n;

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

  static get_index(entry) {
    const bid = Number((entry.key >> INDEX_OFFSET) & INDEX_MASK);
    return bid == INDEX_MASK ? NULL_HANDLE : bid;
  }
}