import { ResourceManager } from "./resource_manager.mjs";
import { BITS, NULL_HANDLE } from "./draw_stream.mjs";

export class GPUBackend {
  constructor(adapter, device) {
    this.adapter = adapter;
    this.device = device;
    this.resources = new ResourceManager(this.device);
  }

  write_buffer(buffer_handle, buffer_offset, data, data_offset, data_size) {
    const buffer = this.resources.get_buffer(buffer_handle);
    this.device.queue.writeBuffer(buffer, buffer_offset, data, data_offset, data_size);
  }

  render_pass(render_pass_handle, draw_stream) {
    const { descriptor, formats } = this.resources
      .get_render_pass(render_pass_handle)
      .get_render_info(this.resources);

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass(descriptor);

    let draw_info = {
      offset: 0,
      stream: draw_stream.buffer,
      formats: formats,
      pass: pass,
    };

    for (let i = 0, il = draw_stream.count; i < il; i++)
      this.render_packet(draw_info, pass, formats);

    pass.end();
 
    const commandBuffer = encoder.finish();
    this.device.queue.submit([commandBuffer]);
  }

  render_packet(draw_packet) {
    const pass = draw_packet.pass, formats = draw_packet.formats,
      stream = draw_packet.stream, metadata = draw_packet.stream[draw_packet.offset++];

    // shader
    if (metadata & (1 << BITS.shader)) {
      const shader_handle = stream[draw_packet.offset++];
      const shader = this.resources.get_shader(shader_handle);

      const pipeline_descriptor = shader.get_pipeline_descriptor(formats);
      const pipeline = this.device.createRenderPipeline(pipeline_descriptor);
      pass.setPipeline(pipeline);
    }

    // bind groups
    for (let i = 0; i < 3; i++) {
      if (metadata & (1 << (BITS.bind_group + i))) {
        const group_handle = stream[draw_packet.offset++];
        if (group_handle !== NULL_HANDLE)
          pass.setBindGroup(i, this.resources.get_bind_group(group_handle).group);
      }
    }

    // vertex attributes
    for (let i = 0; i < 8; i++) {
      if (metadata & (1 << (BITS.attributes + i))) {
        const attrib_handle = stream[draw_packet.offset++];
        if (attrib_handle !== NULL_HANDLE) {
          const attrib = this.resources.get_attribute(attrib_handle);
          const buffer = this.resources.get_buffer(attrib.buffer);
          pass.setVertexBuffer(i, buffer, attrib.byte_offset, attrib.byte_size);
        }
      }
    }

    // index buffer
    if (metadata & (1 << BITS.index)) {
      const index_handle = stream[draw_packet.offset++];
      pass.setIndexBuffer(index_handle, "uint32");
    }

    pass.draw(3);
  }

}