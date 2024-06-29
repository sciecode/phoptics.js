const BIT_MAX = 32;
const BIN_BITS = 8;
const BIN_SIZE = 1 << BIN_BITS;
const BIN_MAX = BIN_SIZE - 1;
const ITERATIONS = Math.ceil(BIT_MAX / BIN_BITS);

const bins = new Array(ITERATIONS);
const bins_buffer = new ArrayBuffer((ITERATIONS + 1) * BIN_SIZE * 4);

let aux, c = 0;
for (let i = 0; i < (ITERATIONS + 1); i++) {
  bins[i] = new Uint32Array(bins_buffer, c, BIN_SIZE);
  c += BIN_SIZE * 4;
}

const defaultGet = (el) => el;

export default (arr, opt = {}) => {

  const get = opt.get || defaultGet;
  const len = opt.len || arr.length;

  if (!len) return;

  aux ||= new arr.constructor(len);
  if (aux.length < len) aux.length = len;

  const data = [arr, aux];

  const insertionSortBlock = (depth, start, len) => {

    const a = data[depth & 1];
    const b = data[(depth + 1) & 1];

    for (let j = start + 1; j < start + len; j++) {
      const p = a[j], t = get(p) >>> 0;
      let i = j;
      while (i > start) {
        if ((get(a[i - 1]) >>> 0) > t) a[i] = a[--i];
        else break;
      }
      a[i] = p;
    }

    if ((depth & 1) == 1) {
      for (let i = start; i < start + len; i++)
        b[i] = a[i];
    }

  };

  const radixSortBlock = (depth, start, len) => {

    const a = data[depth & 1];
    const b = data[(depth + 1) & 1];

    const shift = BIN_BITS * (ITERATIONS - 1 - depth);
    const end = start + len;

    const cache = bins[depth];
    const bin = bins[depth + 1];

    bin.fill(0);

    for (let j = start; j < end; j++)
      bin[(get(a[j]) >>> shift) & BIN_MAX]++;

    for (let j = 1; j < BIN_SIZE; j++)
      bin[j] += bin[j - 1];

    cache.set(bin);

    for (let j = end - 1; j >= start; j--)
      b[start + --bin[(get(a[j]) >>> shift) & BIN_MAX]] = a[j];

    if (depth == ITERATIONS - 1) {
      for (let i = start; i < start + len; i++)
        a[i] = b[i];
      return;
    }

    let prev = 0;
    for (let j = 0; j < BIN_SIZE; j++) {
      const cur = cache[j], diff = cur - prev;
      if (diff != 0) {
        if (diff > 32) radixSortBlock(depth + 1, start + prev, diff);
        else insertionSortBlock(depth + 1, start + prev, diff);
        prev = cur;
      }
    }

  };

  radixSortBlock(0, 0, len);

};