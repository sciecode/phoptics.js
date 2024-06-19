/*
  Based on https://github.com/sebbbi/OffsetAllocator/ by Sebastian Aaltonen
*/

const UNUSED = (-1 >>> 0);
const NODE_USED = (1 << 31);
const NODE_UNUSED_MASK = ~NODE_USED;

const NUM_ROWS = 32;
const MANTISSA_BITS = 3;
const MANTISSA_VALUE = (1 << MANTISSA_BITS);
const MANTISSA_MASK = MANTISSA_VALUE - 1;
const NUM_BINS = NUM_ROWS * MANTISSA_VALUE;

const clz = (x) => Math.clz32(x);
const ctz = (x) => 31 - Math.clz32(x & -x);

const sm_up = (x) => {
  if (x > MANTISSA_MASK) {
    const fls = 31 - clz(x);
    const mantissa_start = fls - MANTISSA_BITS;
    const exp = mantissa_start + 1;
    
    const low_bits = (1 << mantissa_start) - 1;
    let mantissa = (x >>> mantissa_start) & MANTISSA_MASK;
    if ((x & low_bits) != 0) mantissa++;
    return (exp << MANTISSA_BITS) + mantissa;
  } else {
    return x;
  }
}

const sm_dn = (x) => {
  if (x > MANTISSA_MASK) {
    const fls = 31 - clz(x);
    const mantissa_start = fls - MANTISSA_BITS;
    const exp = mantissa_start + 1;

    let mantissa = (x >>> mantissa_start) & MANTISSA_MASK;
    return (exp << MANTISSA_BITS) | mantissa;
  } else {
    return x;
  }
}

const sm_ffs = (mask, i) => {
  const mask_after = ~((1 << i) - 1);
  const bits = mask & mask_after;
  return !bits ? UNUSED : ctz(bits);
}

export class OffsetAllocator {
  constructor(size, max_alloc = 512 * 1024) {
    this.size = size;
    this.max_alloc = Math.min(max_alloc, size) + 2;

    this.bins_top = 0;
    this.bins = new Uint8Array(NUM_ROWS);
    this.indices = new Uint32Array(NUM_BINS);

    this.nodes = new Uint32Array(this.max_alloc * 6);
    this.free_nodes = new Uint32Array(this.max_alloc);

    this.free_storage = 0;
    this.free_offset = 0;

    this.reset();
  }

  reset() {
    this.bins_top = 0;
    this.bins.fill(0);
    this.indices.fill(UNUSED);
    this.nodes.fill(UNUSED);

    this.free_storage = 0;
    this.free_offset = this.max_alloc - 1;
    
    for (let i = 0; i < this.max_alloc; i++) {
      const i6 = i * 6;
      this.free_nodes[i] = this.max_alloc - i - 1;
      this.nodes[i6] = 0;
      this.nodes[i6 + 1] = 0;
    }

    this.insert_node(this.size, 0);
  }

  malloc(size) {
    const min_bin = sm_up(size);
    const min_fl = min_bin >>> MANTISSA_BITS;
    const min_sl = min_bin & MANTISSA_MASK;
    
    let fl = min_fl;
    let sl = UNUSED;

    if (this.bins_top & (1 << fl)) sl = sm_ffs(this.bins[fl], min_sl);
    
    if (sl == UNUSED) {
      fl = sm_ffs(this.bins_top, min_fl + 1);
      if (fl == UNUSED) return { slot: undefined }; 
      sl = ctz(this.bins[fl]);
    }
            
    const bin = (fl << MANTISSA_BITS) | sl;
    const node_id = this.indices[bin], c6 = node_id * 6;

    const total_size = this.nodes[c6 + 1] & NODE_UNUSED_MASK;
    const remainder = total_size - size;
    
    if (remainder && !this.free_offset) return { slot: undefined };
    
    const offset = this.nodes[c6];
    const bin_next = this.nodes[c6 + 3];
    const neighbor_next = this.nodes[c6 + 5];

    this.nodes[c6 + 1] = size | NODE_USED;
    this.free_storage -= total_size;

    this.indices[bin] = bin_next;
    if (bin_next != UNUSED) this.nodes[bin_next * 6 + 2] = UNUSED;

    if (this.indices[bin] == UNUSED) {
      this.bins[fl] &= ~(1 << sl);
      if (this.bins[fl] == 0) this.bins_top &= ~(1 << fl);
    }
    
    if (remainder > 0) {
      const new_id = this.insert_node(remainder, offset + size), n6 = new_id * 6;
      if (neighbor_next != UNUSED) this.nodes[neighbor_next * 6 + 4] = new_id;
      this.nodes[n6 + 4] = node_id;
      this.nodes[n6 + 5] = neighbor_next;
      this.nodes[c6 + 5] = new_id;
    }
    
    return { offset: offset, slot: node_id };
  }

