import { UNINITIALIZED } from "../constants.mjs";

const key_bits = (n) => (32 - Math.clz32(Number(n)));

export class RenderState {
  constructor(cache, dynamic) {
    this.RENDER_ID = 0;

    this.cache = cache;
    this.dynamic = dynamic;
    this.keys_info = { pipelines: 0n, material_groups: 1n };

    this.state = {
      formats: null,
      multisampled: false,
      global_layout: undefined,
      dynamic_id: undefined,
    };
  }

  reset(queue) {
    this.RENDER_ID = (this.RENDER_ID + 1) & UNINITIALIZED;
    
    this.keys_info.pipelines = 0n;
    this.keys_info.material_groups = 1n;

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
      return global_cache.info.bid;
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
      const index = queue.indices[i].index;
      const mesh = queue.meshes[index], material = mesh.material;

      // update dynamic information (needs to be before material)
      const dynamic_layout = this.set_dynamic(material);

      // update material information
      if (material.get_render_id() != this.RENDER_ID) {
        const material_cache = this.cache.get_material(material, this.state, dynamic_layout);
        const pipeline_cache = this.cache.get_pipeline(material_cache.pipeline);
        material_cache.info.bid = pipeline_cache.bid;

        if (pipeline_cache.info.render != this.RENDER_ID) {
          material_cache.info.key = pipeline_cache.info.key = ++this.keys_info.pipelines;
          material_cache.info.render = pipeline_cache.info.render = this.RENDER_ID;
        } else {
          material_cache.info.key = pipeline_cache.info.key;
          material_cache.info.render = pipeline_cache.info.render;
        }

        if (material.bindings) {
          const group_cache = this.cache.get_binding(material.bindings);
          if (group_cache.info.render != this.RENDER_ID) {
            group_cache.info.key = ++this.keys_info.material_groups;
            group_cache.info.render = this.RENDER_ID;
          }
        }
      }
    }

    const pipeline_bits = BigInt(key_bits(this.keys_info.pipelines));
    const group_bits = BigInt(key_bits(this.keys_info.material_groups));
    
    for (let i = 0, il = queue.size; i < il; i++) {
      const index = queue.indices[i].index;
      const material = queue.meshes[index].material;
      const group_key = material.bindings? material.bindings.get_key() : 0n;

      let key = 0n, bits = 0n;
      key |= group_key << bits; bits += group_bits;
      key |= material.get_key() << bits; bits += pipeline_bits;
      queue.indices[i].key = key;
    }

    queue.indices.sort( render_list_compare ); // TODO: use adaptive MSB Hybrid-Sort 64b
  }

  load_material(pass, material) {
    const dynamic_layout = this.set_dynamic(material);
    this.set_pass(pass);
    this.cache.get_material(material, this.state, dynamic_layout);
  }
}

const render_list_compare = (a,b) => (a.key < b.key) ? -1 : ((a.key > b.key) ? 1 : 0);