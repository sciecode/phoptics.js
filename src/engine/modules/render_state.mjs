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
    for (let entry of list)
      this.cache.get_geometry(entry.mesh.geometry);
    this.cache.buffer_manager.dispatch_indices();
    
    for (let entry of list)
      this.cache.get_attributes(entry.mesh.geometry.attributes);
    this.cache.buffer_manager.dispatch_attributes();
    
    for (let entry of list)
      this.cache.get_material_binding(entry.mesh.material);
    this.cache.buffer_manager.dispatch_uniforms();

    for (let entry of list) {
      const mesh = entry.mesh;
      const geometry = mesh.geometry, material = mesh.material;

      this.set_layouts(mesh);
      const pipeline_cache = this.cache.get_pipeline(material, this.state);

      entry.key = 0;
      Keys.set_attributes(entry, geometry.get_attributes());
      Keys.set_index(entry, geometry.index);
      Keys.set_dynamic(entry, mesh.dynamic); // TODO: should allocate dynamic earlier?
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