import { GPUBackend } from "../backend/gpu_backend.mjs"
import { DrawStream } from "./common/draw_stream.mjs";
import { Resources } from "./renderer_resources.mjs";

export class Renderer {
  constructor(device) {
    this.backend = new GPUBackend(device);
    this.resources = new Resources(this.backend);
    this.draw_stream = new DrawStream();
  }
}