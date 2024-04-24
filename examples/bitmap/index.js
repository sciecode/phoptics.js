import { Renderer } from "../../src/renderer/renderer.mjs";
import { RenderPass } from "../../src/renderer/objects/render_pass.mjs";
import { RenderTarget } from "../../src/renderer/objects/render_target.mjs";
import { CanvasTexture } from "../../src/renderer/objects/canvas_texture.mjs";
import { Mesh } from "../../src/renderer/objects/mesh.mjs";
import { Shader } from "../../src/renderer/objects/shader.mjs";
import { Material } from "../../src/renderer/objects/material.mjs";

import texture_shader from "../shaders/texture_shader.mjs";
import { Texture } from "../../src/renderer/objects/texture.mjs";
import { Sampler } from "../../src/renderer/objects/sampler.mjs";

let renderer, canvas, scene;
let render_pass, render_target;

const dpr = window.devicePixelRatio;
let viewport = {x: window.innerWidth * dpr | 0, y: window.innerHeight * dpr | 0};

const init = async () => {
  renderer = new Renderer(await Renderer.acquire_device());

  const canvas_texture = new CanvasTexture();
  canvas_texture.set_size({ width: viewport.x, height: viewport.y });
  canvas = canvas_texture.canvas;
  document.body.append(canvas);

  const tex = new Texture({
    size: { width: 1, height: 1 },
    format: "rgba8unorm",
  });

  render_pass = new RenderPass({
    formats: {
      color: [navigator.gpu.getPreferredCanvasFormat()],
    },
    bindings: [
      { binding: 0, name: "tex", resource: tex },
      { binding: 1, name: "sampler", resource: new Sampler() },
    ]
  });

  const tex_cache = renderer.cache.get_texture(tex);
  const gpu_tex = renderer.backend.resources.get_texture(tex_cache.bid).texture;
  renderer.backend.device.queue.writeTexture(
    { texture: gpu_tex },
    new Uint8Array([128, 128, 128, 255]),
    {}, { width: 1, height: 1 }
  );

  render_target = new RenderTarget({
    pass: render_pass,
    size: { width: viewport.x, height: viewport.y },
    color: [ 
      { texture: canvas_texture, clear: [.05, .05, .05, 1] }
    ],
  });

  render_pass.set_render_target(render_target);

  const material = new Material({
    shader: new Shader({code: texture_shader}),
  });

  const full_quad = new Mesh({
    index: -1 >>> 0,
    count: 3,
    index_offset: -1,
    vertex_offset: 0,
    attributes: []
  }, material);
  scene = [full_quad];

  animate();
}

init();

const auto_resize = () => {
  const dpr = window.devicePixelRatio;
  const newW = (canvas.clientWidth * dpr) | 0;
  const newH = (canvas.clientHeight * dpr) | 0;
  
  if (viewport.x != newW || viewport.y != newH) {
    viewport.x = newW; viewport.y = newH;
    render_target.set_size({ width: newW, height: newH });
  }
}

const animate = () => {
  requestAnimationFrame(animate);

  auto_resize();
  renderer.render(render_pass, scene);
}