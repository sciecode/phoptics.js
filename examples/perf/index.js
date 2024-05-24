import { Engine, Mesh, RenderList, Shader, Material, Texture, CanvasTexture,
  RenderPass, RenderTarget, StructuredBuffer, DynamicLayout } from 'phoptics';
import { Vec3, Vec4, Quat, Mat3x4, Mat4x4 } from 'phoptics/math';
import { uncompress } from 'phoptics/utils/modules/geometry/compression.mjs';

import forward_shader from "../shaders/forward_shader.mjs";

const dpr = window.devicePixelRatio;
let viewport = { width: window.innerWidth * dpr | 0, height: window.innerHeight * dpr | 0 };
let engine, canvas_texture, render_pass, render_target, scene, camera;
let target = new Vec3(), q = new Quat();

const renderlist = new RenderList();

(async () => {
  engine = new Engine(await Engine.acquire_device());

  canvas_texture = new CanvasTexture({ format: navigator.gpu.getPreferredCanvasFormat() });
  canvas_texture.set_size(viewport);
  document.body.append(canvas_texture.canvas);

  camera = new StructuredBuffer([
    { name: "projection", type: Mat4x4 },
    { name: "view", type: Mat3x4 },
    { name: "position", type: Vec4 },
    { name: "luma", type: Vec4 },
  ]);

  render_pass = new RenderPass({
    multisampled: true,
    formats: {
      color: [canvas_texture.format],
      depth: "depth32float",
    },
    bindings: [{ binding: 0,  name: "camera", resource: camera }]
  });

  const multisampled_texture = new Texture({ size: viewport, format: canvas_texture.format, multisampled: true });
  const depth_texture = new Texture({ size: viewport, format: render_pass.formats.depth, multisampled: true });
  
  render_target = new RenderTarget({
    color: [ { 
      view: multisampled_texture.create_view(), 
      resolve: canvas_texture.create_view(), 
      clear: [.05, .05, .05, 0]
    } ],
    depth: { view: depth_texture.create_view(), clear: 0 }
  });

  render_pass.set_render_target(render_target);

  target.set(0, 1, 0);
  camera.position.set(0, 0, 100);
  camera.luma.set(250, 1);
  camera.view.translate(camera.position).look_at(target).view_inverse();
  camera.projection.perspective(Math.PI / 3, viewport.width / viewport.height, 1, 600);

  const transform_layout = new DynamicLayout([
    { name: "world", type: Mat3x4 },
    { name: "color", type: Vec4 }
  ]);

  const shader_base = new Shader({ code: forward_shader });

  const material = new Material({
    shader: shader_base,
    dynamic: transform_layout,
    vertex: [
      {
        arrayStride: 8, 
        attributes: [{ shaderLocation: 0, offset: 0, format: 'uint32x2' }]
      },
    ],
  });

  const query = await fetch('../models/walt.phg');
  const compressed = new Uint8Array( await query.arrayBuffer() );
  console.time("uncompress");
  const geo = uncompress(compressed);
  console.timeEnd("uncompress");

  scene = [];

  const count = 3000;
  for (let i = 0; i < count; i++) {
    const mesh = new Mesh(geo, material);
    mesh.dynamic.color.set(Math.random(), Math.random(), Math.random());
    mesh.position = new Vec3();
    mesh.position.set(Math.random(), Math.random(), Math.random()).sub_f32(.5).mul_f32(100);
    mesh.rotation = (Math.random() - .5) * Math.PI / 2;

    scene.push(mesh);
  }

  animate();
})();

const auto_resize = () => {
  const dpr = window.devicePixelRatio;
  const newW = (canvas_texture.canvas.clientWidth * dpr) | 0;
  const newH = (canvas_texture.canvas.clientHeight * dpr) | 0;
  
  if (viewport.width != newW || viewport.height != newH) {
    viewport.width = newW; viewport.height = newH;
    render_target.set_size(viewport);
    
    camera.projection.perspective(Math.PI / 3, viewport.width / viewport.height, 1, 300);
  }
}

const animate = () => {
  requestAnimationFrame(animate);

  auto_resize();

  const nr = performance.now() / 2000;

  camera.luma.y = Math.sin(nr * 4) + 1.;
  camera.update();

  {
    renderlist.reset();

    for (let i = 0, il = scene.length; i < il; i++) {
      const mesh = scene[i];
      q.set().rot_y(mesh.rotation * nr * 4);
      mesh.dynamic.world.rigid(mesh.position, q);
      renderlist.add(mesh);
    }
  }

  engine.render(render_pass, renderlist);
}