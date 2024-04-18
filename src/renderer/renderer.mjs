import { GPUBackend } from "../backend/gpu_backend.mjs"
import { DrawStream } from "./modules/draw_stream.mjs";
import { RenderCache } from "./modules/render_cache.mjs";
import { DynamicBindings } from "./modules/dynamic_bindings.mjs";
import { ResourceType } from "./constants.mjs";

export class Renderer {
  constructor(device) {
    this.backend = new GPUBackend(device);
    this.cache = new RenderCache(this.backend);
    this.dynamic = new DynamicBindings(this.backend);
    this.draw_stream = new DrawStream();
    this.state = {
      formats: null,
      multisampled: false,
      global_layout: undefined,
      dynamic_layout: undefined,
    }
  }

  render(pass, dynamic) {
    this.#set_pass(pass);
    this.#set_dynamic_binding(dynamic);

    const target = pass.current_target;
    const cached_target = this.cache.get_target(target);

    this.backend.render(make_pass_descriptor(target, cached_target.attachments), this.draw_stream);
  }

  #set_pass(pass) {
    this.state.formats = pass.formats;
    this.state.multisampled = pass.multisampled;
    this.state.global_layout = this.cache.get_binding(pass.bindings).layout;
  }

  #set_dynamic_binding(dynamic_info) {
    this.state.dynamic_layout = this.dynamic.get_layout(dynamic_info);
  }
}

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