import { PoolStorage } from "../../common/pool_storage.mjs";
import { SparseSet } from "../../common/sparse_set.mjs";
import { UNINITIALIZED } from "../constants.mjs";

export class MaterialManager {
  constructor(backend) {
    this.backend = backend;
    this.layouts = new SparseSet();
    this.shaders = new SparseSet();
    this.pipelines = new SparseSet();
    this.materials = new PoolStorage();

    this.material_callback = this.free_material.bind(this);
    this.shader_callback = this.free_shader.bind(this);
  }

  get_shader(shader_obj) {
    let id = shader_obj.get_id();

    if (id == UNINITIALIZED) {
      const hash = JSON.stringify(shader_obj);
      if (id = this.shaders.has(hash)) {
        this.shaders.get(id).count++;
      } else {
        id = this.shaders.set(hash, { count: 1, hash: hash });
      }
      shader_obj.initialize(id, this.shader_callback);
    }

    return shader_obj;
  }

  free_shader(shader_id) {
    const cache = this.shaders.get(shader_id);
    if (!--cache.count) this.shaders.delete(shader_id, cache.key);
  }

  create_pipeline(info) {
    const hash = JSON.stringify({
      shader: this.get_shader(info.material.shader).get_id(),
      binding: info.binding,
      vertex: info.material.vertex,
      graphics: info.material.graphics,
      ...info.state,
      ...info.material.graphics,
    });

    let id = this.pipelines.has(hash);

    if (id) {
      this.pipelines.get(id).count++;
    } else {
      const pipeline = this.backend.resources.create_pipeline({
        shader: info.material.shader,
        graphics: {
          multisampled: info.state.multisampled,
          formats: info.state.formats,
          ...info.material.graphics,
        },
        layouts: {
          bindings: [
            this.get_layout(info.state.global_layout),
            undefined,
            info.binding ? this.get_layout(info.binding) : undefined,
          ],
          dynamic: info.dynamic_layout,
        },
        vertex: info.material.vertex,
      });
      id = this.pipelines.set(hash, { count: 1, bid: pipeline, hash: hash });
    }

    return id;
  }

  get_pipeline(pipeline_id) {
    return this.pipelines.get(pipeline_id).bid;
  }

  free_pipeline(pipeline_id) {
    const cache = this.pipelines.get(pipeline_id);
    if (!--cache.count) {
      this.backend.resources.destroy_pipeline(cache.bid);
      this.pipelines.delete(pipeline_id, cache.hash);
    }
  }

  create_material(info) {
    const pipeline_id = this.create_pipeline(info);
    const id = this.materials.allocate({
      version: info.material.get_version(),
      pipeline: pipeline_id,
    });
    info.material.initialize(id, this.material_callback);
    return id;
  }

  free_material(material_id) {
    const cache = this.materials.get(material_id);
    this.free_pipeline(cache.pipeline); 
    this.materials.delete(material_id);
  }

  get_material(material_id) {
    return this.materials.get(material_id);
  }

  create_layout(layout_info) {
    const hash = JSON.stringify(layout_info);
    let id, layout;
    if (id = this.layouts.has(hash)) {
      const cache = this.layouts.get(id);
      cache.count++;
      layout = cache.layout;
    } else {
      layout = this.backend.resources.create_group_layout(layout_info);
      id = this.layouts.set(hash, { count: 1, layout: layout, hash: hash });
    }
    return { id: id, layout: layout };
  }

  get_layout(layout_id) {
    return this.layouts.get(layout_id).layout;
  }

  free_layout(layout_id) {
    const cache = this.layouts.get(layout_id);
    if (!--cache.count) this.layouts.delete(layout_id, cache.hash);
  }
}