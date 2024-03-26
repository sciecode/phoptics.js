import { CanvasTarget } from "./canvas_target.mjs";
import { TextureTarget } from "./texture_target.mjs";

export class RenderTarget {
  constructor(device, options = {}) {
    this.device = device;

    const width = options.width, height = options.height;

    this.color = options.color.map( (texture) => {
      return (
        texture.canvas ? 
          new CanvasTarget(device, width, height, texture) :
          new TextureTarget(device, width, height, texture)
      );
    })

    this.depth_stencil = new TextureTarget(device, width, height, options.depth_stencil);
  }

  set_size(width, height) {
    for (let attachment of this.color)
      attachment.set_size(width, height, this.device);

    if (this.depth_stencil)
      this.depth_stencil.set_size(width, height, this.device);
  }

  get_render_info() {
    const info = {
      descriptor: {
        colorAttachments: [],
      },
      formats: {
        color: [],
      }
    }

    for (let attachment of this.color) {
      info.formats.color.push({ format: attachment.format });
      info.descriptor.colorAttachments.push({
        view: attachment.get_view(),
        clearValue: attachment.clear,
        loadOp: attachment.loadOp,
        storeOp: attachment.storeOp
      })
    }

    if (this.depth_stencil) {
      info.formats.depth_stencil = this.depth_stencil.format;

      info.descriptor.depthStencilAttachment = {
        view: this.depth_stencil.get_view(),
        depthClearValue: this.depth_stencil.clear,
        depthLoadOp: this.depth_stencil.loadOp,
        depthStoreOp: this.depth_stencil.storeOp
      }
    }

    return info;
  }

  destroy() {
    for (let attachment of this.color) attachment.destroy();
    if (this.depth_stencil) this.depth_stencil.destroy();
  }
}