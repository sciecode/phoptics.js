import { Engine, Mesh, RenderList, Buffer, Shader, Geometry, Material, Texture, CanvasTexture,
  RenderPass, RenderTarget, StructuredBuffer, DynamicLayout } from 'phoptics';
import { Vec3, Vec4, Mat3x4, Mat4x4, Frustum } from 'phoptics/math';

import { OBJLoader } from "../../src/utils/loaders/obj_loader.mjs";
import forward_shader from "../shaders/forward_shader.mjs";
import line_shader from "../shaders/line_shader.mjs";

const dpr = window.devicePixelRatio;
let viewport = { width: window.innerWidth * dpr | 0, height: window.innerHeight * dpr | 0 };
let engine, canvas_texture, render_pass, render_target, scene, camera, frustum_mesh;
let mesh1, mesh2, mesh3, obj_pos = new Vec3(), target = new Vec3();
let frustum = new Frustum(), pv = new Mat4x4(), center = new Vec3(), view = new Mat3x4();

const distance_ratio = ((1 << 30) - 1) / 1_000_000;
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

  target.set(0, 30, 0);
  camera.position.set(0, 150, 30, 250);
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
    attributes: [ new Buffer({ data: data, bytes: vertex_count * 16, stride: 16 }) ],
  });

  scene = [];
  mesh1 = new Mesh(geometry, material);
  scene.push(mesh1);
  
  mesh2 = new Mesh(geometry, material);
  scene.push(mesh2);

  mesh3 = new Mesh(geometry, material);
  scene.push(mesh3);

  engine.preload(render_pass, mesh1);

  {
    renderlist.reset();

    obj_pos.set(-60, 0, 0);
    mesh1.dynamic.world.translate(obj_pos);
    mesh1.dynamic.color.set(.5, 1, .5);
    const dist1 = obj_pos.squared_distance(camera.position) * distance_ratio;
    renderlist.add(mesh1, dist1);
    
    obj_pos.set(60, 0, 0);
    mesh2.dynamic.world.translate(obj_pos);
    mesh2.dynamic.color.set(.5, 1, .5);
    const dist2 = obj_pos.squared_distance(camera.position) * distance_ratio;
    renderlist.add(mesh2, dist2);

    obj_pos.set(0, 0, 0);
    mesh3.dynamic.color.set(1, .5, .5);
    const dist3 = obj_pos.squared_distance(camera.position) * distance_ratio;
    renderlist.add(mesh3, dist3);
  }

  const line_data = new Float32Array(9);
  const far = 900, x = Math.tan(.5 * Math.PI / 2) * far;
  line_data[0] = x;
  line_data[2] = -far;
  line_data[6] = -x;
  line_data[8] = -far;

  const line_base = new Shader({ code: line_shader });
  const line_material = new Material({
    shader: line_base,
    dynamic: transform_layout,
    graphics: { primitive: "line-strip" },
    vertex: [
      { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
    ],
  });

  const lines_geometry = new Geometry({
    draw: { count: 9 },
    attributes: [ new Buffer({ data: line_data, stride: 12 }) ],
  });
  frustum_mesh = new Mesh(lines_geometry, line_material);
  renderlist.add(frustum_mesh);

  animate();
})();

const auto_resize = () => {
  const dpr = window.devicePixelRatio;
  const newW = (canvas_texture.canvas.clientWidth * dpr) | 0;
  const newH = (canvas_texture.canvas.clientHeight * dpr) | 0;
  
  if (viewport.width != newW || viewport.height != newH) {
    viewport.width = newW; viewport.height = newH;
    render_target.set_size(viewport);
    
    camera.projection.perspective(Math.PI / 3, viewport.width / viewport.height, 1, 600);
    camera.update();
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

const frustum_culling = () => {
  const phase = performance.now() / 400;
  target.set(130 * Math.sin(phase), 30, - 130 * Math.cos(phase) + 130);

  center.set(0, 30, 130);
  view.translate(center).look_at(target);
  frustum_mesh.dynamic.world.copy(view);
  
  view.view_inverse();
  pv.perspective(Math.PI / 2, 1, 1, 900).affine(view);
  frustum.set_projection(pv);

  for (let mesh of scene) {
    center.set(0, 37, 0).affine(mesh.dynamic.world);
    if (frustum.intersects_sphere(center, 50)) {
      mesh.dynamic.color.set(.5, 1, .5);
    } else {
      mesh.dynamic.color.set(1, .5, .5);
    }
  }
}

const animate = () => {
  requestAnimationFrame(animate);

  auto_resize();

  frustum_culling();

  engine.render(render_pass, renderlist);
}