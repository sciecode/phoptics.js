import { Engine, Mesh, RenderList, Shader, Sampler, Material, Texture, CanvasTexture,
  RenderPass, RenderTarget, StructuredBuffer, DynamicLayout } from 'phoptics';
import { Vec3, Vec4, Quat, Mat3x4, Mat4x4 } from 'phoptics/math';
import { Orbit } from 'phoptics/utils/modules/controls/orbit.mjs';
import { uncompress } from 'phoptics/utils/modules/geometry/compression.mjs';

import albedo_shader from "../shaders/albedo_shader.mjs";

const dpr = window.devicePixelRatio;
let viewport = { width: window.innerWidth * dpr | 0, height: window.innerHeight * dpr | 0 };
let engine, canvas_texture, render_pass, render_target, scene, camera, orbit;

const load_bitmap = (url) => fetch(url).then(resp => resp.blob()).then(blob => createImageBitmap(blob));

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

  orbit = new Orbit(canvas_texture.canvas);
  orbit.target.set(0, 0, 0);
  orbit.position.set(0, 0, 2);
  orbit.zoom_limit.x = 1;
  orbit.update();
  camera.luma.set(250, 1);
  camera.projection.perspective(Math.PI / 3, viewport.width / viewport.height, .1, 99);

  const transform_layout = new DynamicLayout([
    { name: "world", type: Mat3x4 },
  ]);

  const albedo = new Texture({
    size: { width: 2048, height: 2048 },
    format: "rgba8unorm-srgb",
  });

  const bitmap = await load_bitmap("../textures/cerberus/albedo.jpg");
  engine.upload_texture(albedo, bitmap, { flip_y: true });

  const material = new Material({
    shader: new Shader({ code: albedo_shader }),
    dynamic: transform_layout,
    bindings: [
      { binding: 0, name: "sampler", resource: new Sampler({
        filtering: { mag: "linear", min: "linear" },
      }) },
      { binding: 1, name: "albedo", resource: albedo.create_view() },
    ],
    vertex: [
      {
        arrayStride: 12,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'uint32x3' },
        ]
      },
    ],
  });

  const model = await fetch('../models/cerberus.phg');
  const compressed = new Uint8Array(await model.arrayBuffer());
  console.time("uncompress");
  const geo = uncompress(compressed);
  console.timeEnd("uncompress");

  scene = new RenderList();
  const mesh = new Mesh(geo, material);
  const quat = new Quat(), pos = new Vec3();
  pos.set(.5, 0, 0);
  quat.rot_y(Math.PI / 2);
  mesh.dynamic.world.rigid(pos, quat);
  scene.add(mesh);

  animate();
})();

const auto_resize = () => {
  const dpr = window.devicePixelRatio;
  const newW = (canvas_texture.canvas.clientWidth * dpr) | 0;
  const newH = (canvas_texture.canvas.clientHeight * dpr) | 0;
  
  if (viewport.width != newW || viewport.height != newH) {
    viewport.width = newW; viewport.height = newH;
    render_target.set_size(viewport);
    
    camera.projection.perspective(Math.PI / 3, viewport.width / viewport.height, .1, 99);
  }
}

const animate = () => {
  requestAnimationFrame(animate);

  auto_resize();

  camera.position.copy(orbit.position);
  camera.view.copy(orbit.view);
  camera.update();

  engine.render(render_pass, scene);
}