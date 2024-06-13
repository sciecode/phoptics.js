import {
  Engine, Mesh, RenderList, Shader, Buffer, Sampler, Geometry, Material, Texture, CanvasTexture,
  RenderPass, DynamicLayout, RenderTarget, StructuredBuffer, Format
} from 'phoptics';
import { Vec3, Vec4, Mat3x4, Mat4x4 } from 'phoptics/math';
import { Orbit } from 'phoptics/utils/modules/controls/orbit.mjs';
import { KTXLoader } from 'phoptics/utils/loaders/ktx_loader.mjs';

import luminance_shader from "../shaders/luminance_shader.mjs";

const dpr = window.devicePixelRatio;
let viewport = { width: window.innerWidth * dpr | 0, height: window.innerHeight * dpr | 0 };
let engine, canvas_texture, render_pass, render_target, scene, camera, orbit;

(async () => {
  engine = new Engine(await Engine.acquire_device());

  canvas_texture = new CanvasTexture({ format: Engine.canvas_format() });
  canvas_texture.set_size(viewport);
  document.body.append(canvas_texture.canvas);

  camera = new StructuredBuffer([
    { name: "projection", type: Mat4x4 },
    { name: "view", type: Mat3x4 },
    { name: "position", type: Vec4 },
    { name: "luma", type: Vec4 },
  ]);

  render_pass = new RenderPass({
    multisampled: true,
    formats: {
      color: [canvas_texture.format],
      depth: Format.DEPTH32,
    },
    bindings: [{ binding: 0, name: "camera", resource: camera }]
  });

  const multisampled_texture = new Texture({ size: viewport, format: canvas_texture.format, multisampled: true });
  const depth_texture = new Texture({ size: viewport, format: render_pass.formats.depth, multisampled: true });

  render_target = new RenderTarget({
    color: [{
      view: multisampled_texture.create_view(),
      resolve: canvas_texture.create_view(),
      clear: [.05, .05, .05, 0]
    }],
    depth: { view: depth_texture.create_view(), clear: 0 }
  });

  render_pass.set_render_target(render_target);

  orbit = new Orbit(canvas_texture.canvas);
  orbit.position.set(0, 0, 2.5);
  orbit.update();
  camera.luma.set(250, 8);
  camera.projection.perspective(Math.PI / 3, viewport.width / viewport.height, 1, 300);

  const shader = new Shader({ code: luminance_shader });
  const transform_layout = new DynamicLayout([{ name: "world", type: Mat3x4 }]);

  const geometry = new Geometry({
    draw: { count: 6 },
    attributes: [
      new Buffer({
        data: new Float32Array([
          1, 1, 0,
          -1, 1, 0,
          1, -1, 0,
          -1, 1, 0,
          -1, -1, 0,
          1, -1, 0,
        ]),
        stride: 12,
      })
    ]
  });

  const loader = new KTXLoader();

  console.time("ktx");
  const { textures, header } = await loader.load('../textures/cerberus/normal.ktx2');
  console.timeEnd("ktx");

  console.log(header);

  const bc7 = new Texture({
    size: header.size,
    format: header.format,
    usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
  });

  engine.upload_texture(bc7, textures[0]);

  const mat = new Material({
    shader: shader,
    dynamic: transform_layout,
    vertex: [
      {
        arrayStride: 12,
        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }]
      }
    ],
    bindings: [
      {
        binding: 0, name: "sampler", resource: new Sampler({
          filtering: { mag: "linear", min: "linear" },
        })
      },
      { binding: 1, name: "luminance", resource: bc7.create_view({ dimension: "2d", baseArrayLayer: 0 }) },
    ],
  });

  scene = new RenderList();
  const pos = new Vec3();
  const mesh = new Mesh(geometry, mat);

  pos.set(0, 0, 0);
  mesh.dynamic.world.translate(pos);
  scene.add(mesh);

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

  camera.position.copy(orbit.position);
  camera.view.copy(orbit.view);
  camera.update();

  auto_resize();

  engine.render(render_pass, scene);
}