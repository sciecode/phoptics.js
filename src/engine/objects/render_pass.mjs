import { Bindings } from "./bindings.mjs";

export class RenderPass {
  constructor(options) {
    this.formats = options.formats;
    this.multisampled = options.multisampled;
    this.bindings = options.bindings ? new Bindings(options.bindings) : undefined;
    this.current_target = null;
  }

  set_render_target(target_obj) {
    this.current_target = target_obj;
  }

  destroy() { this.bindings?.destroy(); }
}