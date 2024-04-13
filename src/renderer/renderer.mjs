import { GPUBackend } from "../backend/gpu_backend.mjs"
import { DrawStream } from "./common/draw_stream.mjs";
import { RenderResources } from "./render_resources.mjs";
import { RenderEntities } from "./render_entities.mjs";

export class Renderer {
  constructor(device) {
    this.backend = new GPUBackend(device);
    this.resources = new RenderResources(this.backend);
    this.entities = new RenderEntities(this.backend, this.resources);
    this.draw_stream = new DrawStream();
  }

  create_render_pass(desc) { return this.entities.create_render_pass(desc); }
  create_render_target(pass, desc) { return this.entities.create_render_target(pass, desc); }

  render(target, draw_stream) {
    this.entities.update_render_target(target);

    const attachments = target.attachments;
    const render_pass_info = {
      attachments: {
        color: attachments.color.map( attachment => { 
          return { ...attachment, texture: this.resources.get_texture_handle(attachment.texture) }
        }),
        depth: attachments.depth ? { ...attachments.depth, texture: this.resources.get_texture_handle(attachments.depth.texture) } : undefined
      }
    };

    this.backend.render(render_pass_info, draw_stream);
  }
}