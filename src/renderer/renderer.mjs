import { GPUBackend } from "../backend/gpu_backend.mjs"
import { DrawStream } from "./common/draw_stream.mjs";
import { RenderResources } from "./render_resources.mjs";
import { RenderEntities } from "./render_entities.mjs";
import { ResourceType } from "./constants.mjs";

export class Renderer {
  constructor(device) {
    this.backend = new GPUBackend(device);
    this.resources = new RenderResources(this.backend);
    this.entities = new RenderEntities(this.backend, this.resources);
    this.draw_stream = new DrawStream();
  }

  create_render_pass(desc) { return this.entities.create_render_pass(desc); }
  create_render_target(pass, desc) { return this.entities.create_render_target(pass, desc); }
  create_canvas_texture(desc) { return this.entities.create_canvas_texture(desc); }

  render(target, draw_stream) {
    this.entities.update_render_target(target);
    this.backend.render(make_pass_descriptor(target), draw_stream);
  }
}

const make_pass_descriptor = (target) => {
  const descriptor = {
    colorAttachments: [],
    depth: null,
  };
  
  const attachments = target.attachments;

  for (let attachment of attachments.color) {
    descriptor.colorAttachments.push({
      view: attachment.texture.type == ResourceType.CanvasTexture ? attachment.texture.get_view() : attachment.cache_view,
      resolveTarget: attachment.resolve ? attachment.resolve.get_view() : undefined,
      clearValue: attachment.clear,
      loadOp: attachment.load,
      storeOp: attachment.store
    })
  }

  if (attachments.depth) {
    descriptor.depthStencilAttachment = {
      view: attachments.depth.cache_view,
      depthClearValue: attachments.depth.clear,
      depthLoadOp: attachments.depth.load,
      depthStoreOp: attachments.depth.store
    }
  }

  return descriptor;
}