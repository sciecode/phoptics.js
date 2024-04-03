const build_target = (desc) => {
  if (!desc) return undefined;
  return {
    texture: desc.target,
    resolve: desc.resolve,
    clear: desc.clear,
    view: desc.view,
    load: desc.load || ((desc.clear !== undefined) ? 'clear' : 'load'),
    store: desc.store || 'store',
  }
}

export class RenderTarget {
  constructor(resources, options = {}) {
    this.color = options.color.map( (desc) => build_target(desc) );
    this.depth_stencil = build_target(options.depth_stencil);

    this.formats = {
      color: [],
    };

    for (let attachment of this.color) {
      const texture = resources.get_texture(attachment.texture);
      this.formats.color.push({ format: texture.get_format() });
    }

    if (this.depth_stencil) {
      const texture = resources.get_texture(this.depth_stencil.texture);
      this.formats.depth_stencil = texture.get_format();
    }
  }

  get_render_info(resources) {

    const descriptor = {
      colorAttachments: [],
    };

    for (let attachment of this.color) {
      const texture = resources.get_texture(attachment.texture);
      const resolve = attachment.resolve !== undefined ? resources.get_texture(attachment.resolve) : undefined;
      descriptor.colorAttachments.push({
        view: texture.get_view(attachment.view),
        resolveTarget: resolve?.get_view(attachment.view),
        clearValue: attachment.clear,
        loadOp: attachment.load,
        storeOp: attachment.store
      })
    }

    if (this.depth_stencil) {
      const texture = resources.get_texture(this.depth_stencil.texture);
      descriptor.depthStencilAttachment = {
        view: texture.get_view(this.depth_stencil.view),
        depthClearValue: this.depth_stencil.clear,
        depthLoadOp: this.depth_stencil.load,
        depthStoreOp: this.depth_stencil.store
      }
    }

    return descriptor;
  }
}