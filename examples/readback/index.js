import { Engine, Mesh, RenderList, Shader, Sampler, Geometry, Material, Texture, CanvasTexture,
  RenderPass, RenderTarget, StructuredBuffer } from 'phoptics';
import { Vec4, Mat4x4 } from 'phoptics/math';
import { Orbit } from 'phoptics/utils/modules/controls/orbit.mjs';

const dpr = window.devicePixelRatio;
let viewport = { width: window.innerWidth * dpr | 0, height: window.innerHeight * dpr | 0 };
let engine, canvas_texture, render_pass, render_target, scene, camera, orbit, proj = new Mat4x4();

const load_bitmap = (url) => fetch(url).then(resp => resp.blob()).then(blob => createImageBitmap(blob));

(async () => {

  engine = new Engine(await Engine.acquire_device());

  // canvas_texture = new CanvasTexture({ format: navigator.gpu.getPreferredCanvasFormat() });
  // canvas_texture.set_size(viewport);
  // document.body.append(canvas_texture.canvas);

  // camera = new StructuredBuffer([
  //   { name: "inverse", type: Mat4x4 },
  //   { name: "position", type: Vec4 },
  // ]);

  // render_pass = new RenderPass({
  //   formats: {
  //     color: [canvas_texture.format],
  //   },
  //   bindings: [{ binding: 0,  name: "camera", resource: camera }]
  // });
  
  // render_target = new RenderTarget({
  //   color: [ { 
  //     view: canvas_texture.create_view(), 
  //     clear: [.05, .05, .05, 0]
  //   } ],
  // });

  // render_pass.set_render_target(render_target);

  // orbit = new Orbit(canvas_texture.canvas);
  // camera.position.set(0, 0, 50);
  // orbit.update();
  // proj.perspective(Math.PI / 2, viewport.width / viewport.height, 1, 600);
  // camera.inverse.copy(proj).affine(orbit.view).inverse();

  // const background = new Mesh(
  //   new Geometry({ draw: { count: 12 } }),
  //   material
  // );
  // scene = new RenderList();
  // scene.add(background);

  const tex = new Texture({
    size: { width: 2, height: 2 },
    format: "rgba32float"
  });

  const data = new Float32Array([
    1, 0, 0, 1,
    0, 1, 0, 1,
    0, 0, 1, 1,
    1, 1, 1, 0,
  ]);

  console.time("write")
  engine.upload_texture(tex, data);
  console.timeEnd("write")

  const read = new Float32Array(4 * 4);
  console.time("read");
  await engine.read_texture(tex, read);
  console.timeEnd("read");
  console.log(read, data);

  // animate();
})();

const auto_resize = () => {
  const dpr = window.devicePixelRatio;
  const newW = (canvas_texture.canvas.clientWidth * dpr) | 0;
  const newH = (canvas_texture.canvas.clientHeight * dpr) | 0;
  
  if (viewport.width != newW || viewport.height != newH) {
    viewport.width = newW; viewport.height = newH;
    render_target.set_size(viewport);

    proj.perspective(Math.PI / 2, viewport.width / viewport.height, 1, 600);
  }
}

const animate = () => {
  // requestAnimationFrame(animate);

  // camera.position.copy(orbit.position);
  // camera.inverse.copy(proj).affine(orbit.view).inverse();
  // camera.update();

  // auto_resize();

  // engine.render(render_pass, scene);
}