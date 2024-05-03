import { Renderer } from "../../src/renderer/renderer.mjs";
import { RenderPass } from "../../src/renderer/objects/render_pass.mjs";
import { RenderTarget } from "../../src/renderer/objects/render_target.mjs";
import { DynamicLayout } from "../../src/renderer/objects/dynamic_layout.mjs";
import { StructuredBuffer } from "../../src/renderer/objects/structured_buffer.mjs";
import { Queue } from "../../src/renderer/objects/queue.mjs";
import { Mesh } from "../../src/renderer/objects/mesh.mjs";
import { Shader } from "../../src/renderer/objects/shader.mjs";
import { Sampler } from "../../src/renderer/objects/sampler.mjs";
import { Texture } from "../../src/renderer/objects/texture.mjs";
import { Material } from "../../src/renderer/objects/material.mjs";
import { CanvasTexture } from "../../src/renderer/objects/canvas_texture.mjs";

import { Vec3 } from "../../src/datatypes/vec3.mjs";
import { Vec4 } from "../../src/datatypes/vec4.mjs";
import { Mat3x4 } from "../../src/datatypes/mat34.mjs";
import { Mat4x4 } from "../../src/datatypes/mat44.mjs";

import { OBJLoader } from "../../src/utils/loaders/obj_loader.mjs";
import { gbuffer_shader } from "../shaders/deferred_gbuffer.mjs";
import { lighting_shader } from "../shaders/deferred_lighting.mjs";

let renderer, backend, camera, gbuffer_scene, lighting_scene, mesh;
let gbuffer_pass, gbuffer_target, render_pass, render_target, canvas_texture;
let target = new Vec3(), obj_pos = new Vec3();

const dpr = window.devicePixelRatio;
let viewport = {x: window.innerWidth * dpr | 0, y: window.innerHeight * dpr | 0};

(() => {
  const loader = new OBJLoader();
  loader.load('../models/walt.obj').then(async (geo) => {
    renderer = new Renderer(await Renderer.acquire_device());
    backend = renderer.backend;

    const vertex_count = geo.positions.length, index_count = geo.indices.length;
    const geo_byte_size = (vertex_count * 2 + index_count) * 4;

    const geometry_buffer = backend.resources.create_buffer({
      size: geo_byte_size,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });

    const data = new ArrayBuffer(geo_byte_size);
    const pos_data = new Float32Array(data, 0, vertex_count);
    const norm_data = new Float32Array(data, vertex_count * 4, vertex_count);
    const index_data = new Uint32Array(data, vertex_count * 8, index_count);
    pos_data.set(geo.positions);
    norm_data.set(geo.normals);
    index_data.set(geo.indices);
    
    backend.write_buffer(geometry_buffer, 0, data);

    const geometry = {
      index: geometry_buffer,
      count: index_count,
      index_offset: vertex_count * 2,
      vertex_offset: 0,
      attributes: [],
    }

    geometry.attributes.push(backend.resources.create_attribute({
      buffer: geometry_buffer,
      byte_offset: 0,
      byte_size: vertex_count * 4,
    }));

    geometry.attributes.push(backend.resources.create_attribute({
      buffer: geometry_buffer,
      byte_offset: vertex_count * 4,
      byte_size: vertex_count * 4,
    }));

    init(geometry)
  });
})();

const init = async (geometry) => {
  canvas_texture = new CanvasTexture({ format: navigator.gpu.getPreferredCanvasFormat() });
  canvas_texture.set_size({ width: viewport.x, height: viewport.y });
  document.body.append(canvas_texture.canvas);

  camera = new StructuredBuffer([
    { name: "projection", type: Mat4x4 }, 
    { name: "view", type: Mat3x4 }, 
    { name: "position", type: Vec4 }, 
  ]);

  target.set(0, 30, 0);
  camera.projection.perspective(Math.PI / 2.5, window.innerWidth / window.innerHeight, 1, 600);

  gbuffer_pass = new RenderPass({
    formats: {
      color: ["rgba32float", "rgba32float"],
      depth: "depth32float"
    },
    bindings: [{ binding: 0,  name: "camera", resource: camera }]
  });

  const gbuffer_pos = new Texture({
    size: { width: viewport.x, height: viewport.y },
    format: "rgba32float",
  });

  const gbuffer_normal = new Texture({
    size: { width: viewport.x, height: viewport.y },
    format: "rgba32float",
  });

  const gbuffer_depth = new Texture({
    size: { width: viewport.x, height: viewport.y },
    format: "depth32float",
  });

  gbuffer_target = new RenderTarget({
    color: [
      { view: gbuffer_pos.create_view(), clear: [0, 0, 0, 0] },
      { view: gbuffer_normal.create_view(), clear: [0, 0, 0, 0] },
    ],
    depth: { view: gbuffer_depth.create_view(), clear: 0 }
  });
  gbuffer_pass.set_render_target(gbuffer_target);

  const multisampled_texture = new Texture({
    size: { width: viewport.x, height: viewport.y },
    format: canvas_texture.format,
    multisampled: true,
  });

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

  const lighting_material = new Material({
    shader: new Shader({ code: lighting_shader }),
  });

  mesh = new Mesh(geometry, gbuffer_material);
  gbuffer_scene = new Queue();
  gbuffer_scene.add(mesh);

  const lighting = new Mesh({
    count: 3,
    index: -1,
    index_offset: -1,
    vertex_offset: 0,
    attributes: []
  }, lighting_material);
  lighting_scene = new Queue();
  lighting_scene.add(lighting);

  animate();
}

const auto_resize = () => {
  const dpr = window.devicePixelRatio;
  const newW = (canvas_texture.canvas.clientWidth * dpr) | 0;
  const newH = (canvas_texture.canvas.clientHeight * dpr) | 0;
  
  if (viewport.x != newW || viewport.y != newH) {
    viewport.x = newW; viewport.y = newH;
    gbuffer_target.set_size({ width: newW, height: newH });
    render_target.set_size({ width: newW, height: newH });
    
    camera.projection.perspective(Math.PI / 2.5, viewport.x / viewport.y, 1, 600);
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

  renderer.render(gbuffer_pass, gbuffer_scene);
  renderer.render(render_pass, lighting_scene);
}