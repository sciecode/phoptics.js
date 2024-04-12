import { GPUBackend } from "../../backend/gpu_backend.mjs"
import { DrawStream } from "../common/draw_stream.mjs";

export class ForwardRenderer {
  constructor(adapter, device) {
    this.backend = new GPUBackend(adapter, device);
    this.draw_stream = new DrawStream();
  }
}