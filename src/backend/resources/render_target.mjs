const build_target = (desc) => {
  return {
    texture: desc.target,
    clear: desc.clear,
    view: desc.view,
    load: desc.load || ((desc.clear !== undefined) ? 'clear' : 'load'),
    store: desc.store || 'store',
  }
}

export class RenderTarget {
  constructor(options = {}) {
    this.color = options.color.map( (desc) => build_target(desc) );
    this.depth_stencil = build_target(options.depth_stencil);
  }

  get_render_info(resources) {
    const info = {
      descriptor: {
        colorAttachments: [],
      },
      formats: {
        color: [],
      }
    }

    for (let attachment of this.color) {
      const texture = resources.get_texture(attachment.texture);
      info.formats.color.push({ format: texture.get_format() });
      info.descriptor.colorAttachments.push({
        view: texture.get_view(attachment.view),
        clearValue: attachment.clear,
        loadOp: attachment.load,
        storeOp: attachment.store
      })
    }

    if (this.depth_stencil) {
      const texture = resources.get_texture(this.depth_stencil.texture);
      info.formats.depth_stencil = texture.get_format();

      info.descriptor.depthStencilAttachment = {
        view: texture.get_view(this.depth_stencil.view),
        depthClearValue: this.depth_stencil.clear,
        depthLoadOp: this.depth_stencil.load,
        depthStoreOp: this.depth_stencil.store
      }
    }

    return info;
  }
}