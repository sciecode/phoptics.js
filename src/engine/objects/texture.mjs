import { Format } from "../../common/constants.mjs";
import { ResourceType, UNINITIALIZED } from "../constants.mjs";
import { TextureView } from "./texture_view.mjs";

export class Texture {
  #id = UNINITIALIZED;
  #version = 0;

  #free = () => {}

  constructor(options) {
    this.type = ResourceType.Texture;
    this.size = {
      width: options.size.width || 1,
      height: options.size.height || 1,
      depth: options.size.depth || 1
    };
    this.mip_levels = options.mip_levels || 1;
    this.format = options.format;
    this.usage = GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING;
    if (options.renderable) this.usage |= GPUTextureUsage.RENDER_ATTACHMENT;
    if (options.storage) this.usage |= GPUTextureUsage.STORAGE_BINDING;
    this.multisampled = options.multisampled || false;
  }

  set_size(size) {
    this.size = {
      width: size.width || 1,
      height: size.height || 1,
      depth: size.depth || 1
    };
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

  static max_mip_levels(width = 1, height = 1, format = Format.RGBA32_FLOAT) {
    const block = Format.block(format);
    if (block.width == 1 & block.height == 1) {
      const max = Math.max(width, height);
      return 32 - Math.clz32(max);
    } else {
      return Math.min(ctz(width/block.width), ctz(height/block.height)) + 1;
    }
  }
}

const ctz = (x) => 31 - Math.clz32(x & -x);