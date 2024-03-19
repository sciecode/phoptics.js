import { ResourceManager } from "./resource_manager.mjs";

export class GPUBackend {
  constructor(adapter, device) {
    this.adapter = adapter;
    this.device = device;
    this.resources = new ResourceManager(this.device);
  }

  render_target(render_pass_handle, shader_handle) {

    const { descriptor, formats } = this.resources
      .get_render_pass(render_pass_handle)
      .get_render_info(this.resources);
    
    // let aspect;
    // const pass_formats = [];
    // const pass_descriptor = render_pass.get_descriptor();
    // for (let i = 0, il = pass_descriptor.colorAttachments.length; i < il; i++) {
    //   const rt = this.resources.get_canvas_target(pass_descriptor.colorAttachments[i].view);
    //   pass_descriptor.colorAttachments[i].view = rt.get_view();
    //   pass_formats.push({format: rt.format});
    //   // aspect = rt.width / rt.height;
    // }

    // const uniformBufferSize = 4;
    // const uniformBuffer = this.device.createBuffer({
    //   size: uniformBufferSize,
    //   usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    // });
    // const uniformValues = new Float32Array(uniformBufferSize / 4);
    // uniformValues[0] = aspect;

    // this.device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
    
    // const bindGroup = this.device.createBindGroup({
    //   layout: pipeline.getBindGroupLayout(0),
    //   entries: [
    //     { binding: 0, resource: { buffer: uniformBuffer }},
    //   ],
    // });

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass(descriptor);

    const shader = this.resources.get_shader(shader_handle);
    const pipeline_descriptor = shader.get_pipeline_descriptor(formats);
    const pipeline = this.device.createRenderPipeline(pipeline_descriptor);
    
    pass.setPipeline(pipeline);
    pass.draw(3);
    pass.end();
 
    const commandBuffer = encoder.finish();
    this.device.queue.submit([commandBuffer]);
  }

}