export class PoolStorage {

  constructor(capacity = 1024) {
    this.count = 0;
    this.data = new Array(capacity);
    this.freelist = [];
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

  grow () {
    this.data.length *= 2;
  }

  delete(idx) {
    this.freelist.push(idx);
    this.data[idx] = undefined;
  }

  get(idx) {
    return this.data[idx];
  }

}