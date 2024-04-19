import { PoolStorage } from "../../common/pool_storage.mjs";
import { UNINITIALIZED } from "../constants.mjs";

export class MaterialManager {
  constructor(backend) {
    this.backend = backend;
    this.layout_table = new Map();
    this.layouts = new PoolStorage();
    this.shaders_table = new Map();
    this.shaders = new PoolStorage();
    this.pipelines_table = new Map();
    this.pipelines = new PoolStorage();
    this.materials = new PoolStorage();
  }

  get_shader(shader_obj) {
    let id = shader_obj.get_id();

    if (id == UNINITIALIZED) {
      const hash = JSON.stringify(shader_obj);
      const cache = this.shaders_table.get(hash);
      if (cache) {
        id = cache.id;
        cache.count++;
      } else {
        id = this.shaders.allocate(shader_obj);
        this.shaders_table.set(hash, { count: 1, id: id });
      }
      shader_obj.initialize(id);
    }

    return shader_obj;
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

    let cache = this.pipelines_table.get(hash), id;

    if (cache) {
      id = cache.id;
      cache.count++;
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
          dynamic: info.dynamic.get_layout(info.state.dynamic_layout),
        },
        vertex: info.material.vertex,
      });
      id = this.pipelines.allocate(pipeline);
      this.pipelines_table.set(hash, { count: 1, id: id });
    }

    return id;
  }

  get_pipeline(pipeline_id) {
    return this.pipelines.get(pipeline_id);
  }

  create_material(info) {
    const pipeline_id = this.create_pipeline(info);
    const id = this.materials.allocate({
      version: info.material.get_version(),
      pipeline: pipeline_id,
    });
    info.material.initialize(id);
    return id;
  }

  get_material(material_id) {
    return this.materials.get(material_id);
  }

  create_layout(layout_info) {
    const hash = JSON.stringify(layout_info);
    let layout_id, layout, cache;
    if (cache = this.layout_table.get(hash)) {
      cache.count++;
      layout_id = cache.id;
      layout = this.layouts[layout_id];
    } else {
      layout = this.backend.resources.create_group_layout(layout_info);
      layout_id = this.layouts.allocate(layout);
      this.layout_table.set(hash, { count: 1, id: layout_id });
    }
    return { id: layout_id, layout: layout };
  }

  get_layout(layout_id) {
    return this.layouts.get(layout_id);
  }
}