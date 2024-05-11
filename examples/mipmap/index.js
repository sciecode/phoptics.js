import { Renderer } from "../../src/renderer/renderer.mjs";
import { RenderPass } from "../../src/renderer/objects/render_pass.mjs";
import { RenderTarget } from "../../src/renderer/objects/render_target.mjs";
import { CanvasTexture } from "../../src/renderer/objects/canvas_texture.mjs";
import { StructuredBuffer } from "../../src/renderer/objects/structured_buffer.mjs";
import { Queue } from "../../src/renderer/objects/queue.mjs";
import { Mesh } from "../../src/renderer/objects/mesh.mjs";
import { Shader } from "../../src/renderer/objects/shader.mjs";
import { Sampler } from "../../src/renderer/objects/sampler.mjs";
import { Texture } from "../../src/renderer/objects/texture.mjs";
import { Material } from "../../src/renderer/objects/material.mjs";
import { Geometry } from "../../src/renderer/objects/geometry.mjs";

import { Vec3 } from "../../src/datatypes/vec3.mjs";
import { Vec4 } from "../../src/datatypes/vec4.mjs";
import { Mat3x4 } from "../../src/datatypes/mat34.mjs";
import { Mat4x4 } from "../../src/datatypes/mat44.mjs";
import mipmap_shader from "../shaders/mipmap_shader.mjs";

const dpr = window.devicePixelRatio;
let viewport = {x: window.innerWidth * dpr | 0, y: window.innerHeight * dpr | 0};
let render_pass, render_target, renderer, canvas_texture, scene, camera, quad;

const init = async () => {
  renderer = new Renderer(await Renderer.acquire_device());

  canvas_texture = new CanvasTexture({ format: navigator.gpu.getPreferredCanvasFormat() });
  canvas_texture.set_size({ width: viewport.x, height: viewport.y });
  document.body.append(canvas_texture.canvas);

  const tex_size = 1024;
  const mipmap = new Texture({ 
    size: { width: tex_size, height: tex_size}, 
    format: "rgba32float",
    mip_levels: Texture.max_mip_levels(tex_size),
  });

  const multisampled_texture = new Texture({
    multisampled: true,
    size: { width: viewport.x, height: viewport.y },
    format: canvas_texture.format,
  });

  populate_mipmap_texture(mipmap);

  camera = new StructuredBuffer([
    { name: "projection", type: Mat4x4 }, 
    { name: "view", type: Mat3x4 }, 
    { name: "position", type: Vec4 }, 
  ]);
  
  render_pass = new RenderPass({
    multisampled: true,
    formats: { color: [canvas_texture.format] },
    bindings: [{ binding: 0,  name: "camera", resource: camera }]
  });

  const target = new Vec3();
  target.set(0, -1, 0);
  camera.position.set(0, 0, 4, 0);
  camera.projection.perspective(Math.PI / 2.5, window.innerWidth / window.innerHeight, 1, 610);
  camera.view.translate(camera.position).look_at(target).view_inverse();
  camera.update();

  render_target = new RenderTarget({
    color: [ {
      view: multisampled_texture.create_view(), 
      resolve: canvas_texture.create_view(),
      clear: [.25, .25, .25, 1] 
    } ],
  });

  render_pass.set_render_target(render_target);

  const material = new Material({
    shader: new Shader({ code: mipmap_shader }),
    bindings: [
      { binding: 0, name: "sampler", resource: new Sampler({
        filtering: { mag: "linear", min: "linear", mipmap: "linear" } 
      }) },
      { binding: 1, name: "mipmap", resource: mipmap.create_view() },
    ],
  });

  quad = new Mesh(
    new Geometry({ count: 6 }),
    material
  );
  scene = new Queue();
  scene.add(quad);

  animate();
}

const populate_mipmap_texture = (tex) => {
  const info = [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1];

  for (let i = 0; i < tex.mip_levels; i++) {
    const size = Math.max(1, tex.size.width >> i);
    const tot = size * size * 4;
    const data = new Float32Array(tot);
    const e = i % 3, e4 = e * 4;
    for (let j = 0; j < tot; j += 4) {
      data[j + 0] = info[e4 + 0];
      data[j + 1] = info[e4 + 1];
      data[j + 2] = info[e4 + 2];
      data[j + 3] = info[e4 + 3];
    }
    tex.upload_data({ data: data, bytes: 16, mip_level: i });
  }
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

  auto_resize();
  renderer.render(render_pass, scene);
}

init();