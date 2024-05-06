import { GPUResource } from "../../backend/constants.mjs";
import { ResourceType, TextureSourceType, UNINITIALIZED } from "../constants.mjs";
import { BufferManager } from "./buffer_manager.mjs";
import { SamplerTable } from "./sampler_table.mjs";
import { MaterialManager } from "./material_manager.mjs";
import { PoolStorage } from "../../common/pool_storage.mjs";
import { SparseSet } from "../../common/sparse_set.mjs";

export class RenderCache {
  constructor(backend) {
    this.backend = backend;
    this.buffer_manager = new BufferManager(backend);
    this.material_manager = new MaterialManager(backend);
    this.sampler_table = new SamplerTable(backend.device.features);

    this.buffers = new PoolStorage();
    this.bindings = new PoolStorage();
    this.textures = new PoolStorage();
    this.views = new PoolStorage();
    this.samplers = new SparseSet();

    this.texture_callback = this.free_texture.bind(this);
    this.bindings_callback = this.free_binding.bind(this);
    this.buffer_callback = this.free_buffer.bind(this);
  }

  get_target(target_obj) {
    const info = {
      color: target_obj.color.map( attach => this.get_view(attach.view).view ),
      depth: target_obj.depth ? this.get_view(target_obj.depth.view).view : undefined,
    };

    for (let attach of target_obj.color)
      if (attach.resolve) this.get_view(attach.resolve);

    return info;
  }

  get_view(view_obj) {
    if (view_obj.texture.type == ResourceType.CanvasTexture) {
      const canvas_texture = view_obj.texture;
      if (canvas_texture.get_version() == UNINITIALIZED) {
        canvas_texture.context.configure({
          device: this.backend.device,
          format: canvas_texture.format
        });
        canvas_texture.initialize(0);
      }
      return { view: canvas_texture.get_current_view() };
    }
  
    let id = view_obj.get_id(), cache;
    const cache_texture = this.get_texture(view_obj.texture);

    if (id == UNINITIALIZED) {
      cache = {
        view: this.backend.resources.get_texture(cache_texture.bid).get_view(view_obj.info),
        version: cache_texture.version,
      }
      id = this.views.allocate(cache);

      cache_texture.views.push(id);
      view_obj.initialize(id);
    } else {
      cache = this.views.get(id);
      if (cache.version != cache_texture.version) {
        cache.version = cache_texture.version;
        cache.view = this.backend.resources.get_texture(cache_texture.bid).get_view(view_obj.info);
      }
    }

    return cache;
  }

  get_sampler(sampler_obj) {
    let id = sampler_obj.get_id();

    if (id == UNINITIALIZED) {
      const hash = JSON.stringify(sampler_obj);
      id = this.samplers.has(hash);
      if (!id) {
        const bid = this.backend.resources.create_sampler({
          addressModeU: sampler_obj.address.u,
          addressModeV: sampler_obj.address.v,
          addressModeW: sampler_obj.address.w,
          magFilter: sampler_obj.filtering.mag,
          minFilter: sampler_obj.filtering.min,
          mipmapFilter: sampler_obj.filtering.mipmap,
        });
        id = this.samplers.set(hash, bid);
      }
    }

    return this.samplers.get(id);
  }

  get_material(material_obj, state, dynamic_layout) {
    let id = material_obj.get_id();

    if (id == UNINITIALIZED) {
      id = this.material_manager.create_material({
        material: material_obj,
        state: state,
        dynamic_layout: dynamic_layout,
        binding: material_obj.bindings ? this.get_binding(material_obj.bindings).layout : undefined
      });
    }

    const cache = this.material_manager.get_material(id);
    if (cache.version != material_obj.get_version()) {
      this.material_manager.update_material({
        material: material_obj,
        state: state,
        dynamic_layout: dynamic_layout,
        binding: material_obj.bindings ? this.get_binding(material_obj.bindings).layout : undefined
      });
    }

    return cache;
  }

  get_pipeline(id) {
    return this.material_manager.get_pipeline(id);
  }

  create_bind_group(binding_obj, layout, views) {
    return this.backend.resources.create_bind_group({
        layout: layout,
        entries: binding_obj.info.map( entry => {
          const resource = binding_obj[entry.name];
          switch (resource.type) {
            case ResourceType.StructuredBuffer:
              const buffer_info = this.get_buffer(resource);
              return {
                binding: entry.binding,
                type: GPUResource.BUFFER,
                offset: buffer_info.offset,
                size: buffer_info.size,
                resource: buffer_info.bid,
              };
            case ResourceType.TextureView:
              const view_info = this.get_view(resource);
              views.push(view_info.version);
              return {
                binding: entry.binding,
                type: GPUResource.TEXTURE,
                resource: view_info.view,
              };
            case ResourceType.Sampler:
              const sampler = this.get_sampler(resource);
              return {
                binding: entry.binding,
                type: GPUResource.SAMPLER,
                resource: sampler,
              };
          }
        })
      });
  }

