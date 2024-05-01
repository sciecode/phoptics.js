import { UNINITIALIZED } from "../constants.mjs";

const key_bits = (n) => (32 - Math.clz32(Number(n)));

export class RenderQueue {
  constructor(cache, dynamic) {
    this.RENDER_ID = 0;

    this.cache = cache;
    this.dynamic = dynamic;

    this.indices = [];
    this.draws = [];

    this.keys_info = {
      pipelines: 0n,
      materials: -1n,
    };

    this.state = {
      formats: null,
      multisampled: false,
      global_layout: undefined,
      dynamic_id: undefined,
    };

    this.pass = undefined;
  }

  reset(count) {
    this.RENDER_ID = (this.RENDER_ID + 1) & UNINITIALIZED;
    
    this.keys_info.pipelines = 0n;
    this.keys_info.materials = 1n;
    
    this.indices.length = count;
    this.draws.length = count;
  }

  set_pass(pass) {
    this.state.formats = pass.formats;
    this.state.multisampled = pass.multisampled;

    if (pass.bindings) {
      const global_cache = this.cache.get_binding(pass.bindings);
      this.state.global_layout = global_cache.layout;
      this.pass = global_cache.bid;
    } else {
      this.state.global_layout = undefined;
      this.pass = 0;
    }
  }

  set_dynamic(material) {
    if (material.dynamic) {
      this.state.dynamic_id = this.dynamic.get_id(material.dynamic);
      return this.dynamic.layout;
    } else {
      this.state.dynamic_id = undefined;
      return undefined;
    }
  }

  push(i, mesh) {
    const draw_info = this.draws[i] || {};

    const material = mesh.material;
    draw_info.geometry = mesh.geometry;

    const dynamic_layout = this.set_dynamic(material);
    const pipeline_cache = this.cache.get_pipeline(material, this.state, dynamic_layout);
    if (pipeline_cache.render_id == this.RENDER_ID) {
      draw_info.pipeline_key = pipeline_cache.render_key;
    } else {
      draw_info.pipeline_key = pipeline_cache.render_key = ++this.keys_info.pipelines;
      pipeline_cache.render_id = this.RENDER_ID;
    }
    draw_info.pipeline_bid = pipeline_cache.bid;

    if (material.bindings) {
      const material_cache = this.cache.get_binding(material.bindings);
      if (material_cache.render_id == this.RENDER_ID) {
        draw_info.material_key = material_cache.render_key;
      } else {
        draw_info.material_key = material_cache.render_key = ++this.keys_info.materials;
        material_cache.render_id = this.RENDER_ID;
      }
      draw_info.material_bid = material_cache.bid;
    } else {
      draw_info.material_bid = 0;
      draw_info.material_key = 0n;
    }

    draw_info.dynamic = mesh.dynamic;
    draw_info.dynamic_id = this.state.dynamic_id;

    this.draws[i] = draw_info;
  }

  sort() {
    const pipeline_bits = BigInt(key_bits(this.keys_info.pipelines));
    const material_bits = BigInt(key_bits(this.keys_info.materials));
    
    for (let i = 0, il = this.draws.length; i < il; i++) {
      let key = 0n, bits = 0n, draw = this.draws[i];
      key |= draw.material_key << bits; bits += material_bits;
      key |= draw.pipeline_key << bits; bits += pipeline_bits;
      this.indices[i] = { key: key, index: i };
    }

    this.indices.sort( render_list_compare ); // TODO: use adaptive MSB Hybrid-Sort 64b
  }
}

const render_list_compare = (a,b) => (a.key < b.key) ? -1 : ((a.key > b.key) ? 1 : 0);