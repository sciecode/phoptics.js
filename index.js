import { GPUBackend } from "./src/backend/gpu_backend.mjs";
import { DrawStream } from "./src/backend/draw_stream.mjs";
import { shader } from "./material_shader.mjs";

let backend, canvas, render_target, render_pass;
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

  const global_bind_group = backend.resources.create_bind_group({
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

  const shader_module = backend.resources.create_shader({
    code: shader,
    group_layouts: [global_layout],
    vertex_buffers: [
      {
        arrayStride: 8,
        attributes: [
          {shaderLocation: 0, offset: 0, format: 'float32x2'},
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

  const vertex_buffer = backend.resources.create_buffer({
    size: 60,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  });

  const data = new Float32Array([
    0.0, 0.5,
    -0.5, -0.5,
    0.5, -0.5,
    0, 1, 0,
    1, 0, 0,
    0, 0, 1,
  ]);

  backend.write_buffer(vertex_buffer, 0, data);

  const pos_attrib = backend.resources.create_attribute({
    buffer: vertex_buffer,
    byte_offset: 0,
    byte_size: 24,
  });

  const color_attrib = backend.resources.create_attribute({
    buffer: vertex_buffer,
    byte_offset: 24,
    byte_size: 36
  });

  draw_stream = new DrawStream();
  draw_stream.reset();
  draw_stream.set_shader(shader_module);
  draw_stream.set_bind_group(0, global_bind_group);
  draw_stream.set_attribute(0, pos_attrib);
  draw_stream.set_attribute(1, color_attrib);
  draw_stream.commit();

  animate();
})();

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
  backend.render_pass(render_pass, draw_stream);
}


