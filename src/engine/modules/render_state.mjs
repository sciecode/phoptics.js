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
    for (let i = 0, il = list.length; i < il; i++) {
      const entry = list[i], mesh = entry.mesh;
      entry.key = 0;
      
      // needs to be before pipeline update
      const material = mesh.material;
      const dynamic_layout = this.set_dynamic(material);
      
      const pipeline_cache = this.cache.get_pipeline(material, this.state, dynamic_layout);
      Keys.set_pipeline(entry, pipeline_cache.bid);
    }

    for (let i = 0, il = list.length; i < il; i++) {
      const entry = list[i], mesh = entry.mesh;

      const geometry_cache = this.cache.get_geometry(mesh.geometry);
      Keys.set_geometry(entry, mesh.geometry);
      Keys.set_buffer(entry, geometry_cache.buffer_bid);
    }

    Keys.sort(list);
  }

  preload(pass, mesh) {
    this.set_pass(pass);
    const dynamic_layout = this.set_dynamic(mesh.material);
    this.cache.get_pipeline(mesh.material, this.state, dynamic_layout);
    this.cache.get_geometry(mesh.geometry);
  }
}