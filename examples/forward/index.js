import { GPUResource } from "../../src/backend/constants.mjs";
import { DrawStream } from "../../src/renderer/common/draw_stream.mjs";
import { DynamicBindings } from "../../src/renderer/common/dynamic_bindings.mjs";

import { Renderer } from "../../src/renderer/renderer.mjs";
import { RenderPass } from "../../src/renderer/objects/render_pass.mjs";
import { RenderTarget } from "../../src/renderer/objects/render_target.mjs";
import { CanvasTexture } from "../../src/renderer/objects/canvas_texture.mjs";

import { Vec3 } from "../../src/datatypes/vec3.mjs";
import { Vec4 } from "../../src/datatypes/vec4.mjs";
import { Mat3x4 } from "../../src/datatypes/mat34.mjs";
import { Mat4x4 } from "../../src/datatypes/mat44.mjs";

import { OBJLoader } from "../../src/utils/loaders/obj_loader.mjs";
import { shader } from "../shaders/forward_shader.mjs";
import { StructuredBuffer } from "../../src/renderer/objects/structured_buffer.mjs";

let renderer, backend, canvas, render_pass, render_target, pipeline, global_bind_group;
let draw_stream, global_data, count, dynamic_bindings, transform_binding;
let attrib0, attrib1, geometry_buffer, index_offset;
let obj_matrix = new Mat3x4(), obj_pos = new Vec3(), target = new Vec3();

const dpr = window.devicePixelRatio;
let viewport = {x: window.innerWidth * dpr | 0, y: window.innerHeight * dpr | 0};

(() => {
  const loader = new OBJLoader();
  loader.load('../models/walt.obj').then(geo => init(geo));
})();

const init = async (geo) => {
  const device = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance'
  }).then( adapter => adapter.requestDevice());

  renderer = new Renderer(device);
  backend = renderer.backend;

  const canvas_texture = new CanvasTexture();
  canvas_texture.set_size({ width: viewport.x, height: viewport.y });
  canvas = canvas_texture.canvas;
  document.body.append(canvas);

  render_pass = new RenderPass({
    multisampled: true,
    formats: {
      color: [navigator.gpu.getPreferredCanvasFormat()],
      depth: "depth24plus",
    }
  });
  
  render_target = new RenderTarget(render_pass, {
    size: { width: viewport.x, height: viewport.y },
    color: [
      { resolve: canvas_texture, clear: [.05, .05, .05, 1] }
    ],
    depth: { clear: 0 }
  });

  render_pass.set_render_target(render_target);

  dynamic_bindings = new DynamicBindings(backend);
  transform_binding = dynamic_bindings.create_dynamic_binding([
    { binding: 0, size: Mat3x4.byte_size },
  ]);

  global_data = new StructuredBuffer([
    { name: "projection_matrix", type: Mat4x4 }, 
    { name: "view_matrix", type: Mat3x4 }, 
    { name: "camera_position", type: Vec4 }, 
  ]);

  target.set(0, 30, 0);
  global_data.camera_position.set(0, 30, 120, 250);
  global_data.projection_matrix.perspective(Math.PI / 2.5, window.innerWidth / window.innerHeight, 1, 600);
  global_data.view_matrix.translate(global_data.camera_position).view_inverse();

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

  const info = renderer.cache.get_buffer(global_data);

  global_bind_group = backend.resources.create_bind_group({
    layout: global_layout,
    entries: [
      {
        binding: 0,
        type: GPUResource.BUFFER,
        offset: info.offset,
        size: info.size,
        resource: info.bid,
      }
    ]
  });

  pipeline = backend.resources.create_pipeline({
    code: shader,
    render_info: render_pass,
    layouts: {
      bindings: [global_layout],
      dynamic: dynamic_bindings.get_layout(transform_binding),
    },
    vertex: {
      buffers: [
        {
          arrayStride: 12,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },
          ],
        },
        {
          arrayStride: 12,
          attributes: [
            { shaderLocation: 1, offset: 0, format: 'float32x3' },
          ],
        },
      ],
    },
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

const update_draw_stream = (angle) => {
  dynamic_bindings.reset();
  draw_stream.clear();
  
  let bind_info = dynamic_bindings.allocate(transform_binding);

  obj_pos.x = -30;
  obj_pos.y = 10 * Math.sin(angle);
  obj_matrix.translate(obj_pos);
  dynamic_bindings.writer.f32_array(obj_matrix, bind_info.offsets[0]);

  draw_stream.set_pipeline(pipeline);
  draw_stream.set_globals(global_bind_group);
  draw_stream.set_variant(0);
  draw_stream.set_material(0);
  draw_stream.set_dynamic(bind_info.group);
  draw_stream.set_dynamic_offset(0, bind_info.offsets[0]);
  draw_stream.set_attribute(0, attrib0);
  draw_stream.set_attribute(1, attrib1);

  draw_stream.draw({
    index: geometry_buffer,
    draw_count: count,
    vertex_offset: 0,
    index_offset: index_offset,
  });

  bind_info = dynamic_bindings.allocate(transform_binding);
  
  obj_pos.x = 30;
  obj_pos.y = -10 * Math.sin(angle);
  obj_matrix.translate(obj_pos);
  dynamic_bindings.writer.f32_array(obj_matrix, bind_info.offsets[0]);

  draw_stream.set_dynamic(bind_info.group);
  draw_stream.set_dynamic_offset(0, bind_info.offsets[0]);
  draw_stream.draw();

  dynamic_bindings.commit();
}

const auto_resize = () => {
  const dpr = window.devicePixelRatio;
  const newW = (canvas.clientWidth * dpr) | 0;
  const newH = (canvas.clientHeight * dpr) | 0;
  
  if (viewport.x != newW || viewport.y != newH) {
    viewport.x = newW; viewport.y = newH;
    render_target.set_size({ width: newW, height: newH });
    
    global_data.projection_matrix.perspective(Math.PI / 2.5, viewport.x / viewport.y, 1, 600);
  }
}

const animate = () => {
  requestAnimationFrame(animate);

  auto_resize();

  const angle = performance.now() / 2000;
  // global_data.camera_position.x = 120 * Math.sin(angle);
  // global_data.camera_position.z = 120 * Math.cos(angle);
  // global_data.view_matrix.translate(global_data.camera_position).look_at(target).view_inverse();
  global_data.update();

  renderer.cache.get_buffer(global_data);

  update_draw_stream(angle);

  renderer.render(render_pass, draw_stream);
}