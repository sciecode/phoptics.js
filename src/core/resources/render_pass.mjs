export class RenderPass {
  constructor(options = {}) {
    this.colorAttachments = [];

    for (let i = 0, il = options.color.length; i < il; i++) {
      const entry = options.color[i];
      this.colorAttachments.push({
        // type: entry.type,
        target: entry.target,
        // clear: entry.clear
      });
    }
  }

  get_descriptor() {
    const descriptor = {
      colorAttachments: []
    };

    for (let i = 0, il = this.colorAttachments.length; i < il; i++) {
      const entry = this.colorAttachments[i];
      descriptor.colorAttachments.push({
        view: entry.target,
        clearValue: [.3, .3, .3, 1],
        loadOp: 'clear',
        storeOp: 'store',
      });
    }

    return descriptor;
  }
}