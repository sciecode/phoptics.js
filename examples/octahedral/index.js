import {
  Engine, Mesh, RenderList, Shader, Buffer, Sampler, Geometry, Material, Texture, CanvasTexture,
  RenderPass, DynamicLayout, RenderTarget, StructuredBuffer, Format
} from 'phoptics';
import { Vec3, Vec4, Mat3x4, Mat4x4 } from 'phoptics/math';
import { Orbit } from 'phoptics/utils/modules/controls/orbit.mjs';

import luminance_shader from "../shaders/luminance_shader.mjs";
import octahedral_shader from "../shaders/octahedral_shader.mjs";

const urls = [
  "../textures/rh_cubemap/px.jpg",
  "../textures/rh_cubemap/nx.jpg",
  "../textures/rh_cubemap/py.jpg",
  "../textures/rh_cubemap/ny.jpg",
  "../textures/rh_cubemap/nz.jpg",
  "../textures/rh_cubemap/pz.jpg",
];

const load_bitmap = (url) => fetch(url).then(resp => resp.blob()).then(blob => createImageBitmap(blob));

const dpr = window.devicePixelRatio;
let viewport = { width: window.innerWidth * dpr | 0, height: window.innerHeight * dpr | 0 };
let engine, canvas_texture, render_pass, render_target, scene, camera, orbit;

const create_octahedral_envmap = async (engine) => {
  const bitmaps = await Promise.all(urls.map(e => load_bitmap(e)));
  const original = new Texture({ size: { width: 1024, height: 1024, depth: 6 }, format: Format.RGBA8_UNORM });
  for (let i = 0; i < bitmaps.length; i++) engine.upload_texture(original, bitmaps[i], { target_origin: [0, 0, i] });
  
  const oct_envmap = new Texture({ size: { width: 512, height: 512 }, format: Format.RGBA16_FLOAT });
  const globals = new StructuredBuffer([{ name: "info", type: Vec4 }]);
  
  const render_pass = new RenderPass({
    formats: { color: [oct_envmap.format] },
    bindings: [
      { binding: 0, name: "sampler", resource: new Sampler({ filtering: { min: "linear", mag: "linear" } }) },
      { binding: 1, name: "cube", resource: original.create_view({ dimension: "cube" }) },
      { binding: 2, name: "globals", resource: globals }
    ]
  });
  const render_target = new RenderTarget({
    color: [{ view: oct_envmap.create_view() }],
  });

  globals.info.x = 512;
  globals.info.y = 16;

  const scene = new RenderList();
  const quad = new Mesh(
    new Geometry({ draw: { count: 3 } }),
    new Material({ shader: new Shader({ code: octahedral_shader }) })
  );
  scene.add(quad);

  render_pass.set_render_target(render_target);

  engine.render(render_pass, scene);

  original.destroy();

  return oct_envmap;
}

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
  camera.projection.perspective(Math.PI / 3, viewport.width / viewport.height, .1, 30);

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

  const oct_envmap = await create_octahedral_envmap(engine);

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
      { binding: 1, name: "luminance", resource: oct_envmap.create_view({ dimension: "2d", baseArrayLayer: 0 }) },
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

    camera.projection.perspective(Math.PI / 3, viewport.width / viewport.height, .1, 30);
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