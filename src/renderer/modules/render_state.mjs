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

  reset(queue) {
    const size = queue.size, max = queue.indices.length;

    if (size >= max) {
      for (let i = max, il = size; i < il; i++)
        queue.indices.push({ key: 0n, index: i })
    } else {
      let upper = 0, diff = max - size;
      for (let i = 0, il = size; i < il && upper != diff; i++) {
        const current = queue.indices[i];
        while (current.index >= size) current.index = queue.indices[max - upper++];
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

  set_queue(queue) { 
    this.reset(queue);

    for (let i = 0, il = queue.size; i < il; i++) {
      const entry = queue.indices[i], index = entry.index;
      const mesh = queue.meshes[index], material = mesh.material;

      // (needs to be before material)
      const dynamic_layout = this.set_dynamic(material);

      const material_cache = this.cache.get_material(material, this.state, dynamic_layout);
      const pipeline_cache = this.cache.get_pipeline(material_cache.pipeline);
      entry.key = BigInt(pipeline_cache.bid);
    }

    queue.indices.sort(render_list_compare); // TODO: use adaptive MSB Hybrid-Sort 64b
  }

  load_material(pass, material) {
    const dynamic_layout = this.set_dynamic(material);
    this.set_pass(pass);
    this.cache.get_material(material, this.state, dynamic_layout);
  }
}

const render_list_compare = (a,b) => (a.key < b.key) ? -1 : ((a.key > b.key) ? 1 : 0);