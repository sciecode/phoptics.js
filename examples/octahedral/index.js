import {
  Engine, Mesh, RenderList, Shader, Sampler, Geometry, Material, Texture, CanvasTexture,
  RenderPass, RenderTarget, StructuredBuffer, Format
} from 'phoptics';
import { Vec4, Mat3x4, Mat4x4 } from 'phoptics/math';
import { Orbit } from 'phoptics/utils/modules/controls/orbit.mjs';
import { SkyboxGeometry } from 'phoptics/utils/objects/skybox.mjs';

import skybox_oct_shader from '../shaders/skybox_oct_shader.mjs';
import octahedral_encode_shader from "../shaders/octahedral_encode_shader.mjs";
import filtering_shader from '../shaders/filtering_shader.mjs';

const urls = [
  "../textures/lh_cubemap/bridge_px.jpg",
  "../textures/lh_cubemap/bridge_nx.jpg",
  "../textures/lh_cubemap/bridge_py.jpg",
  "../textures/lh_cubemap/bridge_ny.jpg",
  "../textures/lh_cubemap/bridge_pz.jpg",
  "../textures/lh_cubemap/bridge_nz.jpg",
];

const load_bitmap = (url) => fetch(url).then(resp => resp.blob()).then(blob => createImageBitmap(blob));

const dpr = window.devicePixelRatio;
let viewport = { width: window.innerWidth * dpr | 0, height: window.innerHeight * dpr | 0 };
let engine, canvas_texture, render_pass, render_target, scene, camera, orbit;

const generate_pmlm = (engine, cubemap) => {
  const tex_size = 256, mips = Texture.max_mip_levels(tex_size) - 4; // 32x32 lowest mip
  const pmlm = new Texture({
    format: cubemap.format,
    size: { width: tex_size, height: tex_size, depth: 6 },
    mip_levels: mips,
  });

  const globals = new StructuredBuffer([{ name: "info", type: Vec4 }]);

  const render_pass = new RenderPass({
    formats: { color: [cubemap.format] },
    bindings: [
      { binding: 0, name: "sampler", resource: new Sampler({ filtering: { min: "linear", mag: "linear", mip: "linear" } }) },
      { binding: 1, name: "cube", resource: cubemap.create_view({ dimension: "cube"}) },
      { binding: 2, name: "globals", resource: globals }
    ]
  });

  const render_target = new RenderTarget({ color: [{ view: undefined, clear: [.0, .0, .0, 0] }] });
  render_pass.set_render_target(render_target);

  scene = new RenderList();
  const quad = new Mesh(
    new Geometry({ draw: { count: 3 } }),
    new Material({ shader: new Shader({ code: filtering_shader }) })
  );
  scene.add(quad);

  const sample_count = 1024;
  // mips
  for (let m = 0; m < mips; m++) {
    const roughness = m / (mips - 1);
    for (let i = 0; i < 6; i++) {
      globals.info.set(i, roughness, sample_count, tex_size); // face / lod
      globals.update();
      render_target.color[0].view = pmlm.create_view({
        dimension: "2d",
        arrayLayerCount: 1,
        mipLevelCount: 1,
        baseArrayLayer: i,
        baseMipLevel: m,
      })

      engine.render(render_pass, scene);
    }
  }

  globals.destroy();
  quad.geometry.destroy();
  quad.geometry.destroy();
  cubemap.destroy();

  return pmlm;
}

const create_octahedral_envmap = async (engine, pmlm) => {
  const mips = pmlm.mip_levels, size = pmlm.size.width, border = 1 << (mips - 1);

  const oct_envmap = new Texture({ 
    mip_levels: mips,
    size: { width: size, height: size }, 
    format: Format.RGBA16_FLOAT,
  });
  
  const render_pass = new RenderPass({ formats: { color: [oct_envmap.format] } });
  const render_target = new RenderTarget({ color: [{ view: undefined }] });
  render_pass.set_render_target(render_target);

  const outset = border / size, scale = size / (size - 2 * border);
  const dim = new StructuredBuffer([{ name: "mapping", type: Vec4 }]);
  
  const quad = new Mesh(
    new Geometry({ draw: { count: 3 } }),
    new Material({ 
      shader: new Shader({ code: octahedral_encode_shader }),
      bindings: [
        { binding: 0, name: "sampler", resource: new Sampler({ filtering: { min: "linear", mag: "linear", mip: "linear" } }) },
        { binding: 1, name: "cube", resource: pmlm.create_view({ dimension: "cube" }) },
        { binding: 2, name: "dim", resource: dim }
      ]
    })
  );

  const scene = new RenderList();
  scene.add(quad);

  // mips
  for (let m = 0; m < mips; m++) {
    dim.mapping.set(outset, scale, m);
    dim.update();
    render_target.color[0].view = oct_envmap.create_view({
      dimension: "2d",
      mipLevelCount: 1,
      baseMipLevel: m,
    })
    engine.render(render_pass, scene);
  }

  dim.destroy();
  quad.geometry.destroy();
  quad.geometry.destroy();
  pmlm.destroy();

  return { tex: oct_envmap, info: { outset, scale } };
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
  camera.luma.set(250, 9);
  camera.projection.perspective(Math.PI / 3, viewport.width / viewport.height, .1, 30);

  // load cubemap & pre-convolve mipmaps
  const bitmaps = await Promise.all(urls.map(e => load_bitmap(e)));
  const original = new Texture({ size: { width: 1024, height: 1024, depth: 6 }, format: Format.RGBA8_UNORM });
  for (let i = 0; i < bitmaps.length; i++) engine.upload_texture(original, bitmaps[i], { target_origin: [0, 0, i] });
  const pmlm = await generate_pmlm(engine, original);

  // encode octahedral mipmaps
  const { tex: oct_envmap, info } = await create_octahedral_envmap(engine, pmlm);
  const dim = new StructuredBuffer([{ name: "mapping", type: Vec4 }]);
  dim.mapping.set(info.outset, info.scale, .8);

  const skybox = new Mesh(
    new SkyboxGeometry(),
    new Material({
      shader: new Shader({ code: skybox_oct_shader }),
      graphics: { depth: { write: false } },
      vertex: [
        { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }
      ],
      bindings: [
        { binding: 0, name: "sampler", resource: new Sampler({ filtering: { min: "linear", mag: "linear", mip: "linear" } }) },
        { binding: 1, name: "cubemap", resource: oct_envmap.create_view() },
        { binding: 2, name: "dim", resource: dim }
      ]
    })
  );

  scene = new RenderList();
  scene.add(skybox);

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