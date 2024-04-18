import { PoolStorage } from "../../common/pool_storage.mjs";

export class MaterialManager {
  constructor(backend) {
    this.backend = backend;
    this.layout_table = new Map();
    this.layouts = new PoolStorage();
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