import { GPUResource } from "../constants.mjs";

export class BindGroup {
  constructor(device, resources, options = {}) {
    this.info = options;
    this.dynamic_entries = options.dynamic_entries || 0;
    this.update_group(device, resources);
  }

  update_group(device, resources) {
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
            resource: { buffer: resources.get_buffer(entry.resource), offset: entry.offset, size: entry.size },
          }
          break;
        case GPUResource.TEXTURE:
          const tex = resources.get_texture(entry.resource);
          res = {
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
}