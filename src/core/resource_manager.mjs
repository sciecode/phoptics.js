import { PoolStorage } from "./storages/pool_storage.mjs";
import { CanvasTarget } from "./resources/canvas_target.mjs";
import { RenderPass } from "./resources/render_pass.mjs";
import { Shader } from "./resources/shader.mjs"

export class ResourceManager {
  constructor(device) {
    this.device = device;
    this.canvas_targets = new PoolStorage(8);
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
    return this.canvas_targets.allocate(entry);
  }
  
  get_canvas_target(idx) {
    return this.canvas_targets.get(idx);
  }
  
  destroy_canvas_target(idx) {
    return this.canvas_targets.delete(idx);
  }

  create_shader(options) {
    const entry = new Shader(this.device, options);
    return this.shaders.allocate(entry);
  }

  get_shader(idx) {
    return this.shaders.get(idx);
  }
}