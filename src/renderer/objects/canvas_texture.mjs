import { ResourceType, UNINITIALIZED } from "../constants.mjs";
import { TextureView } from "./texture_view.mjs";

export class CanvasTexture {
  #version = UNINITIALIZED;

  constructor(options = {}) {
    this.type = ResourceType.CanvasTexture;
    this.canvas = options.canvas || document.createElement('canvas');
    this.context = this.canvas.getContext('webgpu');
    this.format = options.format;
  }

  set_size(size) {
    this.canvas.width = size.width;
    this.canvas.height = size.height;
  }

  create_view(desc) {
    return new TextureView({ texture: this, info: desc });
  }
  
  get_current_view(desc) {
    return this.context.getCurrentTexture().createView(desc);
  }

  get_version() { return this.#version; }
  initialize(version) { if (this.#version == UNINITIALIZED) this.#version = version; }
  destroy() {}
}