export class RenderTarget {
  constructor(options) {
    this.color = options.color.map((entry) => build_target(entry));
    this.depth = options.depth ? build_target(options.depth) : undefined;
  }

  set_size(size) {
    for (let attach of this.color) {
      attach.view.texture.set_size(size);
      if (attach.resolve) attach.resolve.texture.set_size(size);
    }
    if (this.depth) this.depth.view.texture.set_size(size);
  }
}

const build_target = (desc) => {
  return {
    resolve: desc.resolve,
    view: desc.view,
    clear: desc.clear,
    load: desc.load || ((desc.clear !== undefined) ? 'clear' : 'load'),
    store: desc.store || 'store',
  };
};
