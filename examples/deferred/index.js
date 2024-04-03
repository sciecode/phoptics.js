import { GPUBackend } from "../../src/backend/gpu_backend.mjs";
import { GPUResource } from "../../src/backend/constants.mjs";
import { DrawStream } from "../../src/backend/draw_stream.mjs";

import { Vec3 } from "../../src/datatypes/vec3.mjs";
import { Vec4 } from "../../src/datatypes/vec4.mjs";
import { Mat3x4 } from "../../src/datatypes/mat34.mjs";
import { Mat4x4 } from "../../src/datatypes/mat44.mjs";

import { OBJLoader } from "../../src/utils/loaders/obj_loader.mjs";
import { gbuffer_shader } from "../shaders/deferred_gbuffer.mjs";
import { lighting_shader } from "../shaders/deferred_lighting.mjs";

let backend, canvas, shader_module, shader_module1;
let global_bind_group, lighting_bind_group, lighting_layout;
let draw_stream, global_buffer, global_data, count;

let depth_texture, ms_texture, gbuffer_pos, gbuffer_norm, gbuffer_target, render_target, sampler;
let attrib0, attrib1, geometry_buffer, index_offset;
let view_matrix = new Mat3x4(), projection_matrix = new Mat4x4(), 
    camera_pos = new Vec3(), target = new Vec3();

const dpr = window.devicePixelRatio;
let viewport = {x: window.innerWidth * dpr | 0, y: window.innerHeight * dpr | 0};

(() => {
  const loader = new OBJLoader();
  loader.load('../models/walt.obj').then(geo => init(geo));
})();

const init = async (geo) => {
  canvas = document.createElement('canvas');
  canvas.width = viewport.x, canvas.height = viewport.y;
  document.body.append(canvas);

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance'
  });

  const device = await adapter.requestDevice();
  backend = new GPUBackend(adapter, device);

  const canvas_texture = backend.resources.create_texture({
    canvas: canvas
  });

  ms_texture = backend.resources.create_texture({
    width: viewport.x,
    height: viewport.y,
    format: navigator.gpu.getPreferredCanvasFormat(),
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
    sampleCount: 4,
  });

  gbuffer_pos = backend.resources.create_texture({
    width: viewport.x,
    height: viewport.y,
    format: "rgba32float",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });

  gbuffer_norm = backend.resources.create_texture({
    width: viewport.x,
    height: viewport.y,
    format: "rgba32float",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });

  depth_texture = backend.resources.create_texture({
    width: viewport.x,
    height: viewport.y,
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  
  gbuffer_target = backend.resources.create_render_target({
    color: [
      { target: gbuffer_pos, clear: [0, 0, 0, 0] },
      { target: gbuffer_norm, clear: [0, 0, 0, 0] }
    ],
    depth_stencil: { target: depth_texture, clear: 0 }
  });

  render_target = backend.resources.create_render_target({
    color: [
      { target: ms_texture, resolve: canvas_texture, clear: [.05, .05, .05, 1] }
    ],
  });

  const global_layout = backend.resources.create_group_layout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: {
          type: "read-only-storage",
        },
      },
    ],
  });

  lighting_layout = backend.resources.create_group_layout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {
          type: "non-filtering",
        }
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {
          sampleType: "unfilterable-float",
        },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {
          sampleType: "unfilterable-float",
        },
      },
    ],
  });

  const uniforms_size = Mat4x4.byte_size + Mat3x4.byte_size + Vec4.byte_size;
  global_buffer = backend.resources.create_buffer({
    size: uniforms_size,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  });

  global_data = new Float32Array(uniforms_size / 4);

  target.set(0, 30, 0);

  camera_pos.y = 30;
  camera_pos.to(global_data, 28);
  global_data[31] = 250;

  projection_matrix.projection(Math.PI / 2.5, window.innerWidth / window.innerHeight, 1, 600);
  projection_matrix.to(global_data, 0);

  view_matrix.translate(camera_pos);
  view_matrix.view_inverse();
  view_matrix.to(global_data, 16);

  backend.write_buffer(global_buffer, 0, global_data);

  sampler = backend.resources.create_sampler();

  global_bind_group = backend.resources.create_bind_group({
    layout: global_layout,
    entries: [
      {
        binding: 0,
        type: GPUResource.BUFFER,
        resource: global_buffer,
      }
    ]
  });

  lighting_bind_group = backend.resources.create_bind_group({
    layout: lighting_layout,
    entries: [
      {
        binding: 0,
        type: GPUResource.SAMPLER,
        resource: sampler,
      },
      {
        binding: 1,
        type: GPUResource.TEXTURE,
        resource: gbuffer_pos,
      },
      {
        binding: 2,
        type: GPUResource.TEXTURE,
        resource: gbuffer_norm,
      }
    ]
  });

  shader_module = backend.resources.create_shader({
    code: gbuffer_shader,
    render_target: gbuffer_target,
    group_layouts: [global_layout],
    vertex_buffers: [
      {
        arrayStride: 12,
        attributes: [
          {shaderLocation: 0, offset: 0, format: 'float32x3'},
        ],
      },
      {
        arrayStride: 12,
        attributes: [
          {shaderLocation: 1, offset: 0, format: 'float32x3'},
        ],
      },
    ],
  });

  shader_module1 = backend.resources.create_shader({
    code: lighting_shader,
    render_target: render_target,
    group_layouts: [global_layout, lighting_layout],
    multisample: {
      count: 4,
    }
  });

  const vertex_count = geo.positions.length, index_count = geo.indices.length;
  const geo_byte_size = (vertex_count * 2 + index_count) * 4;

  geometry_buffer = backend.resources.create_buffer({
    size: geo_byte_size,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
  });

  const data = new ArrayBuffer(geo_byte_size);
  const pos_data = new Float32Array(data, 0, vertex_count);
  const norm_data = new Float32Array(data, vertex_count * 4, vertex_count);
  const index_data = new Uint32Array(data, vertex_count * 8, index_count);
  pos_data.set(geo.positions);
  norm_data.set(geo.normals);
  index_data.set(geo.indices);

  count = index_count;
  index_offset = vertex_count * 2;

  backend.write_buffer(geometry_buffer, 0, data);

  attrib0 = backend.resources.create_attribute({
    buffer: geometry_buffer,
    byte_offset: 0,
    byte_size: vertex_count * 4,
  });

  attrib1 = backend.resources.create_attribute({
    buffer: geometry_buffer,
    byte_offset: vertex_count * 4,
    byte_size: vertex_count * 4,
  });

  draw_stream = new DrawStream();

  animate();
}

