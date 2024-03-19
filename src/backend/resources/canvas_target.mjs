export class CanvasTarget {
  constructor(device, options = {}) {
    this.canvas = options.canvas || document.createElement('canvas');
    this.context = this.canvas.getContext('webgpu');
    this.format = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: device,
      format: this.format
    });

    this.width = this.canvas.width = options.width || 350;
    this.height = this.canvas.height = options.height || 150;
  }

  get_view() {
    return this.context.getCurrentTexture().createView();
  }

  set_size(width, height) {
    this.width = this.canvas.width = width;
    this.height = this.canvas.height = height;
  }
}