export class BindGroup {
  constructor(device, resources, options = {}) {
    for (let i = 0, il = options.entries.length; i < il; i++) {
      const resource = options.entries[i].resource;
      if (resource.buffer !== undefined) {
        resource.buffer = resources.get_buffer(resource.buffer);
      }
    }
    this.group = device.createBindGroup(options);
  }
}