const update_gbuffer_stream = () => {
  draw_stream.clear();

  draw_stream.draw({
    shader: shader_module,
    bind_group0: global_bind_group,
    bind_group1: 0,
    bind_group2: 0,
    dynamic_group: 0,
    attribute0: attrib0,
    attribute1: attrib1,
    index: geometry_buffer,
    draw_count: count,
    vertex_offset: 0,
    index_offset: index_offset,
  });
}

const update_lighting_stream = () => {
  draw_stream.clear();

  draw_stream.draw({
    shader: shader_module1,
    bind_group0: global_bind_group,
    bind_group1: lighting_bind_group,
    bind_group2: 0,
    dynamic_group: 0,
    draw_count: 3,
    index_offset: -1,
  });
}

const auto_resize = () => {
  const dpr = window.devicePixelRatio;
  const newW = (canvas.clientWidth * dpr) | 0;
  const newH = (canvas.clientHeight * dpr) | 0;
  
  if (viewport.x != newW || viewport.y != newH) {
    viewport.x = newW; viewport.y = newH;

    canvas.width = viewport.x;
    canvas.height = viewport.y;
    const options = { width: viewport.x, height: viewport.y };
    backend.resources.update_texture(gbuffer_pos, options);
    backend.resources.update_texture(gbuffer_norm, options);
    backend.resources.update_texture(ms_texture, options);
    backend.resources.update_texture(depth_texture, options);
    backend.resources.update_bind_group(lighting_bind_group);
    
    projection_matrix.projection(Math.PI / 2.5, viewport.x / viewport.y, 1, 600);
    global_data[0] = projection_matrix.data[0];
  }
}

const animate = () => {
  requestAnimationFrame(animate);

  auto_resize();

  const angle = performance.now() / 1000;
  camera_pos.x = 100 * Math.sin( angle );
  camera_pos.z = 100 * Math.cos( angle );
  camera_pos.to(global_data, 28);

  view_matrix.translate(camera_pos);
  view_matrix.look_at(target);
  view_matrix.view_inverse();
  view_matrix.to(global_data, 16);

  backend.write_buffer(global_buffer, 0, global_data);

  update_gbuffer_stream();
  backend.render(gbuffer_target, draw_stream);

  update_lighting_stream();
  backend.render(render_target, draw_stream);
}