import { ResourceType, UNINITIALIZED } from "../constants.mjs";

export class CanvasTexture {
  #version = UNINITIALIZED;

  constructor(canvas) {
    this.type = ResourceType.CanvasTexture;
    this.canvas = canvas || document.createElement('canvas');
    this.context = this.canvas.getContext('webgpu');
  }

  set_size(size) {
    this.canvas.width = size.width;
    this.canvas.height = size.height;
  }

  get_view(descriptor) {
    return this.context.getCurrentTexture().createView(descriptor);
  }

  get_version() { return this.#version }
  initialize(version) { if (this.#version == UNINITIALIZED) this.#version = version; }
}