import { GPUResource } from "../../backend/constants.mjs";
import { ResourceType, UNINITIALIZED } from "../constants.mjs";
import { BufferManager } from "./buffer_manager.mjs";
import { SamplerTable } from "./sampler_table.mjs";
import { MaterialManager } from "./material_manager.mjs";
import { SparseArray } from "../../common/sparse_array.mjs";
import { SparseSet } from "../../common/sparse_set.mjs";
import { Format } from "../../common/constants.mjs";

export class RenderCache {
  constructor(backend) {
    this.backend = backend;

    this.material_manager = new MaterialManager(backend);
    this.buffer_manager = new BufferManager(backend, this.material_manager);

    this.samplers = new SparseSet();
    this.sampler_table = new SamplerTable(backend.device.features);

    this.views = new SparseArray();
    this.bindings = new SparseArray();
    this.textures = new SparseArray();

    this.texture_callback = this.free_texture.bind(this);
    this.bindings_callback = this.free_binding.bind(this);
    this.texture_view_callback = this.free_texture_view.bind(this);
  }

  get_target(target_obj) {
    const info = {
      color: target_obj.color.map(attach => this.get_view(attach.view).view),
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
          format: Format.internal(canvas_texture.format)
        });
        canvas_texture.initialize(0);
      }
      return;
    }

    let id = view_obj.get_id(), cache;
    const cache_texture = this.get_texture(view_obj.texture);

    if (id == UNINITIALIZED) {
      cache = {
        tex: view_obj.texture.get_id(),
        view: this.backend.resources.get_texture(cache_texture.bid).get_view(view_obj.info),
        version: cache_texture.version,
      };
      id = this.views.allocate(cache);

      cache_texture.views.push(id);
      view_obj.initialize(id, this.texture_view_callback);
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
          mipmapFilter: sampler_obj.filtering.mip,
        });
        id = this.samplers.set(hash, { bid });
      }
    }

    return this.samplers.get(id).bid;
  }

  get_index(index_obj) {
    if (!index_obj) return;
    this.buffer_manager.get_index(index_obj);
  }

  get_attributes(attrib_obj) {
    this.buffer_manager.get_attributes(attrib_obj);
  }

  get_material_binding(material_obj) {
    if (material_obj.bindings) {
      const cache = this.get_binding(material_obj.bindings);
      if (material_obj.get_binding() != cache.bid) material_obj.set_binding(cache.bid);
    }
  }

  query_material_layout(material_obj) {
    return material_obj.bindings ? this.bindings.get(material_obj.bindings.get_id()).layout : undefined;
  }

  get_pipeline(material_obj, state) {
    let id = material_obj.get_id();

    if (id == UNINITIALIZED) {
      id = this.material_manager.create_material({
        material: material_obj,
        state: state,
      });
    }

    const cache = this.material_manager.get_material(id);
    if (cache.version != material_obj.get_version()) {
      this.material_manager.update_material({
        material: material_obj,
        state: state,
      });
    }

    return this.material_manager.get_pipeline(cache.pipeline);
  }

  create_bind_group(binding_obj, layout, views) {
    return this.backend.resources.create_bind_group({
      layout: layout,
      entries: binding_obj.info.map((entry, idx) => {
        const resource = binding_obj[entry.name];
        switch (resource.type) {
          case ResourceType.StructuredBuffer:
            const buffer_info = this.buffer_manager.get_uniform(resource);
            return {
              binding: idx,
              type: GPUResource.BUFFER,
              offset: buffer_info.offset,
              size: buffer_info.size,
              resource: buffer_info.bid,
            };
          case ResourceType.TextureView:
            const view_info = this.get_view(resource);
            views.push(view_info.version);
            return {
              binding: idx,
              type: GPUResource.TEXTURE,
              resource: view_info.view,
            };
          case ResourceType.Sampler:
            const sampler = this.get_sampler(resource);
            return {
              binding: idx,
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
        entries: binding_obj.info.map((entry, idx) => {
          const resource = {
            binding: idx,
            visibility: entry.visibility || (GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT),
          };
          const binding = binding_obj[entry.name];
          switch (binding.type) {
            case ResourceType.StructuredBuffer:
              resource.buffer = { type: "read-only-storage" };
              break;
            case ResourceType.TextureView:
              resource.texture = {
                sampleType: this.sampler_table.get_sample_type(binding.texture.format),
                viewDimension: binding.info?.dimension || "2d",
              };
              break;
            case ResourceType.Sampler:
              const filtering = binding.filtering;
              const filterable = filtering.min != "nearest" || filtering.mag != "nearest" || filtering.mip != "nearest";
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
        bid: bid,
      };

      id = this.bindings.allocate(cache);
      binding_obj.initialize(id, this.bindings_callback);
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
            this.buffer_manager.get_uniform(resource);
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
      this.backend.resources.destroy_bind_group(cache.bid);
      cache.views.length = 0;
      cache.bid = this.create_bind_group(binding_obj, layout, cache.views);
    }

    return cache;
  }

  free_binding(id) {
    const cache = this.bindings.get(id);
    this.material_manager.free_layout(cache.layout);
    this.backend.resources.destroy_bind_group(cache.bid);
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
          samples: texture_obj.multisampled ? 4 : 1,
          mip_levels: texture_obj.mip_levels,
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

    return cache;
  }

  free_texture(id) {
    const cache = this.textures.get(id);
    this.backend.resources.destroy_texture(cache.bid);
    for (let idx of cache.views) this.views.delete(idx);
    this.textures.delete(id);
  }

  free_texture_view(id) {
    const cache = this.views.get(id);
    this.views.delete(id);
    // this sucks, please think of a better way to do it
    const tex_cache = this.textures.get(cache.tex);
    const idx = tex_cache.views.findIndex(e => e == id);
    tex_cache.views.splice(idx, 1);
  }
}