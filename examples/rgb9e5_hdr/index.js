import { Engine, Mesh, RenderList, Shader, Buffer, Sampler, Geometry, Material, Texture, CanvasTexture,
  RenderPass, DynamicLayout, RenderTarget, StructuredBuffer } from 'phoptics';
import { Vec3, Vec4, Mat3x4, Mat4x4 } from 'phoptics/math';
import { Orbit } from 'phoptics/utils/modules/controls/orbit.mjs';
import { encode_rgb9e5 } from 'phoptics/utils/data/encoder.mjs';
import { EXRLoader } from 'phoptics/utils/loaders/exr_loader.mjs';

import luminance_shader from "../shaders/luminance_shader.mjs";

const dpr = window.devicePixelRatio;
let viewport = { width: window.innerWidth * dpr | 0, height: window.innerHeight * dpr | 0 };
let engine, canvas_texture, render_pass, render_target, scene, camera, orbit;

const create_luminance_map = (engine) => {
  const tex_size = 256, boost = 200, mask = tex_size - 1;
  const data = new Float32Array(4 * tex_size * tex_size);
  for (let i = 0; i < tex_size; i++) {
    for (let j = 0; j < tex_size; j++) {
      const i4 = i * (tex_size * 4) + j * 4;
      data[i4] = j / mask * boost;
      data[i4+1] = (mask - i) / mask * boost;
    }
  }

  const hdr = new Texture({
    size: { width: tex_size, height: tex_size },
    format: "rgba32float",
  });

  engine.upload_texture(hdr, data);

  const rgb9e5 = new Texture({
    size: { width: tex_size, height: tex_size },
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    format: "rgb9e5ufloat",
  });

  const vec = new Vec3();
  const encoded = new Uint32Array(tex_size * tex_size);
  for (let i = 0; i < tex_size; i++) {
    for (let j = 0; j < tex_size; j++) {
      vec.from(data, i * (tex_size * 4) + j * 4);
      encoded[i * tex_size + j] = encode_rgb9e5(vec);
    }
  }

  engine.upload_texture(rgb9e5, encoded);

  return { hdr, rgb9e5: rgb9e5 };
}

(async () => {
  engine = new Engine(await Engine.acquire_device());

  canvas_texture = new CanvasTexture({ format: navigator.gpu.getPreferredCanvasFormat() });
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
      depth: "depth32float",
    },
    bindings: [{ binding: 0,  name: "camera", resource: camera }]
  });

  const multisampled_texture = new Texture({ size: viewport, format: canvas_texture.format, multisampled: true });
  const depth_texture = new Texture({ size: viewport, format: render_pass.formats.depth, multisampled: true });
  
  render_target = new RenderTarget({
    color: [ { 
      view: multisampled_texture.create_view(), 
      resolve: canvas_texture.create_view(), 
      clear: [.05, .05, .05, 0]
    } ],
    depth: { view: depth_texture.create_view(), clear: 0 }
  });

  render_pass.set_render_target(render_target);

  orbit = new Orbit(canvas_texture.canvas);
  orbit.position.set(0, 0, 4);
  orbit.update();
  camera.luma.set(250, 1);
  camera.projection.perspective(Math.PI / 3, viewport.width / viewport.height, 1, 300);

  const shader = new Shader({ code: luminance_shader });
  const transform_layout = new DynamicLayout([{ name: "world", type: Mat3x4 }]);

  const {hdr, rgb9e5} = create_luminance_map(engine)

  const geometry = new Geometry({
    draw: { count: 6 },
    attributes: [
      new Buffer({
        data: new Float32Array([
          1,  1, 0,
         -1,  1, 0,
          1, -1, 0,
         -1,  1, 0,
         -1, -1, 0,
          1, -1, 0,
        ]),
        stride: 12,
      })
    ]
  });

  const mat0 = new Material({
    shader: shader,
    dynamic: transform_layout,
    vertex: [
      {
        arrayStride: 12, 
        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }]
      }
    ],
    bindings: [
      { binding: 0, name: "sampler", resource: new Sampler({
        filtering: { mag: "linear", min: "linear" },
      }) },
      { binding: 1, name: "luminance", resource: hdr.create_view() },
    ],
  });

  const mat1 = new Material({
    shader: shader,
    dynamic: transform_layout,
    vertex: [
      {
        arrayStride: 12, 
        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }]
      }
    ],
    bindings: [
      { binding: 0, name: "sampler", resource: new Sampler({
        filtering: { mag: "linear", min: "linear" },
      }) },
      { binding: 1, name: "luminance", resource: rgb9e5.create_view() },
    ],
  });

  const pos = new Vec3();
  scene = new RenderList();
  const mesh0 = new Mesh(geometry, mat0);
  const mesh1 = new Mesh(geometry, mat1);

  pos.set(-1.2, 0, 0);
  mesh0.dynamic.world.translate(pos);
  scene.add(mesh0);

  pos.set(1.2, 0, 0);
  mesh1.dynamic.world.translate(pos);
  scene.add(mesh1);

  const exr = await (new EXRLoader(true)).load('../textures/hdr/blobbies.exr');
  console.log(exr);

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