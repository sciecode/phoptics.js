import { UNINITIALIZED } from "../constants.mjs";

export class RenderList {
  constructor() {
    this.size = 0;
    this.entries = [];
    this.indices = [];
  }

  reset() { 
    this.size = 0;
    this.entries.length = 0;
  }

  add(mesh, dist = UNINITIALIZED) {
    this.size++;
    this.entries.push({ mesh: mesh, dist: dist & UNINITIALIZED });
  }
}