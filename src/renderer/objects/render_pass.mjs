
export class RenderPass {
  constructor(options) {
   this.formats = options.formats;
   this.multisampled = options.multisampled;
   this.current_target = null;
  }

  set_render_target(target_obj) {
    this.current_target = target_obj;
  }
}