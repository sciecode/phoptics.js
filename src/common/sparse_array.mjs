export class SparseArray {

  constructor(capacity = 128) {
    this.count = 0;
    this.data = new Array(capacity);
    this.freelist = [];
    // TOOD: replace freelist with index based linked-list
  }

  allocate(data) {
    let idx;

    if (this.freelist.length) {
      idx = this.freelist.pop();
    } else {
      idx = this.count++;
      if (this.count == this.data.length) this.grow();
    }

    this.data[idx] = data;

    return idx;
  }

  size() { return this.count - this.freelist.length; }
  grow() { this.data.length *= 2; }
  get(idx) { return this.data[idx]; }
  delete(idx) {
    this.freelist.push(idx);
    this.data[idx] = undefined;
  }
}