export class CanvasTexture {
  constructor(device, options = {}) {
    this.canvas = options.canvas;
    this.context = this.canvas.getContext('webgpu');
    this.format = navigator.gpu.getPreferredCanvasFormat();
    
    this.context.configure({
      device: device,
      format: this.format
    });
  }

  get_format() {
    return this.format;
  }

  get_view(descriptor) {
    return this.context.getCurrentTexture().createView(descriptor);
  }

  destroy() {}
}