import { NULL_HANDLE } from "../backend/constants.mjs";
import { GPUBackend } from "../backend/gpu_backend.mjs";
import { DrawStream } from "./modules/draw_stream.mjs";
import { RenderState } from "./modules/render_state.mjs";
import { RenderCache } from "./modules/render_cache.mjs";
import { DynamicManager } from "./modules/dynamic_manager.mjs";

export class Renderer {
  constructor(device) {
    this.backend = new GPUBackend(device);
    this.cache = new RenderCache(this.backend);
    this.dynamic = new DynamicManager(this.backend);
    this.state = new RenderState(this.cache, this.dynamic);
    this.draw_stream = new DrawStream();
  }

  render(pass, queue) {
    this.dynamic.reset();
    this.draw_stream.clear();

    const global_bid = this.state.set_pass(pass);
    this.state.set_queue(queue);
    
    this.draw_stream.set_globals(global_bid);
    
    // TODO: temporary while shader variant isn't implemented
    this.draw_stream.set_variant(0);

    const draw_info = {
      index: -1,
      draw_count: -1,
      vertex_offset: -1,
      index_offset: -1,
    };
    
    for (let i = 0, il = queue.size; i < il; i++) {
      const mesh = queue.meshes[queue.indices[i].index], material = mesh.material;

      this.draw_stream.set_pipeline(material.get_pipeline());

      const material_bid = material.bindings ? material.bindings.get_group() : 0;
      this.draw_stream.set_material(material_bid);

      if (material.dynamic !== undefined) {
        const dynamic_id = material.dynamic.get_id();
        const { group, offset } = this.dynamic.allocate(dynamic_id);
        this.draw_stream.set_dynamic(group);
        this.draw_stream.set_dynamic_offset(offset);
        this.dynamic.data.set(mesh.dynamic.data, offset);
      } else {
        this.draw_stream.set_dynamic(0);
      }

      const geometry = mesh.geometry;
      draw_info.draw_count = geometry.count;

      const attributes = geometry.attributes;
      if (attributes.length != 1) {
        draw_info.vertex_offset = 0; // TODO: impl geometry draw range

        if (geometry.index) {
          const index_cache = this.cache.get_index(geometry.index, false);
          draw_info.index = index_cache.bid;
          draw_info.index_offset = index_cache.offset;
        } else {
          draw_info.index = NULL_HANDLE;
          draw_info.index_offset = NULL_HANDLE;
        }

        for (let i = 0, il = 4; i < il; i++) {
          if (i < attributes.length) {
            const attrib_cache = this.cache.get_attribute(attributes[i]);
            this.draw_stream.set_attribute(i, attrib_cache.attrib_bid);
          } else {
            this.draw_stream.set_attribute(i, NULL_HANDLE);
          }
        }
      } else {
        if (geometry.index) {
          const index_cache = this.cache.get_index(geometry.index, true);
          draw_info.index = index_cache.bid;
          draw_info.index_offset = index_cache.offset;
        } else {
          draw_info.index = NULL_HANDLE;
          draw_info.index_offset = NULL_HANDLE;
        }

        const attrib_cache = this.cache.get_interleaved(attributes[i]);
        this.draw_stream.set_attribute(0, attrib_cache.attrib_bid);
        draw_info.vertex_offset = attrib_cache.vertex_offset; // TODO: impl geometry draw range

        for (let i = 1, il = 4; i < il; i++) {
          this.draw_stream.set_attribute(i, NULL_HANDLE);
        }
      }

      this.draw_stream.draw(draw_info);
    }

    this.dynamic.commit();

    const target = pass.current_target;
    const descriptor = make_pass_descriptor(target, this.cache.get_target(target));
    this.backend.render(descriptor, this.draw_stream);
  }

  precompile(pass, material) {
    this.state.load_material(pass, material);
  }

  static async acquire_device(options = {}) {
    options.powerPreference ||= "high-performance";
    const adapter = await navigator.gpu.requestAdapter(options);
    
    const device_descriptor = {
      requiredFeatures: [],
    };

    for (let feat of FEATURE_LIST)
      if (adapter.features.has(feat))
        device_descriptor.requiredFeatures.push(feat);

    return await adapter.requestDevice(device_descriptor);
  }
}

const FEATURE_LIST = [
  "float32-filterable",
  "texture-compression-bc",
  "texture-compression-astc",
  "texture-compression-etc2",
  "shader-f16",
]

const make_pass_descriptor = (target, cache) => {
  const descriptor = {
    colorAttachments: [],
    depth: null,
  };
  
  for (let [idx, attach] of target.color.entries()) {
    descriptor.colorAttachments.push({
      view: cache.color[idx],
      resolveTarget: attach.resolve ? attach.resolve.texture.get_current_view() : undefined,
      clearValue: attach.clear,
      loadOp: attach.load,
      storeOp: attach.store
    })
  }

  if (target.depth) {
    descriptor.depthStencilAttachment = {
      view: cache.depth,
      depthClearValue: target.depth.clear,
      depthLoadOp: target.depth.load,
      depthStoreOp: target.depth.store
    }
  }

  return descriptor;
}