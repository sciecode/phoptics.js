import { Engine } from "./src/engine.mjs";
import { shader } from "./material_shader.mjs";

let engine, render_target, render_pass, shader_module;

(async () => {

  const canvas = document.createElement('canvas');
  document.body.append(canvas);

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance'
  });

  const device = await adapter.requestDevice();

  engine = new Engine(adapter, device);

  render_target = engine.resources.create_canvas_target({
    canvas: canvas,
    width: window.innerWidth,
    height: window.innerHeight
  });

  render_pass = engine.resources.create_render_pass({
    color: [{ target: render_target }]
  });

  shader_module = engine.resources.create_shader({
    code: shader,
  });

  animate();
})();

const auto_resize = () => {
  const rt = engine.resources.get_canvas_target(render_target);

  const dpr = window.devicePixelRatio;
  const newW = (rt.canvas.clientWidth * dpr) | 0;
  const newH = (rt.canvas.clientHeight * dpr) | 0;

  if (rt.width != newW || rt.height != newH) {
    rt.set_size(newW, newH);
  }
}

const animate = () => {
  requestAnimationFrame(animate);
  
  auto_resize();
  engine.render_target(render_pass, shader_module);
}


