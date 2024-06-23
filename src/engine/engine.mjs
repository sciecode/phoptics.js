import { NULL_HANDLE } from "../backend/constants.mjs";
import { GPUBackend } from "../backend/gpu_backend.mjs";
import { DrawStream } from "./modules/draw_stream.mjs";
import { RenderState } from "./modules/render_state.mjs";
import { RenderCache } from "./modules/render_cache.mjs";
import { DynamicManager } from "./modules/dynamic_manager.mjs";
import { Format } from "../common/constants.mjs";
import Keys from "./modules/keys.mjs";

export class Engine {
  constructor(device) {
    this.backend = new GPUBackend(device);

    this.features = {};
    for (let feat of device.features.keys())
      this.features[feat] = true;

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
    
    const draw_info = {
      index: NULL_HANDLE,
      draw_count: NULL_HANDLE,
      instance_count: NULL_HANDLE,
      vertex_offset: NULL_HANDLE,
      index_offset: NULL_HANDLE,
      instance_offset: NULL_HANDLE,
    };
    
    for (let i = 0, il = list.length; i < il; i++) {
      const entry = list[i];
      this.draw_stream.set_pipeline(Keys.get_pipeline(entry));
      
      const mesh = entry.mesh, material = mesh.material;
      this.draw_stream.set_material(material.get_binding());

      if (material.dynamic !== undefined) {
        this.draw_stream.set_dynamic(this.dynamic.allocate(mesh));
      } else {
        this.draw_stream.set_dynamic(0);
      }

      const geometry = mesh.geometry;
      this.draw_stream.set_geometry(geometry.get_vertices());

      draw_info.index = geometry.index?.get_bid() || NULL_HANDLE;
      draw_info.draw_count = geometry.draw.count;
      draw_info.index_offset = geometry.get_index_offset();
      draw_info.vertex_offset = geometry.get_vertex_offset();
      draw_info.instance_count = geometry.draw.instance_count;
      draw_info.instance_offset = geometry.draw.instance_offset;

      this.draw_stream.draw(draw_info);
    }

    this.dynamic.commit();

    const target = pass.current_target, target_cache = this.cache.get_target(target);
    const descriptor = make_pass_descriptor(target, target_cache);
    this.backend.render(descriptor, this.draw_stream);
  }

  preload(pass, mesh) { this.state.preload(pass, mesh); }

  upload_texture(texture_obj, source, options = {}) {
    const bid = this.cache.get_texture(texture_obj).bid;
    if (ArrayBuffer.isView(source) || source instanceof ArrayBuffer) {
      options.data = source;
      this.backend.upload_texture_data(bid, options);
    } else {
      options.image = source;
      this.backend.upload_texture_image(bid, options);
    }
  }

  async read_texture(texture_obj, dst, options = {}) {
    const level = options.mip_level;
    const size = {
      width: options.size?.width || Math.max(1, texture_obj.size.width >> level),
      height: options.size?.height || Math.max(1, texture_obj.size.height >> level),
    };

    options.size = size;
    const bid = this.cache.get_texture(texture_obj).bid;
    const resource = this.backend.resources.get_texture(bid);
    options.bytes_row = Math.ceil(resource.stride * size.width / 256) * 256;
    
    const buf_bid = this.backend.resources.create_buffer({
      size: options.bytes_row * options.size.height,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });

    options.dst = buf_bid;

    const buffer = this.backend.read_texture(resource.texture, options);
    return buffer.mapAsync(GPUMapMode.READ).then( _ => {
      const data = new dst.constructor(buffer.getMappedRange());

      const elements = resource.stride / dst.BYTES_PER_ELEMENT;
      const dst_row = size.width * elements;
      const data_row = options.bytes_row / dst.BYTES_PER_ELEMENT;
      for (let y = 0; y < size.height; y++) {
        for (let x = 0; x < size.height; x++) {
          for (let v = 0; v < elements; v++) {
            const offset = x * elements + v;
            const dst_id = y * dst_row + offset;
            const data_id = y * data_row + offset;
            dst[dst_id] = data[data_id]
          } 
        }
      }
      this.backend.resources.destroy_buffer(buf_bid);
    });
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

  static canvas_format() {
    return (navigator.gpu.getPreferredCanvasFormat() == "rgba8unorm") ? Format.RGBA8_UNORM : Format.BGRA8_UNORM;
  }
}

const FEATURE_LIST = [
  "float32-filterable",
  "texture-compression-bc",
  "texture-compression-astc",
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