  free(id) {
    const c6 = id * 6;
    let offset = this.nodes[c6];
    let size = this.nodes[c6 + 1] & NODE_UNUSED_MASK;
    let neighbor_prev = this.nodes[c6 + 4], p6 = neighbor_prev * 6;
    let neighbor_next = this.nodes[c6 + 5], n6 = neighbor_next * 6;

    if ((neighbor_prev != UNUSED) && !(this.nodes[p6 + 1] & NODE_USED)) {
      offset = this.nodes[p6];
      size += this.nodes[p6 + 1] & NODE_UNUSED_MASK;
      this.remove_node(neighbor_prev);

      neighbor_prev = this.nodes[c6 + 4] = this.nodes[p6 + 4];
      if (neighbor_prev != UNUSED) this.nodes[neighbor_prev * 6 + 5] = id;
    }

    if ((neighbor_next != UNUSED) && !(this.nodes[n6 + 1] & NODE_USED)) {
      size += this.nodes[n6 + 1] & NODE_UNUSED_MASK;
      this.remove_node(neighbor_next);

      neighbor_next = this.nodes[c6 + 5] = this.nodes[n6 + 5];
      if (neighbor_next != UNUSED) this.nodes[neighbor_next * 6 + 4] = id;
    }

    this.free_nodes[++this.free_offset] = id;
    this.insert_node(size, offset);
  }

  insert_node(size, offset) {
    const bin = sm_dn(size);
    const fl = bin >>> MANTISSA_BITS;
    const sl = bin & MANTISSA_MASK;

    if (this.indices[bin] == UNUSED) {
      this.bins[fl] |= 1 << sl;
      this.bins_top |= 1 << fl;
    }

    const node_fl = this.indices[bin];
    const node_id = this.free_nodes[this.free_offset--];

    this.nodes.set([offset, size, UNUSED, node_fl], node_id * 6);
    if (node_fl != UNUSED) this.nodes[node_fl * 6 + 2] = node_id;
    
    this.indices[bin] = node_id;
    this.free_storage += size;


    return node_id;
  }

  remove_node(node_id) {
    const c6 = node_id * 6;
    const bin_prev = this.nodes[c6 + 2];
    const bin_next = this.nodes[c6 + 3];
    const size = this.nodes[c6 + 1] & NODE_UNUSED_MASK;

    if (bin_prev != UNUSED) {
      const p6 = bin_prev * 6;
      this.nodes[p6 + 3] = bin_next;
      if (bin_next != UNUSED) this.nodes[bin_next * 6 + 2] = bin_prev;
    } else {
      const bin = sm_dn(size);
      const fl = bin >>> MANTISSA_BITS;
      const sl = bin & MANTISSA_MASK;
      
      this.indices[bin] = bin_next;
      if (bin_next != UNUSED) this.nodes[bin_next * 6 + 2] = UNUSED;

      if (this.indices[bin] == UNUSED) {
        this.bins[fl] &= ~(1 << sl);
        if (this.bins[fl] == 0) this.bins_top &= ~(1 << fl);
      }
    }

    this.free_nodes[++this.free_offset] = node_id;
    this.free_storage -= size;
  }
}