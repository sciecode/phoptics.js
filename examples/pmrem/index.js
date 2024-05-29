import { Engine, Mesh, RenderList, Shader, Sampler, Material, Texture, Geometry, CanvasTexture,
  RenderPass, RenderTarget, StructuredBuffer} from 'phoptics';
import { Vec4 } from 'phoptics/math';

import mipmap_shader from "../shaders/mipmap_shader.mjs";

const dpr = window.devicePixelRatio;
let viewport = { width: window.innerWidth * dpr | 0, height: window.innerHeight * dpr | 0 };
let engine, canvas_texture, render_pass, render_target, scene, globals;

const urls = [
  "../textures/rh_cubemap/px.jpg",
  "../textures/rh_cubemap/nx.jpg",
  "../textures/rh_cubemap/py.jpg",
  "../textures/rh_cubemap/ny.jpg",
  "../textures/rh_cubemap/nz.jpg",
  "../textures/rh_cubemap/pz.jpg",
];

const load_bitmap = (url) => fetch(url).then(resp => resp.blob()).then(blob => createImageBitmap(blob));

const generate_mipmap_cubemap = (engine, original) => {
  const tex_size = 256, mips = Texture.max_mip_levels(tex_size);
  const cubemap = new Texture({
    format: original.format,
    size: { width: tex_size, height: tex_size, depth: 6 },
    mip_levels: mips,
  });

  const render_pass = new RenderPass({
    formats: { color: [original.format] },
    bindings: [
      { binding: 0, name: "sampler", resource: new Sampler({ filtering: { min: "linear", mag: "linear" } }) },
      { binding: 1, name: "cube", resource: original.create_view({ dimension: "cube" }) },
      { binding: 2, name: "globals", resource: globals }
    ]
  });

  const render_target = new RenderTarget({
    color: [{ view: undefined, clear: [.0, .0, .0, 0] }],
  });

  render_pass.set_render_target(render_target);

  scene = new RenderList();
  const quad = new Mesh(
    new Geometry({ draw: { count: 3 } }),
    new Material({ shader: new Shader({ code: mipmap_shader }) })
  );
  scene.add(quad);

  // base mip
  for (let i = 0; i < 6; i++) {
    globals.info.set(i, 0); // face / lod
    globals.update();
    render_target.color[0].view = cubemap.create_view({
      dimension: "2d",
      arrayLayerCount: 1,
      mipLevelCount: 1,
      baseArrayLayer: i,
      baseMipLevel: 0,
    })

    engine.render(render_pass, scene);
  }

  // mips
  for (let m = 1; m < mips; m++) {
    render_pass.bindings.cube = cubemap.create_view({
      dimension: "cube",
      mipLevelCount: 1,
      baseMipLevel: m-1,
    });
    render_pass.bindings.update();
    for (let i = 0; i < 6; i++) {
      globals.info.set(i, m-1); // face / lod
      globals.update();
      render_target.color[0].view = cubemap.create_view({
        dimension: "2d",
        arrayLayerCount: 1,
        mipLevelCount: 1,
        baseArrayLayer: i,
        baseMipLevel: m,
      })

      engine.render(render_pass, scene);
    }
  }

  return cubemap;
}

(async () => {
  engine = new Engine(await Engine.acquire_device());

  canvas_texture = new CanvasTexture({ format: navigator.gpu.getPreferredCanvasFormat() });
  canvas_texture.set_size(viewport);
  document.body.append(canvas_texture.canvas);

  globals = new StructuredBuffer([{ name: "info", type: Vec4 }]);

  const bitmaps = await Promise.all(urls.map(e => load_bitmap(e)));
  const original = new Texture({ size: { width: 1024, height: 1024, depth: 6 }, format: "rgba8unorm-srgb" });
  for (let i = 0; i < bitmaps.length; i++) engine.upload_texture(original, bitmaps[i], { target_origin: [0, 0, i] });

  const cubemap = generate_mipmap_cubemap(engine, original);

  original.destroy();

  render_pass = new RenderPass({
    formats: {
      color: [canvas_texture.format],
    },
    bindings: [
      { binding: 0, name: "sampler", resource: new Sampler({ filtering: { min: "linear", mag: "linear" } }) },
      { binding: 1, name: "cube", resource: cubemap.create_view({ dimension: "cube" }) },
      { binding: 2, name: "globals", resource: globals }
    ]
  });
  
  render_target = new RenderTarget({
    color: [ { 
      view: canvas_texture.create_view(), 
      clear: [.0, .0, .0, 0]
    } ],
  });

  render_pass.set_render_target(render_target);
  globals.info.set(5, 0);
  globals.update();

  scene = new RenderList();
  const quad = new Mesh(
    new Geometry({ draw: { count: 3 } }),
    new Material({
      shader: new Shader({ code: mipmap_shader }),
    })
  );
  scene.add(quad);

  animate();
})();

const auto_resize = () => {
  const dpr = window.devicePixelRatio;
  const newW = (canvas_texture.canvas.clientWidth * dpr) | 0;
  const newH = (canvas_texture.canvas.clientHeight * dpr) | 0;
  
  if (viewport.width != newW || viewport.height != newH) {
    viewport.width = newW; viewport.height = newH;
    render_target.set_size(viewport);
  }
}

const animate = () => {
  requestAnimationFrame(animate);

  auto_resize();

  engine.render(render_pass, scene);
}