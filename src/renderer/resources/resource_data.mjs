
export class ResourceData {
  #version = 0;
  #info;
  constructor(id, info, entries) {
    this.id = id;
    this.#info = info;
    for (let entry of entries) this[entry.name] = entry.view;
  }

  update() { this.#version++ }
  get_version() { return this.#version }
  get_info() { return this.#info }
}