import { Engine, Mesh, RenderList, Buffer, Shader, Geometry, Material, Texture, CanvasTexture,
  RenderPass, RenderTarget, StructuredBuffer, DynamicLayout } from 'phoptics';
import { Vec3, Vec4, Mat3x4, Mat4x4 } from 'phoptics/math';

import { OBJLoader } from 'phoptics/utils/loaders/obj_loader.mjs';
import { encode_f16, encode_oct16 } from 'phoptics/utils/modules/geometry/encoder.mjs';
import { optimize_geometry } from 'phoptics/utils/modules/geometry/optimizer.mjs';
import { uncompress } from 'phoptics/utils/modules/geometry/compression.mjs';

import forward_shader from "../shaders/forward_shader.mjs";

const dpr = window.devicePixelRatio;
let viewport = { width: window.innerWidth * dpr | 0, height: window.innerHeight * dpr | 0 };
let engine, canvas_texture, render_pass, render_target, scene, camera;
let mesh1, mesh2, mesh3, obj_pos = new Vec3(), target = new Vec3();

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

  target.set(0, 1, 0);
  camera.position.set(0, 4, 18, 250);
  camera.view.translate(camera.position).look_at(target).view_inverse();
  camera.projection.perspective(Math.PI / 3, viewport.width / viewport.height, 1, 300);

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

  const model = await (new OBJLoader()).load('../models/walt.obj');
  const vertex_count = model.positions.length / 3, index_count = model.indices.length;
  const data = new ArrayBuffer(vertex_count * 8), dv = new DataView(data);  
  const index_data = new Uint16Array(index_count);
  index_data.set(model.indices);
  
  const norm = new Vec3(), scl = 1 / 37;
  for (let i = 0; i < vertex_count; i++) {
    const i3 = i * 3, i8 = i * 8;
    dv.setUint16(i8, encode_f16(model.positions[i3] * scl), true);
    dv.setUint16(i8 + 2, encode_f16(model.positions[i3 + 1] * scl), true);
    dv.setUint16(i8 + 4, encode_f16(model.positions[i3 + 2] * scl), true);
    dv.setUint16(i8 + 6, encode_oct16(norm.from(model.normals, i3)), true);
  }

  const geo = new Geometry({
    draw: { count: index_count },
    index: new Buffer({ data: index_data, stride: 2 }),
    attributes: [ new Buffer({ data: data, total_bytes: data.byteLength, stride: 8 }) ],
  });

  // console.time("optimize");
  // optimize_geometry(geo);
  // console.timeEnd("optimize");

  console.log(geo);

  // const query = await fetch('../models/walt.phg');
  // const model = new Uint8Array( await query.arrayBuffer() );
  // console.time("uncompress");
  // const geo = uncompress(model);
  // console.timeEnd("uncompress");

  scene = [];
  mesh1 = new Mesh(geo, material);
  scene.push(mesh1);
  
  mesh2 = new Mesh(geo, material);
  scene.push(mesh2);

  mesh3 = new Mesh(geo, material);
  scene.push(mesh3);

  engine.preload(render_pass, mesh1);

  {
    renderlist.reset();

    obj_pos.set(-1.5, 0, 0);
    mesh1.dynamic.world.translate(obj_pos);
    mesh1.dynamic.color.set(.5, 1, .5);
    const dist1 = obj_pos.squared_distance(camera.position) * distance_ratio;
    renderlist.add(mesh1, dist1);
    
    obj_pos.set(1.5, 0, 0);
    mesh2.dynamic.world.translate(obj_pos);
    mesh2.dynamic.color.set(.5, 1, .5);
    const dist2 = obj_pos.squared_distance(camera.position) * distance_ratio;
    renderlist.add(mesh2, dist2);

    obj_pos.set(0, 0, 0);
    mesh3.dynamic.color.set(1, .5, .5);
    const dist3 = obj_pos.squared_distance(camera.position) * distance_ratio;
    renderlist.add(mesh3, dist3);
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

  camera.position.set(3 * Math.sin(performance.now() / 1000), 1, 4, 250);
  camera.view.translate(camera.position).look_at(target).view_inverse();
  camera.update();

  engine.render(render_pass, renderlist);
}