import { NULL_HANDLE } from "../backend/constants.mjs";
import { GPUBackend } from "../backend/gpu_backend.mjs";
import { DrawStream } from "./modules/draw_stream.mjs";
import { RenderQueue } from "./modules/render_queue.mjs";
import { RenderCache } from "./modules/render_cache.mjs";
import { DynamicManager } from "./modules/dynamic_manager.mjs";

export class Renderer {
  constructor(device) {
    this.backend = new GPUBackend(device);
    this.cache = new RenderCache(this.backend);
    this.dynamic = new DynamicManager(this.backend);
    this.render_queue = new RenderQueue(this.cache, this.dynamic);
    this.draw_stream = new DrawStream();
  }

  render(pass, renderlist) {
    this.dynamic.reset();
    this.draw_stream.clear();
    this.#prepare_queue(pass, renderlist);

    // TODO: temporary while shader variant isn't implemented
    this.draw_stream.set_variant(0);
    
    for (let { index } of this.render_queue.indices) {
      const mesh = renderlist[index];

      const material = mesh.material;
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
      const attrib_length = geometry.attributes.length;
      for (let i = 0, il = 4; i < il; i++)
        this.draw_stream.set_attribute(i, i < attrib_length ? geometry.attributes[i] : NULL_HANDLE);

      this.draw_stream.draw({
        index: geometry.index,
        draw_count: geometry.count,
        vertex_offset: geometry.vertex_offset,
        index_offset: geometry.index_offset,
      });
    }

    this.dynamic.commit();

    const target = pass.current_target;
    const descriptor = make_pass_descriptor(target, this.cache.get_target(target));
    this.backend.render(descriptor, this.draw_stream);
  }

  precompile(pass, material) {
    this.render_queue.load_material(pass, material);
  }

  #prepare_queue(pass, renderlist) {
    const global_bid = this.render_queue.set_pass(pass);
    this.draw_stream.set_globals(global_bid);

    this.render_queue.set_renderlist(renderlist);
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