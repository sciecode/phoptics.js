
export class RenderList {
  constructor() {
    this.size = 0;
    this.meshes = [];
    this.indices = [];
  }

  add(mesh) {
    this.size++;
    this.meshes.push(mesh);
  }
}