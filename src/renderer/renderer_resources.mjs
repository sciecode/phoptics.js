import { RenderPass } from "./objects/render_pass.mjs";
import { RenderTarget } from "./objects/render_target.mjs";

export class Resources {
  constructor(backend) {
    this.backend = backend;
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
        texture: this.backend.resources.create_texture({
          size: size,
          format: pass.info.formats.color[i],
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
          sampleCount: multisampled ? 4 : 1,
        })
      });
    }

    if (desc.depth) {
      info.depth = { ...desc.depth,
        texture: this.backend.resources.create_texture({
          size: size,
          format: pass.info.formats.depth,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
          sampleCount: multisampled ? 4 : 1,
        })
      }
    }

    this.render_targets.push(new RenderTarget(id, size, info));
    return this.render_targets[id];
  }

}