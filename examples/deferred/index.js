import { GPUResource } from "../../src/backend/constants.mjs";
import { Renderer } from "../../src/renderer/renderer.mjs";
import { DrawStream } from "../../src/renderer/common/draw_stream.mjs";

import { Vec3 } from "../../src/datatypes/vec3.mjs";
import { Vec4 } from "../../src/datatypes/vec4.mjs";
import { Mat3x4 } from "../../src/datatypes/mat34.mjs";
import { Mat4x4 } from "../../src/datatypes/mat44.mjs";

import { OBJLoader } from "../../src/utils/loaders/obj_loader.mjs";
import { gbuffer_shader } from "../shaders/deferred_gbuffer.mjs";
import { lighting_shader } from "../shaders/deferred_lighting.mjs";

let renderer, backend, canvas, gbuffer_pipeline, lighting_pipeline;
let global_bind_group, lighting_bind_group, lighting_layout;
let draw_stream, global_data, count;

let gbuffer_target, render_target, sampler;
let attrib0, attrib1, geometry_buffer, index_offset;
let target = new Vec3();

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

  const device = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance'
  }).then(adapter => adapter.requestDevice());

  renderer = new Renderer(device);
  backend = renderer.backend;

  const canvas_texture = renderer.create_canvas_texture({canvas});

  const render_pass = renderer.create_render_pass({
    multisampled: true,
    formats: { 
      color: [navigator.gpu.getPreferredCanvasFormat()],
    }
  });

  render_target = renderer.create_render_target(render_pass, {
    size: { width: viewport.x, height: viewport.y },
    color: [
      { resolve: canvas_texture, clear: [.05, .05, .05, 1] },
    ],
  });

  const gbuffer_pass = renderer.create_render_pass({
    formats: {
      color: ["rgba32float", "rgba32float"],
      depth: "depth24plus"
    }
  });

  gbuffer_target = renderer.create_render_target(gbuffer_pass, {
    size: { width: viewport.x, height: viewport.y },
    color: [
      { clear: [0, 0, 0, 0] },
      { clear: [0, 0, 0, 0] },
    ],
    depth: { clear: 0 }
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

  global_data = renderer.resources.create_resource_data([
    { name: "projection_matrix", type: Mat4x4 },
    { name: "view_matrix", type: Mat3x4 },
    { name: "camera_position", type: Vec4 },
  ]);

  target.set(0, 30, 0);
  global_data.camera_position.y = 30;
  global_data.camera_position.w = 250;
  global_data.projection_matrix.perspective(Math.PI / 2.5, window.innerWidth / window.innerHeight, 1, 600);
  global_data.view_matrix.translate(global_data.camera_position).view_inverse();
  renderer.resources.update_resource_data(global_data);

  const info = global_data.get_info();
  global_bind_group = backend.resources.create_bind_group({
    layout: global_layout,
    entries: [
      {
        binding: 0,
        type: GPUResource.BUFFER,
        offset: info.offset,
        size: info.size,
        resource: renderer.resources.get_handle_data(global_data),
      }
    ]
  });

  sampler = backend.resources.create_sampler();
  
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
        resource: renderer.resources.get_texture_handle(gbuffer_target.attachments.color[0].texture),
      },
      {
        binding: 2,
        type: GPUResource.TEXTURE,
        resource: renderer.resources.get_texture_handle(gbuffer_target.attachments.color[1].texture),
      }
    ]
  });

  gbuffer_pipeline = backend.resources.create_pipeline({
    code: gbuffer_shader,
    render_info: gbuffer_pass.info,
    layouts: {
      bindings: [global_layout],
    },
    vertex: {
      buffers: [
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
    },
  });

  lighting_pipeline = backend.resources.create_pipeline({
    code: lighting_shader,
    render_info: render_pass.info,
    layouts: {
      bindings: [global_layout, lighting_layout],
    },
    pipeline: {
      multisample: {
        count: 4,
      }
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

  draw_stream.set_pipeline(gbuffer_pipeline);
  draw_stream.set_globals(global_bind_group);
  draw_stream.set_variant(0);
  draw_stream.set_material(0);
  draw_stream.set_dynamic(0);
  draw_stream.set_attribute(0, attrib0);
  draw_stream.set_attribute(1, attrib1);

  draw_stream.draw({
    index: geometry_buffer,
    draw_count: count,
    vertex_offset: 0,
    index_offset: index_offset,
  });
}

const update_lighting_stream = () => {
  draw_stream.clear();

  draw_stream.set_pipeline(lighting_pipeline);
  draw_stream.set_globals(global_bind_group);
  draw_stream.set_variant(lighting_bind_group);
  draw_stream.set_material(0);
  draw_stream.set_dynamic(0);

  draw_stream.draw({
    draw_count: 3,
    index_offset: -1,
  });
}

const auto_resize = () => {
  const dpr = window.devicePixelRatio;
  const newW = (canvas.clientWidth * dpr) | 0;
  const newH = (canvas.clientHeight * dpr) | 0;
  
  if (viewport.x != newW || viewport.y != newH) {
    canvas.width = viewport.x = newW; canvas.height = viewport.y = newH;

    render_target.set_size(viewport);
    gbuffer_target.set_size(viewport);

    // TODO: this won't work until bind group updates have been implemented
    // backend.resources.update_bind_group(lighting_bind_group);
    
    global_data.projection_matrix.perspective(Math.PI / 2.5, viewport.x / viewport.y, 1, 600);
  }
}

const animate = () => {
  requestAnimationFrame(animate);

  auto_resize();

  const angle = performance.now() / 1000;
  global_data.camera_position.x = 100 * Math.sin(angle);
  global_data.camera_position.z = 100 * Math.cos(angle);
  global_data.view_matrix.translate(global_data.camera_position).look_at(target).view_inverse();
  renderer.resources.update_resource_data(global_data);

  update_gbuffer_stream();
  renderer.render(gbuffer_target, draw_stream);

  update_lighting_stream();
  renderer.render(render_target, draw_stream);
}