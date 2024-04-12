const build_target = (desc) => {
  return {
    texture: desc.texture,
    resolve: desc.resolve,
    clear: desc.clear,
    view: desc.view,
    load: desc.load || ((desc.clear !== undefined) ? 'clear' : 'load'),
    store: desc.store || 'store',
  }
}

export class RenderTarget {
  constructor(id, size, desc) {
    this.id = id;
    this.size = size;
    this.attachments = {
      color: desc.color.map((entry) => build_target(entry)),
      depth: desc.depth ? build_target(desc.depth) : undefined
    };
  }
}
