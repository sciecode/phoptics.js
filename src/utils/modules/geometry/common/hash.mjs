// FNV-1a - 32 bits // slightly poor avalanche on small sequential values
export const Fnv32 = (prev, arr, start, len) => {
  const OFFSET = 0x811c9dc5;
  const PRIME = 0x01000193;

  let h = (prev === undefined) ? OFFSET : prev, o = 0;
  while (o < len) {
    h ^= arr[start + o++];
    h *= PRIME;
  }

  return h >>> 0;
};

// default 32 bits hash
export const Hash32 = Fnv32;