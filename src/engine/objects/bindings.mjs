import { ResourceType, UNINITIALIZED } from "../constants.mjs";
import { Sampler } from "./sampler.mjs";
import { StructuredBuffer } from "./structured_buffer.mjs";

export class Bindings {
  #id = UNINITIALIZED;
  #version = 0;
  #free = () => {};

  constructor(options) {
    this.info = new Array();
    for (let entry of options) {
      switch (entry.type) {
        case ResourceType.StructuredBuffer:
          bind_resource(this, entry, new StructuredBuffer(entry.info), true);
          break;
        case ResourceType.Sampler:
          bind_resource(this, entry, new Sampler(entry.info), false);
          break;
        default:
          bind_resource(this, entry, entry.resource, false);
      }
    }
  }

  get_id() { return this.#id; }
  get_version() { return this.#version; }
  initialize(id, free) { if (this.#id == UNINITIALIZED) { this.#id = id; this.#free = free; } }
  destroy() {
    for (let entry of this.info) entry.ownership && this[entry.name].destroy();
    this.#free(this.#id);
    this.#id = -1;
    this.#free = () => {};
  }
  update() { this.#version = (this.#version + 1) & UNINITIALIZED; }
}

const bind_resource = (obj, entry, resource, ownership) => {
  obj[entry.name] = resource;
  obj.info.push({ name: entry.name, visibility: entry.visibility, ownership: ownership });
};