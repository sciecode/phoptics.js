import { PoolStorage } from "../../common/pool_storage.mjs";
import { BufferManager } from "../buffer_manager.mjs";
import { ResourceType, UNINITIALIZED } from "../constants.mjs";

export class RenderCache {
  constructor(backend) {
    this.backend = backend;
    this.buffer_manager = new BufferManager(backend);
    this.targets = new PoolStorage();
    this.textures = new PoolStorage();
    this.buffers = new PoolStorage();
  }

  get_target(target_obj) {
    let id = target_obj.get_id();
    const version = target_obj.get_version();
    const attachs = target_obj.attachments;

    if (id == UNINITIALIZED) {
      id = this.targets.allocate({
        version: version,
        attachments: {
          color: attachs.color.map(_ => { return { version: -1, view: null } }),
          depth: attachs.depth ? { version: -1, view: null } : undefined,
        }
      });
      target_obj.initialize(id);
    }

    const cache = this.targets.get(id);
    if (cache.version != version) {
      cache.version = version;
      for (let color of attachs.color) {
        color.texture.set_size(target_obj.size);
        if (color.resolve) color.resolve.set_size(target_obj.size);
      }
      if (attachs.depth) attachs.depth.texture.set_size(target_obj.size);
    }

    for (let [idx, color] of attachs.color.entries()) {
      if (color.texture.type == ResourceType.CanvasTexture) {
        if (color.texture.get_version() == UNINITIALIZED) {
          color.texture.context.configure({
            device: this.backend.device,
            format: color.texture.format
          });
          color.texture.initialize(0);
        }
      } else {
        const cached_color = cache.attachments.color[idx];
        const cached_texture = this.get_texture(color.texture);
        if (cached_color.version != cached_texture.version) {
          cached_color.version = cached_texture.version;
          cached_color.view = this.backend.resources.get_texture(cached_texture.bid).get_view(color.view);
        }
        if (color.resolve && color.resolve.get_version() == UNINITIALIZED) {
          color.resolve.context.configure({
            device: this.backend.device,
            format: navigator.gpu.getPreferredCanvasFormat()
          });
          color.resolve.initialize(0);
        }
      }
    }

    if (attachs.depth) {
      const depth = attachs.depth;
      const cached_depth = cache.attachments.depth;
      const cached_texture = this.get_texture(depth.texture);
      if (cached_depth.version != cached_texture.version) {
        cached_depth.version = cached_texture.version;
        cached_depth.view = this.backend.resources.get_texture(cached_texture.bid).get_view(depth.view);
      }
    }

    return cache;
  }

  get_texture(texture_obj) {
    let id = texture_obj.get_id();
    const version = texture_obj.get_version();

    if (id == UNINITIALIZED) {
      id = this.textures.allocate({
        version: version,
        bid: this.backend.resources.create_texture({
          format: texture_obj.format,
          size: texture_obj.size,
          usage: texture_obj.usage,
          sampleCount: texture_obj.multisampled ? 4 : 1,
        })
      });
      texture_obj.initialize(id);
    }

    const cache = this.textures.get(id);
    if (cache.version != version) {
      cache.version = version;
      this.backend.resources.update_texture(cache.bid, texture_obj.size);
    }

    return cache;
  }

  get_buffer(buffer_obj) {
    let id = buffer_obj.get_id();

    if (id == UNINITIALIZED) {
      const { slot_id, offset, bid } = this.buffer_manager.create(buffer_obj.total_size);
      id = this.buffers.allocate({
        version: -1,
        slot_id: slot_id,
        bid: bid,
        offset: offset,
        size: buffer_obj.total_size,
      });
      buffer_obj.initialize(id);
    }

    const cache = this.buffers.get(id), version = buffer_obj.get_version();
    if (cache.version != version) {
      cache.version = version;
      // TODO: if we implement arraybuffer allocator, implement offset / size for front-end bufffer
      this.buffer_manager.update(cache.bid, cache.offset, buffer_obj.buffer);
    }

    return cache;
  }
}