export class RenderPass {
  constructor(options = {}) {
    this.color = options.color;
    this.depth_stencil = options.depth_stencil;
  }

  get_render_info(resources) {
    const formats = [];
    const colorAttachments = [];

    for (let i = 0, il = this.color.length; i < il; i++) {
      const entry = this.color[i];
      const rt = resources.get_render_target(entry.target);

      formats.push({format: rt.format});

      let state, clear;

      if (!!entry.clear) {
        state = 'clear';
        clear = entry.clear;
      } else {
        state = 'load';
      }

      colorAttachments.push({
        view: rt.get_view(),
        clearValue: clear,
        loadOp: state,
        storeOp: 'store',
      });
    }

    const ds_t = resources.get_texture(this.depth_stencil.target);

    return {
      descriptor: {
        colorAttachments: colorAttachments,
        depthStencilAttachment: {
          view: ds_t.createView(),
          depthClearValue: this.depth_stencil.clear,
          depthLoadOp: !!this.depth_stencil.clear ? 'clear' : 'load',
          depthStoreOp: 'discard'
        }
      },
      formats: {
        color: formats,
        depth_stencil: ds_t.format
      }
    }
  }
}