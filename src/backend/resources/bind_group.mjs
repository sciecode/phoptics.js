import { GPUResource } from "../constants.mjs";

export class BindGroup {
  constructor(device, resources, options = {}) {
    this.info = options;
    this.create_group(device, resources);
  }

  create_group(device, resources) {
    const desc = {
      layout: this.info.layout,
      entries: []
    };

    for (let entry of this.info.entries) {
      let res;
      switch (entry.type) {
        case GPUResource.BUFFER:
          res = {
            binding: entry.binding,
            resource: { buffer: resources.get_buffer(entry.resource) },
          }
          break;
        case GPUResource.TEXTURE:
          const tex = resources.get_texture(entry.resource);
          entry.version = tex.version,
          res = {
            version: tex.version,
            binding: entry.binding,
            resource: tex.get_view(),
          }
          break;
        case GPUResource.SAMPLER:
          res = {
            binding: entry.binding,
            resource: resources.get_sampler(entry.resource),
          }
          break;
      }
      desc.entries.push(res);
    }

    this.group = device.createBindGroup(desc);
  }

  get_group(device, resources) {
    for (let entry of this.info.entries) {
      if (entry.type != GPUResource.TEXTURE) continue;

      const tex = resources.get_texture(entry.resource);

      if (tex.version != entry.version) {
        this.create_group(device, resources);
        break;
      }
    }

    return this.group;
  }
}