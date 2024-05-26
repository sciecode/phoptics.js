import { ResourceType, TextureSourceType, UNINITIALIZED } from "../constants.mjs";
import { TextureView } from "./texture_view.mjs";

export class Texture {
  #id = UNINITIALIZED;
  #version = 0;

  #free = () => {}

  constructor(options) {
    this.type = ResourceType.Texture;
    this.size = { ...options.size };
    this.mip_levels = options.mip_levels || 1;
    this.format = options.format;
    this.usage = options.usage || (GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING);
    this.multisampled = options.multisampled || false;
  }

  set_size(size) {
    this.size = { ...size };
    this.#update();
    return this;
  }

  create_view(desc) {
    return new TextureView({ texture: this, info: desc });
  }

  get_id() { return this.#id; }
  get_version() { return this.#version; }
  initialize(id, free) { if (this.#id == UNINITIALIZED) { this.#id = id; this.#free = free } }
  destroy() { this.#free(this.#id); this.#id = -1; }
  #update() { this.#version = (this.#version + 1) & UNINITIALIZED; }

  static max_mip_levels(width = 1, height = 1) {
    const max = Math.max(width, height);
    return 32 - Math.clz32(max);
  }
}