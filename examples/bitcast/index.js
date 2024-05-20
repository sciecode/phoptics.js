import { Engine, Mesh, RenderList, Shader, Geometry, Material, CanvasTexture, StructuredBuffer, RenderPass, RenderTarget} from 'phoptics';
import { Vec4 } from 'phoptics/math';
import bitcast_shader from "../shaders/bitcast_shader.mjs";

const dpr = window.devicePixelRatio;
let viewport = { width: window.innerWidth * dpr | 0, height: window.innerHeight * dpr | 0 };
let render_pass, render_target, engine, canvas_texture, scene, quad, globals;

const init = async () => {
  engine = new Engine(await Engine.acquire_device());

  canvas_texture = new CanvasTexture({ format: navigator.gpu.getPreferredCanvasFormat() });
  canvas_texture.set_size(viewport);
  document.body.append(canvas_texture.canvas);

  globals = new StructuredBuffer([
    { name: "resolution", type: Vec4 }, 
  ]);

  globals.resolution.set(viewport.width, viewport.height, 0, 0);

  render_pass = new RenderPass({
    formats: { color: [canvas_texture.format] },
    bindings: [{ binding: 0,  name: "globals", resource: globals }]
  });

  render_target = new RenderTarget({
    color: [ {
      view: canvas_texture.create_view(),
      clear: [0, 0, 0, 1] 
    } ],
  });

  render_pass.set_render_target(render_target);

  const material = new Material({
    shader: new Shader({ code: bitcast_shader }),
  });

  quad = new Mesh(new Geometry({ draw: { count: 6 } }), material);
  scene = new RenderList();
  scene.add(quad);

  animate();
}

const auto_resize = () => {
  const dpr = window.devicePixelRatio;
  const newW = (canvas_texture.canvas.clientWidth * dpr) | 0;
  const newH = (canvas_texture.canvas.clientHeight * dpr) | 0;
  
  if (viewport.width != newW || viewport.height != newH) {
    viewport.width = newW; viewport.height = newH;
    render_target.set_size(viewport);

    globals.resolution.set(viewport.width, viewport.height, 0, 0);
    globals.update();
  }
}

const animate = () => {
  requestAnimationFrame(animate);

  auto_resize();
  engine.render(render_pass, scene);
}

init();