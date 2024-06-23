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
      this.state.dynamic_id = this.dynamic.group;
      return this.dynamic.layout;
    } else {
      this.state.dynamic_id = undefined;
      return undefined;
    }
  }

  set_renderlist(list) { 
    for (let i = 0, il = list.length; i < il; i++) {
      const entry = list[i]; entry.key = 0;

      const mesh = entry.mesh, geometry = mesh.geometry;
      const geometry_cache = this.cache.get_geometry(geometry);
      Keys.set_buffer(entry, geometry_cache.buffer_bid);
      Keys.set_geometry(entry, geometry);
      Keys.set_dynamic(entry, mesh.dynamic);
    }

    // dispatch geometry buffer updates
    this.cache.buffer_manager.dispatch();

    for (let i = 0, il = list.length; i < il; i++) {
      const entry = list[i], mesh = entry.mesh;
      
      // needs to be before pipeline update
      const material = mesh.material, geometry = mesh.geometry;
      const dynamic_layout = this.set_dynamic(material);
      
      const pipeline_cache = this.cache.get_pipeline(material, this.state, geometry.get_layout(), dynamic_layout);
      Keys.set_pipeline(entry, pipeline_cache.bid);
    }

    // dispatch uniforms buffer updates
    this.cache.buffer_manager.dispatch();

    Keys.sort(list);
  }

  preload(pass, mesh) {
    this.set_pass(pass);
    const dynamic_layout = this.set_dynamic(mesh.material);
    const geometry_cache = this.cache.get_geometry(mesh.geometry);
    this.cache.get_pipeline(mesh.material, this.state, geometry_cache.layout, dynamic_layout);
  }
}