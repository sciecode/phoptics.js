import { PoolStorage } from "./storages/pool_storage.mjs";
import { CanvasTarget } from "./resources/canvas_target.mjs";
import { RenderPass } from "./resources/render_pass.mjs";
import { Shader } from "./resources/shader.mjs"

export class ResourceManager {
  constructor(device) {
    this.device = device;
    this.render_targets = new PoolStorage();
    this.render_passes = new PoolStorage();
    this.shaders = new PoolStorage();
  }
  
  create_render_pass(options) {
    const entry = new RenderPass(options);
    return this.render_passes.allocate(entry);
  }
  
  get_render_pass(idx) {
    return this.render_passes.get(idx);
  }
  
  destroy_render_pass(idx) {
    return this.render_passes.delete(idx);
  }
  
  create_canvas_target(options) {
    const entry = new CanvasTarget(this.device, options);
    return this.render_targets.allocate(entry);
  }

  get_render_target(idx) {
    return this.render_targets.get(idx);
  }
  
  destroy_render_target(idx) {
    return this.render_targets.delete(idx);
  }

  create_group_layout(options) {
    return this.device.createBindGroupLayout(options);
  }

  create_shader(options) {
    const entry = new Shader(this.device, options);
    return this.shaders.allocate(entry);
  }

  get_shader(idx) {
    return this.shaders.get(idx);
  }

  destroy_shader(idx) {
    return this.shaders.delete(idx);
  }
}