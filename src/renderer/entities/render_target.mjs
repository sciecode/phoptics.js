const build_target = (desc) => {
  return {
    texture: desc.texture,
    resolve: desc.resolve,
    view: desc.view,
    cache_view: desc.cache_view,
    clear: desc.clear,
    load: desc.load || ((desc.clear !== undefined) ? 'clear' : 'load'),
    store: desc.store || 'store',
  }
}

export class RenderTarget {
  #version = 0;

  constructor(id, size, desc) {
    this.id = id;
    this.size = size;
    this.attachments = {
      color: desc.color.map((entry) => build_target(entry)),
      depth: desc.depth ? build_target(desc.depth) : undefined
    };
  }

  set_size(size) {
    this.size = { ...size };
    this.update();
  }

  update() { this.#version++ }
  get_version() { return this.#version }
}
