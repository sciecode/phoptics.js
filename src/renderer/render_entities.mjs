
import { RenderPass } from "./entities/render_pass.mjs";
import { RenderTarget } from "./entities/render_target.mjs";

export class RenderEntities {
  constructor(backend, resources) {
    this.backend = backend;
    this.resources = resources;
    this.render_passes = [];
    this.render_targets = [];
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
      info.color.push( { ...desc.color[i],
        texture: this.resources.create_texture({
          size: size,
          format: pass.info.formats.color[i],
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
          sampleCount: multisampled ? 4 : 1,
        })
      });
    }

    if (desc.depth) {
      info.depth = { ...desc.depth,
        texture: this.resources.create_texture({
          size: size,
          format: pass.info.formats.depth,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
          sampleCount: multisampled ? 4 : 1,
        })
      }
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
        attachment.texture.size.width = target.size.width;
        attachment.texture.size.height = target.size.height;
        attachment.texture.update();
      }
      if (depth) {
        depth.texture.size.width = target.size.width;
        depth.texture.size.height = target.size.height;
        depth.texture.update();
      }

      entry.version = current_version;
    }
  }

}