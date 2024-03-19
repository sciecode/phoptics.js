export class RenderPass {
  constructor(options = {}) {
    this.color = options.color;
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

    return {
      descriptor: {
        colorAttachments: colorAttachments
      },
      formats: formats
    }
  }
}