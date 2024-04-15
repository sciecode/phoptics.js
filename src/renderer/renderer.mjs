import { GPUBackend } from "../backend/gpu_backend.mjs"
import { DrawStream } from "./common/draw_stream.mjs";
import { RenderCache } from "./common/render_cache.mjs";
import { RenderResources } from "./render_resources.mjs";
import { ResourceType } from "./constants.mjs";

export class Renderer {
  constructor(device) {
    this.backend = new GPUBackend(device);
    this.resources = new RenderResources(this.backend);
    this.cache = new RenderCache(this.backend);
    this.draw_stream = new DrawStream();
  }

  create_render_pass(desc) { return this.entities.create_render_pass(desc); }
  create_render_target(pass, desc) { return this.entities.create_render_target(pass, desc); }
  create_canvas_texture(desc) { return this.entities.create_canvas_texture(desc); }

  render(target, draw_stream) {
    const cached_target = this.cache.get_target(target);
    this.backend.render(make_pass_descriptor(target, cached_target.attachments), draw_stream);
  }
}

const make_pass_descriptor = (target, cache) => {
  const descriptor = {
    colorAttachments: [],
    depth: null,
  };
  
  const attachments = target.attachments;

  for (let [idx, attachment] of attachments.color.entries()) {
    descriptor.colorAttachments.push({
      view: attachment.texture.type == ResourceType.CanvasTexture ? attachment.texture.get_view() : cache.color[idx].view,
      resolveTarget: attachment.resolve ? attachment.resolve.get_view() : undefined,
      clearValue: attachment.clear,
      loadOp: attachment.load,
      storeOp: attachment.store
    })
  }

  if (attachments.depth) {
    descriptor.depthStencilAttachment = {
      view: cache.depth.view,
      depthClearValue: attachments.depth.clear,
      depthLoadOp: attachments.depth.load,
      depthStoreOp: attachments.depth.store
    }
  }

  return descriptor;
}