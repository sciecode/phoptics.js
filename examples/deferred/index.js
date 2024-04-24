import { Renderer } from "../../src/renderer/renderer.mjs";
import { RenderPass } from "../../src/renderer/objects/render_pass.mjs";
import { RenderTarget } from "../../src/renderer/objects/render_target.mjs";
import { CanvasTexture } from "../../src/renderer/objects/canvas_texture.mjs";
import { Mesh } from "../../src/renderer/objects/mesh.mjs";
import { Shader } from "../../src/renderer/objects/shader.mjs";
import { Material } from "../../src/renderer/objects/material.mjs";
import { StructuredBuffer } from "../../src/renderer/objects/structured_buffer.mjs";
import { DynamicLayout } from "../../src/renderer/objects/dynamic_layout.mjs";

import { Vec3 } from "../../src/datatypes/vec3.mjs";
import { Vec4 } from "../../src/datatypes/vec4.mjs";
import { Mat3x4 } from "../../src/datatypes/mat34.mjs";
import { Mat4x4 } from "../../src/datatypes/mat44.mjs";

import { OBJLoader } from "../../src/utils/loaders/obj_loader.mjs";
import { gbuffer_shader } from "../shaders/deferred_gbuffer.mjs";
import { lighting_shader } from "../shaders/deferred_lighting.mjs";
import { Sampler } from "../../src/renderer/objects/sampler.mjs";

let renderer, backend, canvas, camera, gbuffer_scene, lighting_scene;
let gbuffer_pass, gbuffer_target, render_pass, render_target;
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
  const canvas_texture = new CanvasTexture();
  canvas_texture.set_size({ width: viewport.x, height: viewport.y });
  canvas = canvas_texture.canvas;
  document.body.append(canvas);

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

  gbuffer_target = new RenderTarget({
    pass: gbuffer_pass,
    size: { width: viewport.x, height: viewport.y },
    color: [
      { clear: [0, 0, 0, 0] },
      { clear: [0, 0, 0, 0] },
    ],
    depth: { clear: 0 }
  });
  gbuffer_pass.set_render_target(gbuffer_target);

  render_pass = new RenderPass({
    multisampled: true,
    formats: {
      color: [navigator.gpu.getPreferredCanvasFormat()],
    },
    bindings: [
      { binding: 0, name: "camera", resource: camera },
      { binding: 1, name: "sampler", resource: new Sampler() },
      { binding: 2, name: "t_pos", resource: gbuffer_target.attachments.color[0].texture },
      { binding: 3, name: "t_normal", resource: gbuffer_target.attachments.color[1].texture }
    ]
  });

  render_target = new RenderTarget({
    pass: render_pass,
    size: { width: viewport.x, height: viewport.y },
    color: [ 
      { resolve: canvas_texture, clear: [.05, .05, .05, 1] }
    ],
  });
  render_pass.set_render_target(render_target);

  const transform_layout = new DynamicLayout([
    { name: "world", type: Mat3x4 }
  ]);

  const gbuffer_material = new Material({
    shader: new Shader({code: gbuffer_shader}),
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
    shader: new Shader({code: lighting_shader}),
  });

  const mesh = new Mesh(geometry, gbuffer_material);
  gbuffer_scene = [mesh];

  const lighting = new Mesh({
    index: geometry.index,
    count: 3,
    index_offset: -1,
    vertex_offset: 0,
    attributes: []
  }, lighting_material);
  lighting_scene = [lighting];

  animate();
}

const auto_resize = () => {
  const dpr = window.devicePixelRatio;
  const newW = (canvas.clientWidth * dpr) | 0;
  const newH = (canvas.clientHeight * dpr) | 0;
  
  if (viewport.x != newW || viewport.y != newH) {
    viewport.x = newW; viewport.y = newH;
    render_target.set_size({ width: newW, height: newH });
    gbuffer_target.set_size({ width: newW, height: newH });
    
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
    gbuffer_scene[0].dynamic.world.translate(obj_pos);
  }

  renderer.render(gbuffer_pass, gbuffer_scene);
  renderer.render(render_pass, lighting_scene);
}