import { ResourceManager } from "./core/resource_manager.mjs";

export class Engine {
  constructor(adapter, device) {
    this.adapter = adapter;
    this.device = device;
    this.resources = new ResourceManager(this.device);
  }

  render_target(render_pass_handle, shader_handle) {

    const render_pass = this.resources.get_render_pass(render_pass_handle);
    
    let aspect;
    const pass_formats = [];
    const pass_descriptor = render_pass.get_descriptor();
    for (let i = 0, il = pass_descriptor.colorAttachments.length; i < il; i++) {
      const rt = this.resources.get_canvas_target(pass_descriptor.colorAttachments[i].view);
      pass_descriptor.colorAttachments[i].view = rt.get_view();
      pass_formats.push({format: rt.format});
      aspect = rt.width / rt.height;
    }

    const uniformBufferSize = 4;
    const uniformBuffer = this.device.createBuffer({
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const uniformValues = new Float32Array(uniformBufferSize / 4);
    uniformValues[0] = aspect;

    this.device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

    const shader = this.resources.get_shader(shader_handle);

    const pipeline = this.device.createRenderPipeline({
      label: 'triangle pipeline',
      layout: 'auto',
      vertex: {
        module: shader.module,
        entryPoint: shader.vertex_entry,
      },
      fragment: {
        module: shader.module,
        entryPoint: shader.frag_entry,
        targets: pass_formats,
      },
    });

    const bindGroup = this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer }},
      ],
    });
    
    const encoder = this.device.createCommandEncoder({ label: 'pass encoder' });
    const pass = encoder.beginRenderPass(pass_descriptor);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
 
    const commandBuffer = encoder.finish();
    this.device.queue.submit([commandBuffer]);
  }

}