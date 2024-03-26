export class CanvasTarget {
  constructor(device, width, height, options = {}) {
    this.canvas = options.canvas || document.createElement('canvas');
    this.context = this.canvas.getContext('webgpu');
    this.format = navigator.gpu.getPreferredCanvasFormat();
    
    this.context.configure({
      device: device,
      format: this.format
    });

    this.width = this.canvas.width = width;
    this.height = this.canvas.height = height;
    
    this.clear = options.clear;
    this.loadOp = options.clear ? 'clear' : 'load';
    this.storeOp = options.store || 'store';
  }

  get_view() {
    return this.context.getCurrentTexture().createView();
  }

  set_size(width, height) {
    this.width = this.canvas.width = width;
    this.height = this.canvas.height = height;
  }

  destroy() {}
}