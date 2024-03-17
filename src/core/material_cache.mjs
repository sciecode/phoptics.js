export class MaterialCache {
  constructor() {
    this.map = new Map();
    this.shaders = [];
  }

  #get_free_index() {
    return this.shaders.length;
  }

  create(device, material) {
    const idx = this.#get_free_index();
    this.map.set(material.MATID, idx);

    return (this.shaders[idx] = device.createShaderModule({
      code: material.shader
    }));
  }

  get(material) {
    const idx = this.map.get(material.MATID);
    return idx === undefined ? this.shaders[idx] : undefined;
  }
}