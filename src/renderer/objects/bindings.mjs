import { ResourceType, UNINITIALIZED } from "../constants.mjs";
import { StructuredBuffer } from "./structured_buffer.mjs";

export class Bindings {
  #id = UNINITIALIZED;
  #version = 0;

  constructor(options) {
    this.info = new Array();
    for (let entry of options) {
      switch (entry.type) {
        case ResourceType.StructuredBuffer:
          bind_resource(this, entry, new StructuredBuffer(entry.info));
          break;
        default:
          bind_resource(this, entry, entry.resource);
      }
    }
  }
  
  get_id() { return this.#id; }
  get_version() { return this.#version; }
  initialize(id) { if (this.#id == UNINITIALIZED) this.#id = id; }
  update() { this.#version = (this.#version + 1) & UNINITIALIZED; }
}

const bind_resource = (obj, entry, resource) => {
  obj[entry.name] = resource;
  obj.info.push({ binding: entry.binding, name: entry.name, visibility: entry.visibility });
}