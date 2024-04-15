import { UNINITIALIZED } from "../constants.mjs";
import { Texture } from "./texture.mjs";

export class RenderTarget {
  #id = UNINITIALIZED;
  #version = 0;

  constructor(render_pass, options) {
    this.size = { ...options.size };
    this.multisampled = render_pass.multisampled || false;
    this.attachments = {
      color: options.color.map((entry, idx) => build_target(entry, this.size, render_pass.formats.color[idx], this.multisampled)),
      depth: options.depth ? build_target(options.depth, this.size, render_pass.formats.depth, this.multisampled) : undefined
    };
  }

  set_size(size) {
    this.size = { ...size };
    this.#update();
  }

  get_id() { return this.#id }
  get_version() { return this.#version }
  initialize(id) { if (this.#id == UNINITIALIZED) this.#id = id; }
  #update() { this.#version = (this.#version + 1) & UNINITIALIZED }
}

const build_target = (desc, size, format, multisampled) => {
  return {
    texture: desc.texture || new Texture({
      size: size,
      format: format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      multisampled: multisampled,
    }),
    resolve: desc.resolve,
    view: desc.view,
    clear: desc.clear,
    load: desc.load || ((desc.clear !== undefined) ? 'clear' : 'load'),
    store: desc.store || 'store',
  }
}
