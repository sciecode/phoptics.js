import { GPUResource } from "../constants.mjs";

export class BindGroup {
  constructor(device, resources, options = {}) {
    this.dynamic_entries = options.dynamic_entries || 0;

    const desc = {
      layout: options.layout,
      entries: []
    };

    for (let entry of options.entries) {
      let res;
      switch (entry.type) {
        case GPUResource.BUFFER:
          res = {
            binding: entry.binding,
            resource: { buffer: resources.get_buffer(entry.resource), offset: entry.offset, size: entry.size },
          };
          break;
        case GPUResource.TEXTURE:
          res = {
            binding: entry.binding,
            resource: entry.resource,
          };
          break;
        case GPUResource.SAMPLER:
          res = {
            binding: entry.binding,
            resource: resources.get_sampler(entry.resource),
          };
          break;
      }
      desc.entries.push(res);
    }

    this.group = device.createBindGroup(desc);
  }
}