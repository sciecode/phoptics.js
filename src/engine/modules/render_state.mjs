import Keys from "./keys.mjs";
import { DynamicManager } from "./dynamic_manager.mjs";
import { UNINITIALIZED } from "../constants.mjs";

export class RenderState {
  constructor(cache, backend) {
    this.cache = cache;
    this.dynamic = new DynamicManager(backend, cache);

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
    this.state.dynamic_layout = mesh.dynamic ? this.dynamic.layout_id : undefined;
  }

  set_renderlist(list) {
    for (let entry of list)
      this.cache.get_index(entry.mesh.geometry.index);
    this.cache.buffer_manager.dispatch_indices();

    for (let entry of list) {
      if (entry.mesh.geometry.attributes.get_bid() == UNINITIALIZED)
        entry.mesh.material.update();
      this.cache.get_attributes(entry.mesh.geometry.attributes);
    }
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
      Keys.set_dynamic(entry, mesh.dynamic);
      Keys.set_pipeline(entry, pipeline_cache.bid);
    }

    Keys.sort(list);

    for (let entry of list)
      if (entry.mesh.dynamic) this.dynamic.allocate(entry.mesh);
    this.dynamic.commit();
  }

  preload(pass, mesh) {
    this.set_pass(pass);
    this.cache.get_index(mesh.geometry.index);
    if (mesh.geometry.attributes.get_bid() == UNINITIALIZED)
      mesh.material.update();
    this.cache.get_attributes(mesh.geometry.attributes);
    this.cache.get_material_binding(mesh.material);
    this.set_layouts(mesh);
    this.cache.get_pipeline(mesh.material, this.state);
  }
}