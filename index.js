import { GPUBackend } from "./src/backend/gpu_backend.mjs";
import { DrawStream } from "./src/backend/draw_stream.mjs";
import { shader } from "./material_shader.mjs";
import { Mat3x4 } from "./src/datatypes/mat34.mjs";

window.Mat3x4 = Mat3x4;

let backend, canvas, render_target, render_pass;
let shader_module, global_bind_group, attrib, geometry_buffer;
let draw_stream, global_buffer, global_data = new Float32Array(1);
let viewport = { x: window.innerWidth, y: window.innerHeight };

(async () => {
  canvas = document.createElement('canvas');
  document.body.append(canvas);

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance'
  });

  const device = await adapter.requestDevice();
  backend = new GPUBackend(adapter, device);

  render_target = backend.resources.create_canvas_target({
    canvas: canvas,
    width: window.innerWidth,
    height: window.innerHeight,
  });
  
  render_pass = backend.resources.create_render_pass({
    color: [
      {
        target: render_target,
        clear: [.3, .3, .3, 1],
      }
    ]
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

  global_buffer = backend.resources.create_buffer({
    size: 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  });

  global_data[0] = window.innerWidth / window.innerHeight;
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
        arrayStride: 20,
        attributes: [
          {shaderLocation: 0, offset: 0, format: 'float32x2'},
          {shaderLocation: 1, offset: 8, format: 'float32x3'},
        ],
      },
    ]
  });

  geometry_buffer = backend.resources.create_buffer({
    size: 160,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
  });

  const data = new ArrayBuffer(160);

  const vertex_data = new Float32Array(data, 0, 15);
  vertex_data.set([
    0.0, 0.5,
    0, 1, 0,
    -0.5, -0.5,
    1, 0, 0,
    0.5, -0.5,
    0, 0, 1,
  ]);

  const index_data = new Uint32Array(data, 60, 3);
  index_data.set([
    0, 1, 2
  ]);

  const vertex_data2 = new Float32Array(data, 80, 15);
  vertex_data2.set([
    0.0, 0.5,
    0, 1, 0,
    0.5, -0.5,
    0, 0, 1,
    0.5, 0.5,
    0, 1, 1,
  ]);
  const index_data2 = new Uint32Array(data, 140, 3);
  index_data2.set([
    0, 1, 2
  ]);

  backend.write_buffer(geometry_buffer, 0, data);

  attrib = backend.resources.create_attribute({
    buffer: geometry_buffer,
    // byte_offset: 0,
    // byte_size: 60,
  });

  draw_stream = new DrawStream();

  animate();
})();

const update_draw_stream = () => {
  draw_stream.clear();

  draw_stream.draw({
    shader: shader_module,
    bind_group0: global_bind_group,
    attribute0: attrib,
    index: geometry_buffer,
    draw_count: 3,
    vertex_offset: 0,
    index_offset: 15,
  });

  draw_stream.draw({
    vertex_offset: 4,
    index_offset: 35
  });
}

const auto_resize = () => {
  const dpr = window.devicePixelRatio;
  const newW = (canvas.clientWidth * dpr) | 0;
  const newH = (canvas.clientHeight * dpr) | 0;
  
  if (viewport.x != newW || viewport.y != newH) {
    viewport.x = newW; viewport.y = newH;
    backend.resources.get_render_target(render_target).set_size(newW, newH);
    global_data[0] = newW / newH;
    backend.write_buffer(global_buffer, 0, global_data);
  }
}

const animate = () => {
  requestAnimationFrame(animate);
  
  auto_resize();

  update_draw_stream();

  backend.render_pass(render_pass, draw_stream);
}


