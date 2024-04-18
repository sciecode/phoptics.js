import { ResourceType } from "../constants.mjs";
import { StructuredBuffer } from "../objects/structured_buffer.mjs";

const bind_resource = (obj, name, binding, resource) => {
  obj[name] = resource;
  obj.bindings.push({ binding: binding, name: name });
}

export const build_bindings = (obj, options) => {
  obj.bindings = new Array();
  for (let entry of options) {
    switch (entry.type) {
      case ResourceType.StructuredBuffer:
        bind_resource(obj, entry.name, entry.binding, new StructuredBuffer(entry.info));
        break;
      default:
        bind_resource(obj, entry.name, entry.binding, entry.resource);
    }
  }
}