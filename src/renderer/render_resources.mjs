import { GPUTexture } from "./resources/gpu_texture.mjs";

export class RenderResources {
  constructor(backend) {
    this.backend = backend;
    this.gpu_textures = [];
  }

  create_texture(desc) {
    const id = this.gpu_textures.length;
    const bid = this.backend.resources.create_texture(desc);

    this.gpu_textures.push({ 
      version: 0,
      obj: new GPUTexture(id, desc.size, desc.format),
      bid: bid,
    });
    return this.gpu_textures[id].obj;
  }

  create_texture_view(tex, options) {
    return this.backend.resources.get_texture(this.gpu_textures[tex.id].bid).get_view(options);
  }

  update_texture(tex) {
    const entry = this.gpu_textures[tex.id];
    const current_version = tex.get_version();

    if (entry.version != current_version) {
      this.backend.resources.update_texture(entry.bid, tex);
      entry.version = current_version;
    }
  }

  get_texture_handle(tex) {
    return this.gpu_textures[tex.id].bid;
  }
}