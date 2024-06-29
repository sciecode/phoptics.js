import { PoolStorage } from "./pool_storage.mjs";

export class SparseSet {
  constructor() {
    this.map = new Map();
    this.dense = new PoolStorage();
  }

  has(key) { return this.map.get(key); }
  get(id) { return this.dense.get(id); }
  set(key, value) {
    const id = this.dense.allocate({ ...value, key });
    this.map.set(key, id);
    return id;
  }
  delete(id) {
    const key = this.dense.get(id).key;
    this.map.delete(key);
    this.dense.delete(id);
  }
}