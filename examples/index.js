import { GPUBackend } from "../src/backend/gpu_backend.mjs";
import { DrawStream } from "../src/backend/draw_stream.mjs";

import { Vec3 } from "../src/datatypes/vec3.mjs";
import { Mat3x4 } from "../src/datatypes/mat34.mjs";
import { Mat4x4 } from "../src/datatypes/mat44.mjs";

import { OBJLoader } from "../src/utils/loaders/obj_loader.mjs";
import { shader } from "./shaders/material_shader.mjs";

const dpr = window.devicePixelRatio;

let backend, canvas, render_target, shader_module, global_bind_group;
let attrib0, attrib1, geometry_buffer, index_offset;
let depth_texture, draw_stream, global_buffer, global_data, count;
let view_matrix = new Mat3x4(), projection_matrix = new Mat4x4(), camera_pos = new Vec3();
let viewport = {x: window.innerWidth * dpr | 0, y: window.innerHeight * dpr | 0};

(() => {
  const loader = new OBJLoader();
  loader.load('./models/walt.obj').then(geo => init(geo));
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

  depth_texture = backend.resources.create_texture({
    width: viewport.x,
    height: viewport.y,
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT
  });
  
  render_target = backend.resources.create_render_target({
    color: [
      { target: canvas_texture, clear: [.3, .3, .3, 1] }
    ],
    depth_stencil: { target: depth_texture, clear: 0 }
  });

  const global_layout = backend.resources.create_group_layout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: {
          type: "read-only-storage",
        },
      },
    ],
  });

  const uniforms_size = Mat4x4.byte_size + Mat3x4.byte_size;
  global_buffer = backend.resources.create_buffer({
    size: Mat4x4.byte_size + Mat3x4.byte_size,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  });

  global_data = new Float32Array(uniforms_size / 4);

  projection_matrix.projection(Math.PI / 2.5, window.innerWidth / window.innerHeight, 1, 600);
  projection_matrix.to(global_data, 0);

  camera_pos.set(0, 30, 100);
  view_matrix.compose_rigid(camera_pos);
  view_matrix.view_inverse();
  view_matrix.to(global_data, 16);

  backend.write_buffer(global_buffer, 0, global_data);

  global_bind_group = backend.resources.create_bind_group({
    layout: global_layout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: global_buffer
        }
      }
    ]
  });

  shader_module = backend.resources.create_shader({
    code: shader,
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
    ]
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

const update_draw_stream = () => {
  draw_stream.clear();

  draw_stream.draw({
    shader: shader_module,
    bind_group0: global_bind_group,
    attribute0: attrib0,
    attribute1: attrib1,
    index: geometry_buffer,
    draw_count: count,
    vertex_offset: 0,
    index_offset: index_offset,
  });
}

const auto_resize = () => {
  const dpr = window.devicePixelRatio;
  const newW = (canvas.clientWidth * dpr) | 0;
  const newH = (canvas.clientHeight * dpr) | 0;
  
  if (viewport.x != newW || viewport.y != newH) {
    canvas.width = viewport.x = newW; 
    canvas.height = viewport.y = newH;

    const tex_obj = backend.resources.get_texture(depth_texture);
    const tex_desc = {
      width: viewport.x,
      height: viewport.y,
      format: tex_obj.texture.format,
      usage: tex_obj.texture.usage,
    }
    backend.resources.destroy_texture(depth_texture);
    depth_texture = backend.resources.create_texture(tex_desc);
    
    projection_matrix.projection(Math.PI / 2.5, viewport.x / viewport.y, 1, 600);
    global_data[0] = projection_matrix.data[0];
  }
}

const animate = () => {
  requestAnimationFrame(animate);
  
  camera_pos.x = 20 * Math.sin( performance.now() / 400 );
  view_matrix.compose_rigid(camera_pos);
  view_matrix.view_inverse();
  view_matrix.to(global_data, 16);

  auto_resize();
  backend.write_buffer(global_buffer, 0, global_data);

  update_draw_stream();

  backend.render(render_target, draw_stream);
}