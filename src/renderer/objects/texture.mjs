import { ResourceType, TextureSourceType, UNINITIALIZED } from "../constants.mjs";
import { TextureView } from "./texture_view.mjs";

export class Texture {
  #id = UNINITIALIZED;
  #version = 0;
  #source = undefined;
  #free = () => {}

  constructor(options) {
    this.type = ResourceType.Texture;
    this.size = { ...options.size };
    this.format = options.format;
    this.usage = options.usage || (GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING);
    this.multisampled = options.multisampled || false;
    // TODO: MIP / ARRAY
  }

  set_size(size) {
    this.size = { ...size };
    this.#update();
    return this;
  }

  upload_image(options) {
    this.#source = { type: TextureSourceType.Image, options: options };
    return this;
  }

  upload_data(options) {
    this.#source = { type: TextureSourceType.Data, options: options };
    return this;
  }

  create_view(desc) {
    return new TextureView({ texture: this, info: desc });
  }

  get_id() { return this.#id; }
  get_version() { return this.#version; }
  get_source() { return this.#source; }
  clear_source() { return this.#source = undefined; }
  initialize(id, free) { if (this.#id == UNINITIALIZED) { this.#id = id; this.#free = free } }
  destroy() { this.#free(this.#id); this.#id = -1; }
  #update() { this.#version = (this.#version + 1) & UNINITIALIZED; }
}