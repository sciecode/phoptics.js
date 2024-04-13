
import { ResourceType } from "./constants.mjs";
import { RenderPass } from "./entities/render_pass.mjs";
import { RenderTarget } from "./entities/render_target.mjs";
import { CanvasTexture } from "./resources/canvas_texture.mjs";

export class RenderEntities {
  constructor(backend, resources) {
    this.backend = backend;
    this.resources = resources;
    this.render_passes = [];
    this.render_targets = [];
  }

  create_canvas_texture(desc) {
    return new CanvasTexture(this.backend.device, desc);
  }

  create_render_pass(desc) {
    const id = this.render_passes.length;
    this.render_passes.push(
      new RenderPass(id, {
        multisampled: desc.multisampled || false,
        formats: desc.formats
      })
    );
    return this.render_passes[id];
  }

  create_render_target(pass, desc) {
    const id = this.render_targets.length;
    const info = {
      color: [],
    }

    const multisampled = pass.info.multisampled;
    const size = desc.size;

    for (let i = 0; i < desc.color.length; i++) {
      const attachment = desc.color[i];
      const texture = attachment.texture ||
        this.resources.create_texture({
          size: size,
          format: pass.info.formats.color[i],
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
          sampleCount: multisampled ? 4 : 1,
        });
      const cache_view = texture.type != ResourceType.CanvasTexture ? 
        this.resources.create_texture_view(texture, attachment.view) :
        undefined;
      info.color.push({ ...attachment, texture, cache_view });
    }

    if (desc.depth) {
      const attachment = desc.depth;
      const texture = this.resources.create_texture({
        size: size,
        format: pass.info.formats.depth,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        sampleCount: multisampled ? 4 : 1,
      });
      const cache_view = this.resources.create_texture_view(texture, attachment.view);
      info.depth = { ...attachment, texture, cache_view };
    }

    this.render_targets.push({
      version: 0,
      obj: new RenderTarget(id, size, info),
    });
    return this.render_targets[id].obj;
  }

  update_render_target(target) {
    const entry = this.render_targets[target.id];
    const current_version = target.get_version();

    if (entry.version != current_version) {
      const { color, depth } = target.attachments;
      for (let attachment of color) {
        attachment.texture.set_size(target.size);
        if ( attachment.texture.type != ResourceType.CanvasTexture ) {
          this.resources.update_texture(attachment.texture);
          attachment.cache_view = this.resources.create_texture_view(attachment.texture, attachment.view);
        }
        if (attachment.resolve) attachment.resolve.set_size(target.size);
      }
      if (depth) {
        depth.texture.set_size(target.size);
        this.resources.update_texture(depth.texture);
        depth.cache_view = this.resources.create_texture_view(depth.texture, depth.view);
      }

      entry.version = current_version;
    }
  }

}