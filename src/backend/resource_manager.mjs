import { PoolStorage } from "../common/pool_storage.mjs";
import { Texture } from "./resources/texture.mjs";
import { Pipeline } from "./resources/pipeline.mjs"
import { BindGroup } from "./resources/bind_group.mjs";

export class ResourceManager {
  constructor(device) {
    this.device = device;
    this.pipelines = new PoolStorage();
    this.groups = new PoolStorage();
    this.buffers = new PoolStorage();
    this.samplers = new PoolStorage();
    this.textures = new PoolStorage();

    this.empty_layout = device.createBindGroupLayout({entries:[]});
    this.create_bind_group({
      layout: this.empty_layout,
      entries: []
    });
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
    return this.textures.allocate(new Texture(this.device, options));
  }

  get_texture(idx) {
    return this.textures.get(idx);
  }

  update_texture(idx, size) {
    this.textures.get(idx).update_texture(this.device, size);
  }

  destroy_texture(idx) {
    this.textures.get(idx).destroy();
    this.textures.delete(idx);
  }

  create_pipeline(options) {
    return this.pipelines.allocate(new Pipeline(this.device, this, options));
  }

  get_pipeline(idx) {
    return this.pipelines.get(idx);
  }

  destroy_pipeline(idx) {
    return this.pipelines.delete(idx);
  }
}