export class RenderTarget {
  constructor(options) {
    this.color = options.color.map((entry) => build_target(entry));
    this.depth = options.depth ? build_target(options.depth) : undefined;
  }
}

const build_target = (desc) => {
  return {
    resolve: desc.resolve,
    view: desc.view,
    clear: desc.clear,
    load: desc.load || ((desc.clear !== undefined) ? 'clear' : 'load'),
    store: desc.store || 'store',
  }
}
