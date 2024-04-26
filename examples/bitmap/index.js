import { Renderer } from "../../src/renderer/renderer.mjs";
import { RenderPass } from "../../src/renderer/objects/render_pass.mjs";
import { RenderTarget } from "../../src/renderer/objects/render_target.mjs";
import { CanvasTexture } from "../../src/renderer/objects/canvas_texture.mjs";
import { Mesh } from "../../src/renderer/objects/mesh.mjs";
import { Shader } from "../../src/renderer/objects/shader.mjs";
import { Material } from "../../src/renderer/objects/material.mjs";
import { Sampler } from "../../src/renderer/objects/sampler.mjs";
import { Texture } from "../../src/renderer/objects/texture.mjs";

import bitmap_shader from "../shaders/bitmap_shader.mjs";

let renderer, canvas, scene;
let render_pass, render_target;

const dpr = window.devicePixelRatio;
let viewport = {x: window.innerWidth * dpr | 0, y: window.innerHeight * dpr | 0};

const init = async (bitmap) => {
  renderer = new Renderer(await Renderer.acquire_device());

  const canvas_texture = new CanvasTexture();
  canvas_texture.set_size({ width: viewport.x, height: viewport.y });
  canvas = canvas_texture.canvas;
  document.body.append(canvas);

  const tex1 = new Texture({
    size: { width: 2, height: 1 },
    format: "rgba8unorm",
  });

  const data_tex = renderer.cache.get_texture(tex1);
  const data_gpu = renderer.backend.resources.get_texture(data_tex.bid).texture;
  renderer.backend.device.queue.writeTexture(
    { texture: data_gpu },
    new Uint8Array([
      255, 0, 0, 255,
      0, 128 * 64./255, 0, 64
    ]),
    {},
    tex1.size,
  );

  const tex2 = new Texture({
    size: { width: 2, height: 1 },
    format: "rgba8unorm-srgb",
  });

  const srgb_tex = renderer.cache.get_texture(tex2);
  const srgb_gpu = renderer.backend.resources.get_texture(srgb_tex.bid).texture;
  renderer.backend.device.queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture: srgb_gpu, premultipliedAlpha: true },
    { width: bitmap.width, height: bitmap.height },
  );

  const tex3 = new Texture({
    size: { width: 2, height: 1 },
    format: "rgba8unorm-srgb",
  });

  const ext_tex = renderer.cache.get_texture(tex3);
  const ext_gpu = renderer.backend.resources.get_texture(ext_tex.bid).texture;
  renderer.backend.device.queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture: ext_gpu, premultipliedAlpha: false },
    { width: bitmap.width, height: bitmap.height },
  );

  render_pass = new RenderPass({
    formats: {
      color: [navigator.gpu.getPreferredCanvasFormat()],
    },
    bindings: [
      { binding: 0, name: "sampler", resource: new Sampler( {
        filtering: { mag: "linear", min: "nearest" },
      } ) },
      { binding: 1, name: "data_tex", resource: tex1 },
      { binding: 2, name: "srgb_tex", resource: tex2 },
      { binding: 3, name: "ext_tex", resource: tex3 },
    ]
  });

  render_target = new RenderTarget({
    pass: render_pass,
    size: { width: viewport.x, height: viewport.y },
    color: [ 
      { texture: canvas_texture, clear: [.5, .5, .5, 1] }
    ],
  });

  render_pass.set_render_target(render_target);

  const material = new Material({
    shader: new Shader({code: bitmap_shader}),
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

(async function loadImageBitmap(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  init(await createImageBitmap(blob, { premultiplyAlpha: 'none' }));
})('../textures/2px.png');

// init();