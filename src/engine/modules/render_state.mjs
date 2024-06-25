import Keys from "./keys.mjs";

export class RenderState {
  constructor(cache, dynamic) {
    this.cache = cache;
    this.dynamic = dynamic;

    this.state = {
      formats: null,
      multisampled: false,
      global_layout: undefined,
      material_layout: undefined,
      geometry_layout: undefined,
      dynamic_layout: undefined,
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

  set_layouts(mesh) {
    this.state.material_layout = this.cache.query_material_layout(mesh.material);
    this.state.geometry_layout = mesh.geometry.get_layout();
    this.state.dynamic_layout = mesh.dynamic ? this.dynamic.layout : undefined;
  }

  set_renderlist(list) { 
    for (let entry of list) {
      const mesh = entry.mesh, geometry = mesh.geometry;
      const geometry_cache = this.cache.get_geometry(geometry);

      entry.key = 0;
      Keys.set_buffer(entry, geometry_cache.buffer_bid);
      Keys.set_geometry(entry, geometry);
      Keys.set_dynamic(entry, mesh.dynamic);
    }
    
    // dispatch geometry buffer updates
    this.cache.buffer_manager.dispatch();
    
    for (let entry of list)
      this.cache.get_material_binding(entry.mesh.material);

    // dispatch uniforms buffer updates
    this.cache.buffer_manager.dispatch();

    for (let entry of list) {
      const mesh = entry.mesh, material = mesh.material;

      // needs to be before pipeline update
      this.set_layouts(mesh);
      const pipeline_cache = this.cache.get_pipeline(material, this.state);
      Keys.set_pipeline(entry, pipeline_cache.bid);
    }

    Keys.sort(list);
  }

  preload(pass, mesh) {
    this.set_pass(pass);
    this.cache.get_geometry(mesh.geometry);
    this.set_layouts(mesh);
    this.cache.get_pipeline(mesh.material, this.state);
  }
}