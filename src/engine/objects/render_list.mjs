import { UNINITIALIZED } from "../constants.mjs";

export class RenderList extends Array {
  constructor() {
    super();
  }

  reset() {
    this.length = 0;
  }

  add(mesh, key = UNINITIALIZED) {
    this.push({ mesh: mesh, key: key & UNINITIALIZED });
  }
}