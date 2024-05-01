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

  render(pass, scene) {
    this.dynamic.reset();
    this.draw_stream.clear();
    this.#prepare_queue(pass, scene);

    this.draw_stream.set_globals(this.render_queue.pass);

    // TODO: temporary while shader variant isn't implemented
    this.draw_stream.set_variant(0);
    
    for (let { index } of this.render_queue.indices) {
      const draw = this.render_queue.draws[index];
      this.draw_stream.set_pipeline(draw.pipeline_bid);
      this.draw_stream.set_material(draw.material_bid);

      const geometry = draw.geometry;
      const attrib_length = geometry.attributes.length;
      for (let i = 0, il = 4; i < il; i++)
        this.draw_stream.set_attribute(i, i < attrib_length ? geometry.attributes[i] : NULL_HANDLE);

      if (draw.dynamic_id !== undefined) {
        const { group, offset } = this.dynamic.allocate(draw.dynamic_id);
        this.draw_stream.set_dynamic(group);
        this.draw_stream.set_dynamic_offset(offset);
        this.dynamic.data.set(draw.dynamic.data, offset);
      } else {
        this.draw_stream.set_dynamic(0);
      }

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

  #prepare_queue(pass, scene) {
    this.render_queue.reset(scene.length);
    this.render_queue.set_pass(pass);

    for (let i = 0, il = scene.length; i < il; i++)
      this.render_queue.push(i, scene[i]);

    this.render_queue.sort();
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