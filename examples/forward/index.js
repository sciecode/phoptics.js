import { ResourceType } from "../../src/renderer/constants.mjs";
import { Renderer } from "../../src/renderer/renderer.mjs";
import { RenderPass } from "../../src/renderer/objects/render_pass.mjs";
import { RenderTarget } from "../../src/renderer/objects/render_target.mjs";
import { CanvasTexture } from "../../src/renderer/objects/canvas_texture.mjs";
import { Texture } from "../../src/renderer/objects/texture.mjs";
import { Queue } from "../../src/renderer/objects/queue.mjs";
import { Mesh } from "../../src/renderer/objects/mesh.mjs";
import { Shader } from "../../src/renderer/objects/shader.mjs";
import { Material } from "../../src/renderer/objects/material.mjs";
import { DynamicLayout } from "../../src/renderer/objects/dynamic_layout.mjs";

import { Vec3 } from "../../src/datatypes/vec3.mjs";
import { Vec4 } from "../../src/datatypes/vec4.mjs";
import { Mat3x4 } from "../../src/datatypes/mat34.mjs";
import { Mat4x4 } from "../../src/datatypes/mat44.mjs";

import { OBJLoader } from "../../src/utils/loaders/obj_loader.mjs";
import forward_shader from "../shaders/forward_shader.mjs";

const dpr = window.devicePixelRatio;
let viewport = {x: window.innerWidth * dpr | 0, y: window.innerHeight * dpr | 0};
let renderer, backend, canvas_texture, render_pass, render_target, material, scene;
let mesh1, mesh2, obj_pos = new Vec3(), target = new Vec3();

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

  render_pass = new RenderPass({
    multisampled: true,
    formats: {
      color: [canvas_texture.format],
      depth: "depth32float",
    },
    bindings: [
      {
        binding: 0,
        name: "camera",
        type: ResourceType.StructuredBuffer,
        info: [
          { name: "projection", type: Mat4x4 }, 
          { name: "view", type: Mat3x4 }, 
          { name: "position", type: Vec4 }, 
        ]
      }
    ]
  });

  const multisampled_texture = new Texture({
    size: { width: viewport.x, height: viewport.y },
    format: canvas_texture.format,
    multisampled: true,
  });

  const depth_texture = new Texture({
    size: { width: viewport.x, height: viewport.y },
    format: render_pass.formats.depth,
    multisampled: true,
  });
  
  render_target = new RenderTarget({
    color: [ { 
      view: multisampled_texture.create_view(), 
      resolve: canvas_texture.create_view(), 
      clear: [.05, .05, .05, 1]
    } ],
    depth: { view: depth_texture.create_view(), clear: 0 }
  });

  target.set(0, 30, 0);
  render_pass.bindings.camera.position.set(0, 30, 120, 250);
  render_pass.bindings.camera.projection.perspective(Math.PI / 2.5, window.innerWidth / window.innerHeight, 1, 600);
  render_pass.bindings.camera.view.translate(render_pass.bindings.camera.position).view_inverse();
  render_pass.set_render_target(render_target);

  const transform_layout = new DynamicLayout([
    { name: "world", type: Mat3x4 }
  ]);

  const shader_base = new Shader({ code: forward_shader });
  material = new Material({
    shader: shader_base,
    graphics: {
      cull: "back",
      primitive: "triangle-list",
      depth: {
        write: true,
        test: "greater"
      }
    },
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
  
  scene = new Queue();
  mesh1 = new Mesh(geometry, material);
  obj_pos.set(-30, 0, 0);
  mesh1.dynamic.world.translate(obj_pos);
  scene.add(mesh1);
  
  mesh2 = new Mesh(geometry, material);
  obj_pos.x = 30;
  mesh2.dynamic.world.translate(obj_pos);
  scene.add(mesh2);
  

  animate();
}

const auto_resize = () => {
  const dpr = window.devicePixelRatio;
  const newW = (canvas_texture.canvas.clientWidth * dpr) | 0;
  const newH = (canvas_texture.canvas.clientHeight * dpr) | 0;
  
  if (viewport.x != newW || viewport.y != newH) {
    viewport.x = newW; viewport.y = newH;
    render_target.set_size({ width: newW, height: newH });
    
    render_pass.bindings.camera.projection.perspective(Math.PI / 2.5, viewport.x / viewport.y, 1, 600);
  }
}

const animate = () => {
  requestAnimationFrame(animate);

  auto_resize();

  const phase = performance.now() / 500;
  render_pass.bindings.camera.position.set(120 * Math.sin(phase / 4), 30, 120 * Math.cos(phase / 4), 250);
  render_pass.bindings.camera.view.translate(render_pass.bindings.camera.position).look_at(target).view_inverse();
  render_pass.bindings.camera.update();

  {
    const amplitude = 10 * Math.sin(phase);
    obj_pos.set(-30, amplitude, 0);
    mesh1.dynamic.world.translate(obj_pos);

    obj_pos.set(30, -amplitude, 0);
    mesh2.dynamic.world.translate(obj_pos);
  }

  renderer.render(render_pass, scene);
}