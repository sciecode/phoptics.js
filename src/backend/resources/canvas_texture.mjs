export class CanvasTexture {
  constructor(device, options = {}) {
    this.canvas = options.canvas;
    this.context = this.canvas.getContext('webgpu');
    
    this.context.configure({
      device: device,
      format: navigator.gpu.getPreferredCanvasFormat()
    });
  }

  get_view(descriptor) {
    return this.context.getCurrentTexture().createView(descriptor);
  }

  destroy() {}
}