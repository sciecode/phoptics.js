import { GPUBackend } from "./src/backend/gpu_backend.mjs";
import { shader } from "./material_shader.mjs";

let backend, canvas, render_target, render_pass, shader_module;
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

  shader_module = backend.resources.create_shader({
    code: shader,
    group_layouts: [global_layout],
  });

  animate();
})();

const auto_resize = () => {
  const dpr = window.devicePixelRatio;
  const newW = (canvas.clientWidth * dpr) | 0;
  const newH = (canvas.clientHeight * dpr) | 0;
  
  if (viewport.x != newW || viewport.y != newH) {
    viewport.x = newW; viewport.y = newH;
    backend.resources.get_render_target(render_target).set_size(newW, newH);
  }
}

const animate = () => {
  requestAnimationFrame(animate);
  
  auto_resize();
  backend.render_target(render_pass, shader_module);
}


