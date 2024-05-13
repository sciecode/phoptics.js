import Keys from "./keys.mjs";

export class RenderState {
  constructor(cache, dynamic) {
    this.cache = cache;
    this.dynamic = dynamic;

    this.state = {
      formats: null,
      multisampled: false,
      global_layout: undefined,
      dynamic_id: undefined,
    };
  }

  reset(list) {
    const size = list.size, max = list.indices.length;

    if (size >= max) {
      for (let i = max, il = size; i < il; i++)
        list.indices.push({ key: 0, index: i, dist: 0 })
    } else {
      let upper = 0, diff = max - size;
      for (let i = 0, il = size; i < il && upper != diff; i++) {
        const current = list.indices[i];
        while (current.index >= size) current.index = list.indices[max - upper++];
      }
    }
  }

  set_pass(pass) {
    this.state.formats = pass.formats;
    this.state.multisampled = pass.multisampled;

    if (pass.bindings) {
      const global_cache = this.cache.get_binding(pass.bindings);
      this.state.global_layout = global_cache.layout;
      return global_cache.bid;
    } else {
      this.state.global_layout = undefined;
      return 0;
    }
  }

  set_dynamic(material) {
    if (material.dynamic) {
      this.state.dynamic_id = this.dynamic.get_group(material.dynamic);
      return this.dynamic.layout;
    } else {
      this.state.dynamic_id = undefined;
      return undefined;
    }
  }

  set_renderlist(list) { 
    let transparent = 0;
    
    this.reset(list);
    for (let i = 0, il = list.size; i < il; i++) {
      const info = list.indices[i], index = info.index;
      const entry = list.entries[index], mesh = entry.mesh;
      
      // needs to be before pipeline update
      const material = mesh.material;
      const dynamic_layout = this.set_dynamic(material);

      if (material.get_transparent()) {
        transparent++;
        info.dist = -entry.dist >>> 0;
      } else {
        info.dist = entry.dist;
      }
      
      info.key = 0;
      const pipeline_cache = this.cache.get_pipeline(material, this.state, dynamic_layout);
      Keys.set_pipeline(info, pipeline_cache.bid);

      const geometry_cache = this.cache.get_geometry(mesh.geometry);
      Keys.set_index(info, geometry_cache.index_bid);
      Keys.set_buffer(info, geometry_cache.buffer_bid);
    }

    list.indices.sort(dist_compare);
    // list.indices.sort(state_compare); // TODO: use adaptive MSB Hybrid-Sort 64b

  }

  preload(pass, mesh) {
    this.set_pass(pass);
    const dynamic_layout = this.set_dynamic(mesh.material);
    this.cache.get_pipeline(mesh.material, this.state, dynamic_layout);
    this.cache.get_geometry(mesh.geometry);
  }
}

const state_compare = (a,b) => a.key - b.key;
const dist_compare = (a,b) => a.dist - b.dist;