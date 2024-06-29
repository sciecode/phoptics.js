import { SparseArray } from "../common/sparse_array.mjs";
import { Texture } from "./resources/texture.mjs";
import { Pipeline } from "./resources/pipeline.mjs";
import { BindGroup } from "./resources/bind_group.mjs";

export class ResourceManager {
  constructor(device) {
    this.device = device;

    this.shaders = new SparseArray();
    this.pipelines = new SparseArray();
    this.pipeline_layouts = new SparseArray();

    this.groups = new SparseArray();
    this.buffers = new SparseArray();
    this.samplers = new SparseArray();
    this.textures = new SparseArray();

    this.empty_layout = device.createBindGroupLayout({ entries: [] });
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

  create_shader(options) {
    return this.shaders.allocate(this.device.createShaderModule(options));
  }

  get_shader(idx) {
    return this.shaders.get(idx);
  }

  destroy_shader(idx) {
    return this.shaders.delete(idx);
  }

  create_pipeline_layout(options) {
    return this.pipeline_layouts.allocate(
      this.device.createPipelineLayout({
        bindGroupLayouts: options.map(e => e || this.empty_layout),
      })
    );
  }

  get_pipeline_layout(idx) {
    return this.pipeline_layouts.get(idx);
  }

  destroy_pipeline_layout(idx) {
    return this.pipeline_layouts.delete(idx);
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