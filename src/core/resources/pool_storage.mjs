export class PoolStorage {

  constructor(capacity = 1024) {
    this.count = 0;
    this.capacity = capacity;
    this.data = new Array(this.count);
    this.freelist = [];
  }

  allocate(data) {
    let idx;
    
    if (this.freelist.length) {
      idx = this.freelist.pop();
    } else {
      idx = this.count++;

      if (this.count == this.capacity) this.grow();
    }

    this.data[idx] = data;

    return idx;
  }

  grow () {
    this.capacity *= 2;
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