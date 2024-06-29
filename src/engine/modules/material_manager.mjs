import { PoolStorage } from "../../common/pool_storage.mjs";
import { SparseSet } from "../../common/sparse_set.mjs";
import { UNINITIALIZED } from "../constants.mjs";

export class MaterialManager {
  constructor(backend) {
    this.backend = backend;

    this.layouts = new SparseSet();
    this.pipeline_layouts = new SparseSet();

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
      id = this.shaders.has(hash);
      if (id !== undefined) {
        this.shaders.get(id).count++;
      } else {
        const bid = this.backend.resources.create_shader(shader_obj);
        id = this.shaders.set(hash, { bid: bid, count: 1, hash: hash });
      }
      shader_obj.initialize(id, this.shader_callback);
    }

    const cache = this.shaders.get(id);
    return cache.bid;
  }

  free_shader(shader_id) {
    const cache = this.shaders.get(shader_id);
    if (!--cache.count) {
      this.backend.resources.destroy_shader(cache.bid);
      this.shaders.delete(shader_id, cache.hash);
    }
  }

  get_pipeline_layout(desc) {
    const hash = JSON.stringify(desc);
    let id = this.pipeline_layouts.has(hash);
    if (id !== undefined) {
      this.pipeline_layouts.get(id).count++;
    } else {
      const bid = this.backend.resources.create_pipeline_layout(
        desc.map(e => (e !== undefined) ? this.get_layout(e) : undefined)
      );
      id = this.pipeline_layouts.set(hash, { bid: bid, count: 1, hash: hash });
    }

    const cache = this.pipeline_layouts.get(id);
    return { id: id, bid: cache.bid };
  }

  free_pipeline_layout(id) {
    const cache = this.pipeline_layouts.get(id);
    if (!--cache.count) {
      this.backend.resources.destroy_pipeline_layout(cache.bid);
      this.pipeline_layouts.delete(id, cache.hash);
    }
  }

  create_pipeline(info) {
    const shader_bid = this.get_shader(info.material.shader);
    const hash = JSON.stringify({
      shader: info.material.shader.get_id(),
      graphics: info.material.graphics,
      ...info.state,
    });

    let id = this.pipelines.has(hash);

    if (id !== undefined) {
      this.pipelines.get(id).count++;
    } else {
      const layout = this.get_pipeline_layout([
        info.state.global_layout, info.state.material_layout,
        info.state.dynamic_layout, info.state.geometry_layout
      ]);
      const pipeline = this.backend.resources.create_pipeline({
        shader: shader_bid,
        layouts: layout.bid,
        graphics: {
          multisampled: info.state.multisampled,
          formats: info.state.formats,
          ...info.material.graphics,
        },
      });

      id = this.pipelines.set(hash, { count: 1, bid: pipeline, hash: hash, layout: layout.id });
    }

    return id;
  }

  get_pipeline(pipeline_id) {
    return this.pipelines.get(pipeline_id);
  }

  free_pipeline(pipeline_id) {
    const cache = this.pipelines.get(pipeline_id);
    if (!--cache.count) {
      this.free_pipeline_layout(cache.layout);
      this.backend.resources.destroy_pipeline(cache.bid);
      this.pipelines.delete(pipeline_id, cache.hash);
    }
  }

  create_material(info) {
    const pipeline_id = this.create_pipeline(info);
    const cache = {
      version: info.material.get_version(),
      pipeline: pipeline_id,
    };
    const id = this.materials.allocate(cache);
    info.material.initialize(id, this.material_callback);
    return id;
  }

  update_material(info) {
    const cache = this.materials.get(info.material.get_id());
    this.free_pipeline(cache.pipeline);
    cache.version = info.material.get_version();
    cache.pipeline = this.create_pipeline(info);
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
    let id = this.layouts.has(hash), layout;
    if (id !== undefined) {
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