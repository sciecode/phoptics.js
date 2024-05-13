import { NULL_HANDLE } from "../backend/constants.mjs";
import { GPUBackend } from "../backend/gpu_backend.mjs";
import { DrawStream } from "./modules/draw_stream.mjs";
import { RenderState } from "./modules/render_state.mjs";
import { RenderCache } from "./modules/render_cache.mjs";
import { DynamicManager } from "./modules/dynamic_manager.mjs";
import Keys from "./modules/keys.mjs";

export class Engine {
  constructor(device) {
    this.backend = new GPUBackend(device);

    this.cache = new RenderCache(this.backend);
    this.dynamic = new DynamicManager(this.backend);
    
    this.state = new RenderState(this.cache, this.dynamic);
    this.draw_stream = new DrawStream();
  }

  render(pass, list) {
    this.dynamic.reset();
    this.draw_stream.clear();

    const global_bid = this.state.set_pass(pass);
    this.draw_stream.set_globals(global_bid);
    this.state.set_renderlist(list);
    
    // TODO: temporary while shader variant isn't implemented
    this.draw_stream.set_variant(0);

    const draw_info = {
      index: NULL_HANDLE,
      draw_count: NULL_HANDLE,
      vertex_offset: NULL_HANDLE,
      index_offset: NULL_HANDLE,
    };
    
    for (let i = 0, il = list.size; i < il; i++) {
      const info = list.indices[i];
      this.draw_stream.set_pipeline(Keys.get_pipeline(info));
      
      const mesh = list.entries[info.index].mesh, material = mesh.material;
      const material_bid = material.bindings ? this.cache.get_binding(material.bindings).bid : 0;
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
      draw_info.draw_count = geometry.draw.count;
      draw_info.index_offset = geometry.get_index_offset();
      draw_info.vertex_offset = geometry.get_vertex_offset();
      draw_info.index = geometry.index ? geometry.index.get_bid() : NULL_HANDLE;

      let attrib = 0;
      const attributes = geometry.attributes;
      for (const al = attributes.length; attrib < al; attrib++)
        this.draw_stream.set_attribute(attrib, attributes[attrib].get_bid());
      for (; attrib < 4; attrib++)
        this.draw_stream.set_attribute(attrib, NULL_HANDLE);

      this.draw_stream.draw(draw_info);
    }

    this.dynamic.commit();

    const target = pass.current_target, target_cache = this.cache.get_target(target);
    const descriptor = make_pass_descriptor(target, target_cache);
    this.backend.render(descriptor, this.draw_stream);
  }

  preload(pass, mesh) {
    this.state.preload(pass, mesh);
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