  get_binding(binding_obj) {
    let id = binding_obj.get_id(), version = binding_obj.get_version();

    if (id == UNINITIALIZED) {
      const layout_cache = this.material_manager.create_layout({
        entries: binding_obj.info.map( entry => {
          const resource = {
            binding: entry.binding,
            visibility: entry.visibility || (GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT),
          };
          const binding = binding_obj[entry.name];
          switch (binding.type) {
            case ResourceType.StructuredBuffer: 
              resource.buffer = { type: "read-only-storage" };
              break;
            case ResourceType.TextureView:
              resource.texture = { sampleType: this.sampler_table.get_sample_type(binding.texture.format) };
              break;
            case ResourceType.Sampler:
              const filtering = binding.filtering;
              const filterable = filtering.min != "nearest" || filtering.mag != "nearest" || filtering.mipmap != "nearest";
              resource.sampler = { type: filterable ? "filtering" : "non-filtering" };
              break;
          }
          return resource;
        })
      });

      const views = [];
      const bid = this.create_bind_group(binding_obj, layout_cache.layout, views);

      const cache = {
        version: version,
        layout: layout_cache.id,
        views: views,
        info: { render: undefined, key: undefined, bid: bid },
      }

      id = this.bindings.allocate(cache);
      binding_obj.initialize(id, cache.info, this.bindings_callback);
    }

    let needs_update = false;
    const cache = this.bindings.get(id);
    if (cache.version != version) {
      needs_update = true;
      cache.version = version;
    } else {
      let view_id = 0;
      for (let i = 0, il = binding_obj.info.length; (i < il) && !needs_update; i++) {
        const resource = binding_obj[binding_obj.info[i].name];
        switch (resource.type) {
          case ResourceType.StructuredBuffer:
            this.get_buffer(resource);
            break;
          case ResourceType.TextureView:
            const version = this.get_view(resource).version;
            if (version != cache.views[view_id]) needs_update = true;
            view_id++;
            break;
        }
      }
    }

    if (needs_update) {
      const layout = this.material_manager.get_layout(cache.layout);
      this.backend.resources.destroy_bind_group(cache.info.bid);
      cache.views.length = 0;
      cache.info.bid = this.create_bind_group(binding_obj, layout, cache.views);
    }

    return cache;
  }

  free_binding(id) {
    const cache = this.bindings.get(id);
    this.material_manager.free_layout(cache.layout);
    this.backend.resources.destroy_bind_group(cache.info.bid);
    this.bindings.delete(id);
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
        }),
        views: [],
      });
      texture_obj.initialize(id, this.texture_callback);
    }

    const cache = this.textures.get(id);
    if (cache.version != version) {
      cache.version = version;
      this.backend.resources.update_texture(cache.bid, texture_obj.size);
    }

    if (texture_obj.upload.update_source) {
      const gpu_tex = this.backend.resources.get_texture(cache.bid).texture;
      for (let i = 0, il = texture_obj.upload.sources.length; i < il; i++) {
        const source = texture_obj.upload.sources[i];
        if (source.type == TextureSourceType.Image) {
          this.copy_image_texture(texture_obj, gpu_tex, source);
        } else if (source.type == TextureSourceType.Data) {
          this.copy_data_texture(texture_obj, gpu_tex, source);
        }
      }
      texture_obj.upload.update_source = false;
    }

    return cache;
  }

  free_texture(id) {
    const cache = this.textures.get(id);
    this.backend.resources.destroy_texture(cache.bid);
    for (let idx of cache.views) this.views.delete(idx);
    this.textures.delete(id);
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
        size: buffer_obj.total_bytes,
      });
      buffer_obj.initialize(id, this.buffer_callback);
    }

    const cache = this.buffers.get(id), version = buffer_obj.get_version();
    if (cache.version != version) {
      cache.version = version;
      // TODO: if we implement arraybuffer allocator, implement offset / size for front-end bufffer
      this.buffer_manager.update(cache.bid, cache.offset, buffer_obj.buffer);
    }

    return cache;
  }

  free_buffer(buffer_id) {
    const cache = this.buffers.get(buffer_id);
    this.buffer_manager.delete(cache.slot_id);
    this.buffers.delete(buffer_id);
  }

  copy_image_texture(texture_obj, gpu_tex, source) {
    const options = source.options, level = options.mip_level;
    const size = {
      width: options.size?.width || Math.max(1, texture_obj.size.width >> level),
      height: options.size?.height || Math.max(1, texture_obj.size.height >> level),
    };
    this.backend.device.queue.copyExternalImageToTexture(
      { source: options.source, flipY: options.flipY, origin: options.source_origin },
      { texture: gpu_tex, origin: options.target_origin, colorSpace: options.encoding,
        premultipliedAlpha: options.alpha, mipLevel: level },
        size
      );

    source.type = TextureSourceType.Null;
    source.options = null;
  }

  copy_data_texture(texture_obj, gpu_tex, source) {
    const options = source.options, level = options.mip_level;
    const size = {
      width: options.size?.width || Math.max(1, texture_obj.size.width >> level),
      height: options.size?.height || Math.max(1, texture_obj.size.height >> level),
    };
    this.backend.device.queue.writeTexture(
      { texture: gpu_tex, origin: options.target_origin, mipLevel: level },
      options.data,
      { offset: options.offset, bytesPerRow: options.bytes ? options.bytes * size.width : undefined },
      size
    );

    source.type = TextureSourceType.Null;
    source.options = null;
  }
}