import { PoolStorage } from "./storages/pool_storage.mjs";
import { RenderTarget } from "./resources/render_target.mjs";
import { CanvasTexture } from "./resources/canvas_texture.mjs";
import { Texture } from "./resources/texture.mjs";
import { Shader } from "./resources/shader.mjs"
import { BindGroup } from "./resources/bind_group.mjs";
import { Attribute } from "./resources/attribute.mjs";

export class ResourceManager {
  constructor(device) {
    this.device = device;
    this.render_targets = new PoolStorage();
    this.shaders = new PoolStorage();
    this.groups = new PoolStorage();
    this.buffers = new PoolStorage();
    this.samplers = new PoolStorage();
    this.textures = new PoolStorage();
    this.attributes = new PoolStorage();
  }
  
  create_render_target(options) {
    return this.render_targets.allocate(new RenderTarget(this, options));
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
    return this.groups.allocate(new BindGroup(this.device, this, options));
  }

  get_bind_group(idx) {
    return this.groups.get(idx);
  }

  destroy_bind_group(idx) {
    this.groups.delete(idx);
  }

  create_buffer(options) {
    return this.buffers.allocate(this.device.createBuffer(options));
  }

  get_buffer(idx) {
    return this.buffers.get(idx);
  }

  destroy_buffer(idx) {
    this.buffers.get(idx).destroy();
    this.buffers.delete(idx);
  }

  create_sampler(options) {
    return this.samplers.allocate(this.device.createSampler(options));
  }

  get_sampler(idx) {
    return this.samplers.get(idx);
  }

  destroy_sampler(idx) {
    this.samplers.delete(idx);
  }

  create_texture(options) {
    return this.textures.allocate(
      options.canvas ? 
        new CanvasTexture(this.device, options) :
        new Texture(this.device, options)
    );
  }

  get_texture(idx) {
    return this.textures.get(idx);
  }

  destroy_texture(idx) {
    this.textures.get(idx).destroy();
    this.textures.delete(idx);
  }

  create_texture(options) {
    return this.textures.allocate(
      options.canvas ? 
        new CanvasTexture(this.device, options) :
        new Texture(this.device, options)
    );
  }

  get_texture(idx) {
    return this.textures.get(idx);
  }

  destroy_texture(idx) {
    this.textures.get(idx).destroy();
    this.textures.delete(idx);
  }

  create_attribute(options) {
    return this.attributes.allocate(new Attribute(options));
  }

  get_attribute(idx) {
    return this.attributes.get(idx);
  }

  destroy_attribute(idx) {
    this.attributes.delete(idx);
  }

  create_shader(options) {
    return this.shaders.allocate(new Shader(this.device, options));
  }

  get_shader(idx) {
    return this.shaders.get(idx);
  }

  destroy_shader(idx) {
    return this.shaders.delete(idx);
  }
}