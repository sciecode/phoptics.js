import { Renderer } from "../../src/renderer/renderer.mjs";
import { RenderPass } from "../../src/renderer/objects/render_pass.mjs";
import { RenderTarget } from "../../src/renderer/objects/render_target.mjs";
import { ResourceType } from "../../src/renderer/constants.mjs";
import { CanvasTexture } from "../../src/renderer/objects/canvas_texture.mjs";
import { Mesh } from "../../src/renderer/objects/mesh.mjs";
import { Shader } from "../../src/renderer/objects/shader.mjs";
import { Material } from "../../src/renderer/objects/material.mjs";
import { Texture } from "../../src/renderer/objects/texture.mjs";

import bitmap_shader from "../shaders/bitmap_shader.mjs";

let render_pass, render_target, renderer, canvas_texture, scene;

const dpr = window.devicePixelRatio;
let viewport = {x: window.innerWidth * dpr | 0, y: window.innerHeight * dpr | 0};

const init = async (bitmap, uint8) => {
  renderer = new Renderer(await Renderer.acquire_device());

  canvas_texture = new CanvasTexture({ format: navigator.gpu.getPreferredCanvasFormat() });
  canvas_texture.set_size({ width: viewport.x, height: viewport.y });
  document.body.append(canvas_texture.canvas);

  const tex1 = new Texture({
    size: { width: 2, height: 1 },
    format: "rgba32float",
  });

  const data = new Float32Array(uint8.length);
  for (let i = 0, il = data.length/4; i < il; i++) {
    const i4 = i * 4, as = uint8[i4 + 3] / 255;
    data[i4 + 0] = process_pixel(uint8[i4 + 0], as);
    data[i4 + 1] = process_pixel(uint8[i4 + 1], as);
    data[i4 + 2] = process_pixel(uint8[i4 + 2], as);
    data[i4 + 3] = as;
  }

  const data_tex = renderer.cache.get_texture(tex1);
  const data_gpu = renderer.backend.resources.get_texture(data_tex.bid).texture;
  renderer.backend.device.queue.writeTexture( { texture: data_gpu }, data, {}, tex1.size );

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
    format: "rgba8unorm",
  });

  const ext_tex = renderer.cache.get_texture(tex3);
  const ext_gpu = renderer.backend.resources.get_texture(ext_tex.bid).texture;
  renderer.backend.device.queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture: ext_gpu, premultipliedAlpha: true },
    { width: bitmap.width, height: bitmap.height },
  );

  render_pass = new RenderPass({
    formats: { color: [canvas_texture.format] },
    bindings: [
      { binding: 0, name: "sampler", type: ResourceType.Sampler, info: { filtering: { mag: "linear", min: "nearest" } } },
      { binding: 1, name: "data_tex", resource: tex1.create_view()  },
      { binding: 2, name: "srgb_tex", resource: tex2.create_view() },
      { binding: 3, name: "ext_tex", resource: tex3.create_view() }
    ]
  });

  render_target = new RenderTarget({
    color: [ { view: canvas_texture.create_view(), clear: [.5, .5, .5, 1] } ],
  });

  render_pass.set_render_target(render_target);

  const material = new Material({
    shader: new Shader({ code: bitmap_shader }),
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
  const newW = (canvas_texture.canvas.clientWidth * dpr) | 0;
  const newH = (canvas_texture.canvas.clientHeight * dpr) | 0;
  
  if (viewport.x != newW || viewport.y != newH) {
    viewport.x = newW; viewport.y = newH;
    canvas_texture.set_size({ width: newW, height: newH });
  }
}

const animate = () => {
  requestAnimationFrame(animate);
  auto_resize();
  renderer.render(render_pass, scene);
}

function SRGBToLinear( c ) { return ( c < 0.04045 ) ? c * 0.0773993808 : Math.pow( c * 0.9478672986 + 0.0521327014, 2.4 ); };
const process_pixel = (value, alpha) => { return (SRGBToLinear(value/255) * alpha); }

(async function loadImageBitmap(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  const arraybuffer = await blob.arrayBuffer();
  const imageBitmap = await createImageBitmap(blob, { premultiplyAlpha: 'none' });
  const info = UPNG.decode(arraybuffer);
  const uint8 = new Uint8Array(UPNG.toRGBA8(info)[0]);
  init(imageBitmap, uint8);
})('../textures/2px.png');