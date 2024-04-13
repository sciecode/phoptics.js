import { ResourceType } from "../constants.mjs";

export class CanvasTexture {
  constructor(device, options = {}) {
    this.type = ResourceType.CanvasTexture;
    this.canvas = options.canvas;
    this.context = this.canvas.getContext('webgpu');
   
    this.context.configure({
      device: device,
      format: navigator.gpu.getPreferredCanvasFormat()
    });
  }

  set_size(size) {
    this.canvas.width = size.width;
    this.canvas.height = size.height;
  }

  get_view(descriptor) {
    return this.context.getCurrentTexture().createView(descriptor);
  }
}