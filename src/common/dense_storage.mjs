export class DenseStorage {
  constructor(capacity = 128) {
    this.count = 0;
    this.sparse = new Map();
    this.dense = new Array(capacity);
    this.data = new Array(capacity);
    this.freelist = [];
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
    this.sparse.set(idx, offset);
    this.dense[offset] = idx;
    this.data[offset] = data;

    this.count++;
    return idx;
  }
  size() { return this.count; }
  grow() { this.dense.length = (this.data.length *= 2); }
  get(idx) { return this.data[this.sparse.get(idx)]; }
  delete(idx) {
    const offset = this.sparse.get(idx);
    const end = --this.count;
    this.data[offset] = this.data[end];
    const key = this.dense[offset] = this.dense[end];
    this.data[end] = this.dense[end] = undefined;
    this.sparse.set(key, offset);
    this.sparse.delete(idx);
    this.freelist.push(idx);
  }
}