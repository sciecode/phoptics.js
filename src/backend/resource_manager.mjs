import { PoolStorage } from "./storages/pool_storage.mjs";
import { CanvasTarget } from "./resources/canvas_target.mjs";
import { RenderPass } from "./resources/render_pass.mjs";
import { Shader } from "./resources/shader.mjs"
import { BindGroup } from "./resources/bind_group.mjs";

export class ResourceManager {
  constructor(device) {
    this.device = device;
    this.render_targets = new PoolStorage();
    this.render_passes = new PoolStorage();
    this.shaders = new PoolStorage();
    this.groups = new PoolStorage();
    this.buffers = new PoolStorage();
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

  create_bind_group(options) {
    const entry = new BindGroup(this.device, this, options);
    return this.groups.allocate(entry);
  }

  get_bind_group(idx) {
    return this.groups.get(idx);
  }

  destroy_bind_group(idx) {
    this.groups.delete(idx);
  }

  create_buffer(options) {
    const entry = this.device.createBuffer(options);
    return this.buffers.allocate(entry);
  }

  get_buffer(idx) {
    return this.buffers.get(idx);
  }

  destroy_buffer(idx) {
    this.buffers.get(idx).destroy();
    this.buffers.delete(idx);
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