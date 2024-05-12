import { Engine, Mesh, Queue, Buffer, Shader, Geometry, Material, Texture, CanvasTexture,
  RenderPass, RenderTarget, StructuredBuffer, DynamicLayout } from 'phoptics';
import { Vec3, Vec4, Mat3x4, Mat4x4 } from 'phoptics/math';

import { OBJLoader } from "../../src/utils/loaders/obj_loader.mjs";
import forward_shader from "../shaders/forward_shader.mjs";

const dpr = window.devicePixelRatio;
let viewport = { width: window.innerWidth * dpr | 0, height: window.innerHeight * dpr | 0 };
let engine, canvas_texture, render_pass, render_target, material, scene, camera;
let mesh1, mesh2, obj_pos = new Vec3(), target = new Vec3();

(async () => {
  engine = new Engine(await Engine.acquire_device());

  canvas_texture = new CanvasTexture({ format: navigator.gpu.getPreferredCanvasFormat() });
  canvas_texture.set_size(viewport);
  document.body.append(canvas_texture.canvas);

  camera = new StructuredBuffer([
    { name: "projection", type: Mat4x4 }, 
    { name: "view", type: Mat3x4 }, 
    { name: "position", type: Vec4 }, 
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
      clear: [.05, .05, .05, 1]
    } ],
    depth: { view: depth_texture.create_view(), clear: 0 }
  });

  target.set(0, 30, 0);
  camera.position.set(0, 30, 120, 250);
  camera.projection.perspective(Math.PI / 2.5, viewport.width / viewport.height, 1, 600);
  camera.view.translate(camera.position).view_inverse();
  render_pass.set_render_target(render_target);

  const transform_layout = new DynamicLayout([
    { name: "world", type: Mat3x4 }
  ]);

  const shader_base = new Shader({ code: forward_shader });
  material = new Material({
    shader: shader_base,
    dynamic: transform_layout,
    vertex: [
      { arrayStride: 16, attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },
        { shaderLocation: 1, offset: 12, format: 'uint32' } ], 
      },
    ],
  });

  const loader = new OBJLoader();
  const geo = await loader.load('../models/walt.obj');

  const vertex_count = geo.positions.length / 3, index_count = geo.indices.length;
  const geo_byte_size = (vertex_count * 4 + index_count) * 4;

  const data = new ArrayBuffer(geo_byte_size);
  const vertex_data_f32 = new Float32Array(data, 0, vertex_count * 4);
  const vertex_data_u32 = new Uint32Array(data, 0, vertex_count * 4);
  const index_data = new Uint32Array(data, vertex_count * 16, index_count);
  index_data.set(geo.indices);

  for (let i = 0; i < vertex_count; i++) {
    const i3 = i * 3, i4 = i * 4;

    vertex_data_f32[i4] = geo.positions[i3];
    vertex_data_f32[i4 + 1] = geo.positions[i3 + 1];
    vertex_data_f32[i4 + 2] = geo.positions[i3 + 2];
    vertex_data_u32[i4 + 3] = encode_normal(geo.normals[i3], geo.normals[i3 + 1], geo.normals[i3 + 2]);
  }

  const geometry = new Geometry({
    draw: { count: index_count },
    index: new Buffer({ data: index_data }),
    attributes: [ new Buffer({ data: vertex_data_f32, stride: 16 }) ],
  });

  scene = new Queue();
  mesh1 = new Mesh(geometry, material);
  obj_pos.set(-30, 0, 0);
  mesh1.dynamic.world.translate(obj_pos);
  scene.add(mesh1);
  
  mesh2 = new Mesh(geometry, material);
  obj_pos.x = 30;
  mesh2.dynamic.world.translate(obj_pos);
  scene.add(mesh2);

  engine.preload(render_pass, mesh1);
  
  animate();
})();

const auto_resize = () => {
  const dpr = window.devicePixelRatio;
  const newW = (canvas_texture.canvas.clientWidth * dpr) | 0;
  const newH = (canvas_texture.canvas.clientHeight * dpr) | 0;
  
  if (viewport.width != newW || viewport.height != newH) {
    viewport.width = newW; viewport.height = newH;
    render_target.set_size(viewport);
    
    camera.projection.perspective(Math.PI / 2.5, viewport.width / viewport.height, 1, 600);
  }
}

const encode_normal = (x, y, z) => {
  const abs = Math.abs(x) + Math.abs(y) + Math.abs(z);
  let nx = x / abs, ny = y / abs, vx, vy;

  if (z >= 0) {
    vx = nx;
    vy = ny;
  } else {
    vx = (1. - Math.abs(ny)) * Math.sign(nx);
    vy = (1. - Math.abs(nx)) * Math.sign(ny);
  }

  const dx = Math.round(32767.5 + vx * 32767.5), dy = Math.round(32767.5 + vy * 32767.5);
  return dx | (dy << 16);
 }

const animate = () => {
  requestAnimationFrame(animate);

  auto_resize();

  const phase = performance.now() / 500;
  camera.position.set(120 * Math.sin(phase / 4), 30, 120 * Math.cos(phase / 4), 250);
  camera.view.translate(camera.position).look_at(target).view_inverse();
  camera.update();

  {
    const amplitude = 10 * Math.sin(phase);
    obj_pos.set(-30, amplitude, 0);
    mesh1.dynamic.world.translate(obj_pos);

    obj_pos.set(30, -amplitude, 0);
    mesh2.dynamic.world.translate(obj_pos);
  }

  engine.render(render_pass, scene);
}