import { Renderer } from "../../src/renderer/renderer.mjs";
import { RenderPass } from "../../src/renderer/objects/render_pass.mjs";
import { RenderTarget } from "../../src/renderer/objects/render_target.mjs";
import { CanvasTexture } from "../../src/renderer/objects/canvas_texture.mjs";
import { StructuredBuffer } from "../../src/renderer/objects/structured_buffer.mjs";
import { DynamicLayout } from "../../src/renderer/objects/dynamic_layout.mjs";
import { Queue } from "../../src/renderer/objects/queue.mjs";
import { Mesh } from "../../src/renderer/objects/mesh.mjs";
import { Shader } from "../../src/renderer/objects/shader.mjs";
import { Material } from "../../src/renderer/objects/material.mjs";
import { Sampler } from "../../src/renderer/objects/sampler.mjs";
import { Texture } from "../../src/renderer/objects/texture.mjs";

import { Vec3 } from "../../src/datatypes/vec3.mjs";
import { Vec4 } from "../../src/datatypes/vec4.mjs";
import { Mat3x4 } from "../../src/datatypes/mat34.mjs";
import { Mat4x4 } from "../../src/datatypes/mat44.mjs";

import mipmap_shader from "../shaders/mipmap_shader.mjs";

const dpr = window.devicePixelRatio;
let viewport = {x: window.innerWidth * dpr | 0, y: window.innerHeight * dpr | 0};
let render_pass, render_target, renderer, canvas_texture, scene, camera, quad;

const obj_pos = new Vec3();

const init = async () => {
  renderer = new Renderer(await Renderer.acquire_device());

  canvas_texture = new CanvasTexture({ format: navigator.gpu.getPreferredCanvasFormat() });
  canvas_texture.set_size({ width: viewport.x, height: viewport.y });
  document.body.append(canvas_texture.canvas);

  const data0 = new Float32Array([
    1, 0, 0, 1,
    1, 0, 0, 1,
    1, 0, 0, 1,
    1, 0, 0, 1,
  ]);

  const data1 = new Float32Array([
    0, 1, 0, 1
  ]);
  const mipmap = new Texture({ 
    size: { width: 2, height: 2}, 
    format: "rgba32float",
    mip_levels: Texture.max_mip_levels(2),
  });

  mipmap.upload_data({ data: data0, bytes: 16, mip_level: 0 });
  mipmap.upload_data({ data: data1, bytes: 16, mip_level: 1 });

  camera = new StructuredBuffer([
    { name: "projection", type: Mat4x4 }, 
    { name: "view", type: Mat3x4 }, 
    { name: "position", type: Vec4 }, 
  ]);
  
  render_pass = new RenderPass({
    formats: { color: [canvas_texture.format] },
    bindings: [{ binding: 0,  name: "camera", resource: camera }]
  });

  camera.position.set(0, 0, 10, 0);
  camera.projection.perspective(Math.PI / 2.5, window.innerWidth / window.innerHeight, 1, 610);
  camera.view.translate(render_pass.bindings.camera.position).view_inverse();
  camera.update();

  render_target = new RenderTarget({
    color: [ { view: canvas_texture.create_view(), clear: [.5, .5, .5, 1] } ],
  });

  render_pass.set_render_target(render_target);

  const transform_layout = new DynamicLayout([
    { name: "world", type: Mat3x4 }
  ]);

  const material = new Material({
    shader: new Shader({ code: mipmap_shader }),
    bindings: [
      { binding: 0, name: "sampler", resource: new Sampler({
        filtering: { mag: "linear", min: "linear", mipmap: "linear" } 
      }) },
      { binding: 1, name: "mipmap", resource: mipmap.create_view() },
    ],
    dynamic: transform_layout,
  });

  quad = new Mesh({
    index: -1,
    count: 6,
    index_offset: -1,
    vertex_offset: 0,
    attributes: []
  }, material);
  scene = new Queue();
  scene.add(quad);

  animate();
}

const auto_resize = () => {
  const dpr = window.devicePixelRatio;
  const newW = (canvas_texture.canvas.clientWidth * dpr) | 0;
  const newH = (canvas_texture.canvas.clientHeight * dpr) | 0;
  
  if (viewport.x != newW || viewport.y != newH) {
    viewport.x = newW; viewport.y = newH;
    render_target.set_size({ width: newW, height: newH });
    
    camera.projection.perspective(Math.PI / 2.5, viewport.x / viewport.y, 1, 610);
    camera.update();
  }
}

const animate = () => {
  requestAnimationFrame(animate);

  const phase = performance.now() / 500;
  const amp = 5 * Math.sin(phase);
  obj_pos.set(0, 0, amp);
  quad.dynamic.world.translate(obj_pos);

  auto_resize();
  renderer.render(render_pass, scene);
}

init();