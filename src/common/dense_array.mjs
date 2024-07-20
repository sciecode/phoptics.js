export class DenseArray {
  constructor(capacity = 128) {
    this.count = 0;
    this.offsets = new Array(capacity);
    this.indices = new Array(capacity);
    this.data = new Array(capacity);
    this.freelist = [];
    // TOOD: replace freelist with index based linked-list
  }

  allocate(data) {
    let idx;

    if (this.freelist.length) {
      idx = this.freelist.pop();
    } else {
      idx = this.count;
      if (this.count == this.data.length) this.grow();
    }

    const offset = this.count;
    this.offsets[idx] = offset;
    this.data[offset] = data;
    this.indices[offset] = idx;

    this.count++;
    return idx;
  }
  size() { return this.count; }
  grow() { this.indices.length = this.offsets.length = (this.data.length *= 2); }
  get(idx) { return this.data[this.offsets[idx]]; }
  delete(idx) {
    const offset = this.offsets[idx];

    const end = --this.count;
    const new_idx = this.indices[offset] = this.indices[end];
    this.indices[end] = undefined;

    this.offsets[new_idx] = offset;
    this.offsets[idx] = undefined;

    this.data[offset] = this.data[end];
    this.data[end] = undefined;

    this.freelist.push(idx);
  }
}