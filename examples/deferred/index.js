import { Engine, Mesh, Queue, Buffer, Shader, Sampler, Geometry, Material, Texture, CanvasTexture,
  RenderPass, RenderTarget, StructuredBuffer, DynamicLayout } from 'phoptics';
import { Vec3, Vec4, Mat3x4, Mat4x4 } from 'phoptics/math';

import { OBJLoader } from "../../src/utils/loaders/obj_loader.mjs";
import gbuffer_shader from "../shaders/deferred_gbuffer.mjs";
import lighting_shader from "../shaders/deferred_lighting.mjs";

const dpr = window.devicePixelRatio;
let viewport = { width: window.innerWidth * dpr | 0, height: window.innerHeight * dpr | 0 };
let engine, camera, gbuffer_scene, lighting_scene, mesh;
let gbuffer_pass, gbuffer_target, render_pass, render_target, canvas_texture;
let target = new Vec3(), obj_pos = new Vec3();

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

  target.set(0, 30, 0);
  camera.projection.perspective(Math.PI / 2.5, viewport.width / viewport.height, 1, 600);

  gbuffer_pass = new RenderPass({
    formats: {
      color: ["rgba32float", "rgba32float"],
      depth: "depth32float"
    },
    bindings: [{ binding: 0,  name: "camera", resource: camera }]
  });

  const gbuffer_pos = new Texture({ size: viewport, format: "rgba32float" });
  const gbuffer_normal = new Texture({ size: viewport, format: "rgba32float" });
  const gbuffer_depth = new Texture({ size: viewport, format: "depth32float" });
  const multisampled_texture = new Texture({ size: viewport, format: canvas_texture.format, multisampled: true });

  gbuffer_target = new RenderTarget({
    color: [
      { view: gbuffer_pos.create_view(), clear: [0, 0, 0, 0] },
      { view: gbuffer_normal.create_view(), clear: [0, 0, 0, 0] },
    ],
    depth: { view: gbuffer_depth.create_view(), clear: 0 }
  });
  gbuffer_pass.set_render_target(gbuffer_target);

  render_pass = new RenderPass({
    multisampled: true,
    formats: {
      color: [canvas_texture.format],
    },
    bindings: [
      { binding: 0, name: "camera", resource: camera },
      { binding: 1, name: "sampler", resource: new Sampler() },
      { binding: 2, name: "t_pos", resource: gbuffer_pos.create_view() },
      { binding: 3, name: "t_normal", resource: gbuffer_normal.create_view() },
    ]
  });

  render_target = new RenderTarget({
    color: [ { 
      view: multisampled_texture.create_view(), 
      resolve: canvas_texture.create_view(), 
      clear: [.05, .05, .05, 1]
    } ],
  });
  render_pass.set_render_target(render_target);

  const transform_layout = new DynamicLayout([
    { name: "world", type: Mat3x4 }
  ]);

  const gbuffer_material = new Material({
    shader: new Shader({ code: gbuffer_shader }),
    dynamic: transform_layout,
    vertex: [
      { arrayStride: 12, attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },
      ], },
      { arrayStride: 12, attributes: [
        { shaderLocation: 1, offset: 0, format: 'float32x3' },
      ], },
    ],
  });

  const loader = new OBJLoader();
  const geo = await loader.load('../models/walt.obj');

  const vertex_count = geo.positions.length, index_count = geo.indices.length;
  const geo_byte_size = (vertex_count * 2 + index_count) * 4;

  const data = new ArrayBuffer(geo_byte_size);
  const pos_data = new Float32Array(data, 0, vertex_count);
  const norm_data = new Float32Array(data, vertex_count * 4, vertex_count);
  const index_data = new Uint32Array(data, vertex_count * 8, index_count);
  pos_data.set(geo.positions);
  norm_data.set(geo.normals);
  index_data.set(geo.indices);

  const geometry = new Geometry({
    draw: { count: index_count },
    index: new Buffer({ data: index_data }),
    attributes: [
      new Buffer({ data: pos_data }),
      new Buffer({ data: norm_data })
    ],
  });

  mesh = new Mesh(geometry, gbuffer_material);
  gbuffer_scene = new Queue();
  gbuffer_scene.add(mesh);

  const lighting_material = new Material({
    shader: new Shader({ code: lighting_shader }),
  });

  const lighting = new Mesh(
    new Geometry({ draw: { count: 3 } }),
    lighting_material
  );
  lighting_scene = new Queue();
  lighting_scene.add(lighting);

  animate();
})();

const auto_resize = () => {
  const dpr = window.devicePixelRatio;
  const newW = (canvas_texture.canvas.clientWidth * dpr) | 0;
  const newH = (canvas_texture.canvas.clientHeight * dpr) | 0;
  
  if (viewport.width != newW || viewport.height != newH) {
    viewport.width = newW; viewport.height = newH;
    gbuffer_target.set_size(viewport);
    render_target.set_size(viewport);
    
    camera.projection.perspective(Math.PI / 2.5, viewport.width / viewport.height, 1, 600);
  }
}

const animate = () => {
  requestAnimationFrame(animate);

  auto_resize();

  const phase = performance.now() / 1000;
  camera.position.set(100 * Math.sin(phase), 30, 100 * Math.cos(phase), 250);
  camera.view.translate(camera.position).look_at(target).view_inverse();
  camera.update();

  {
    const amplitude = 10 * Math.sin(phase);
    obj_pos.set(0, amplitude, 0);
    mesh.dynamic.world.translate(obj_pos);
  }

  engine.render(gbuffer_pass, gbuffer_scene);
  engine.render(render_pass, lighting_scene);
}