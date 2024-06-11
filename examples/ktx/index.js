import { Engine } from 'phoptics';
import { KTXLoader } from 'phoptics/utils/loaders/ktx_loader.mjs';

(async () => {
  const engine = new Engine(await Engine.acquire_device());

  const loader = new KTXLoader();

  console.time("ktx");
  const t = await loader.load('../textures/ktx/array.ktx2');
  console.timeEnd("ktx");

})();