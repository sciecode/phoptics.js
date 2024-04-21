import { ResourceType } from "./constants.mjs";
import { NULL_HANDLE } from "../backend/constants.mjs";
import { GPUBackend } from "../backend/gpu_backend.mjs";
import { DrawStream } from "./modules/draw_stream.mjs";
import { RenderCache } from "./modules/render_cache.mjs";
import { DynamicManager } from "./modules/dynamic_manager.mjs";

export class Renderer {
  constructor(options = {}) {

    this.backend = new GPUBackend(options.device);
    this.features = options.features || [];

    this.cache = new RenderCache(this.backend);
    this.dynamic = new DynamicManager(this.backend);
    this.draw_stream = new DrawStream();

    this.state = {
      formats: null,
      multisampled: false,
      global_layout: undefined,
      dynamic_id: undefined,
    }
  }

  render(pass, scene) {
    const target = pass.current_target;
    const cached_target = this.cache.get_target(target);
    
    this.#set_pass(pass);

    this.dynamic.reset();
    this.draw_stream.clear();

    const global_group = this.cache.get_binding(pass.bindings).bid;
    this.draw_stream.set_globals(global_group);

    // TODO: create optimized render list - sort distance / frustum / reduce state changes 

    // TODO: temporary while shader variant isn't implemented
    this.draw_stream.set_variant(0);
    
    for (let mesh of scene) {
      const material = mesh.material, geometry = mesh.geometry;

      const dynamic_layout = this.#set_dynamic_binding(material);
      const pipeline = this.cache.get_pipeline(material, this.state, dynamic_layout);
      this.draw_stream.set_pipeline(pipeline);

      const material_group = material.bindings ? this.cache.get_binding(material.bindings).bid : 0;
      this.draw_stream.set_material(material_group);

      if (this.state.dynamic_id !== undefined) {
        const { group, offset } = this.dynamic.allocate(this.state.dynamic_id);
        this.draw_stream.set_dynamic(group);
        this.draw_stream.set_dynamic_offset(offset);
        this.dynamic.data.set(mesh.dynamic.data, offset);
      } else {
        this.draw_stream.set_dynamic(0);
      }

      const attrib_length = geometry.attributes.length;
      for (let i = 0, il = 4; i < il; i++) {
        this.draw_stream.set_attribute(i, i < attrib_length ? geometry.attributes[i] : NULL_HANDLE);
      }

      this.draw_stream.draw({
        index: geometry.index,
        draw_count: geometry.count,
        vertex_offset: geometry.vertex_offset,
        index_offset: geometry.index_offset,
      });
    }

    this.dynamic.commit();

    this.backend.render(make_pass_descriptor(target, cached_target.attachments), this.draw_stream);
  }

  #set_pass(pass) {
    this.state.formats = pass.formats;
    this.state.multisampled = pass.multisampled;
    this.state.global_layout = this.cache.get_binding(pass.bindings).layout;
  }

  #set_dynamic_binding(material) {
    if (material.dynamic) {
      this.state.dynamic_id = this.dynamic.get_id(material.dynamic);
      return this.dynamic.layout;
    } else {
      this.state.dynamic_id = undefined;
      return undefined;
    }
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

    return { device: await adapter.requestDevice(device_descriptor), features: device_descriptor.requiredFeatures };
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
  
  const attachments = target.attachments;

  for (let [idx, attachment] of attachments.color.entries()) {
    descriptor.colorAttachments.push({
      view: attachment.texture.type == ResourceType.CanvasTexture ? attachment.texture.get_view() : cache.color[idx].view,
      resolveTarget: attachment.resolve ? attachment.resolve.get_view() : undefined,
      clearValue: attachment.clear,
      loadOp: attachment.load,
      storeOp: attachment.store
    })
  }

  if (attachments.depth) {
    descriptor.depthStencilAttachment = {
      view: cache.depth.view,
      depthClearValue: attachments.depth.clear,
      depthLoadOp: attachments.depth.load,
      depthStoreOp: attachments.depth.store
    }
  }

  return descriptor;
}