import { DrawStreamFlags, NULL_HANDLE } from "./constants.mjs";
import { ResourceManager } from "./resource_manager.mjs";

export class GPUBackend {
  constructor(device) {
    this.device = device;
    this.resources = new ResourceManager(this.device);
  }

  write_buffer(buffer_handle, buffer_offset, data, data_offset, data_size) {
    const buffer = this.resources.get_buffer(buffer_handle);
    this.device.queue.writeBuffer(buffer, buffer_offset, data, data_offset, data_size);
  }

  render(pass_descriptor, draw_stream) {
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass(pass_descriptor);

    let draw_packet = {
      offset: 0,
      stream: draw_stream.stream,
      pass: pass,
      draw: {
        dynamic_group: null,
        dynamic_offset: [],
        draw_count: 0,
        vertex_offset: 0,
        index_offset: 0,
      }
    };

    for (let i = 0, il = draw_stream.count; i < il; i++)
      this.render_packet(draw_packet);

    pass.end();
 
    const commandBuffer = encoder.finish();
    this.device.queue.submit([commandBuffer]);
  }

  render_packet(draw_packet) {
    const pass = draw_packet.pass, stream = draw_packet.stream, metadata = draw_packet.stream[draw_packet.offset++];

    // pipeline
    if (metadata & DrawStreamFlags.pipeline) {
      const pipeline_handle = stream[draw_packet.offset++];
      const pipeline = this.resources.get_pipeline(pipeline_handle).pipeline;
      pass.setPipeline(pipeline);
    }

    // bind groups
    for (let i = 0; i < 3; i++) {
      if (metadata & (DrawStreamFlags.bind_group0 << i)) {
        const group_handle = stream[draw_packet.offset++];
        const group = this.resources.get_bind_group(group_handle).group;
        pass.setBindGroup(i, group);
      }
    }

    // dynamic
    if ((metadata >> 4) & 3) {
      let group_handle = draw_packet.draw.dynamic_group = metadata & DrawStreamFlags.dynamic_group ?
        stream[draw_packet.offset++] : draw_packet.draw.dynamic_group;
      const bind_group = this.resources.get_bind_group(group_handle);
      const group = bind_group.group;

      if (metadata & (DrawStreamFlags.dynamic_offset))
        draw_packet.draw.dynamic_offset[0] = stream[draw_packet.offset++];

      pass.setBindGroup(3, group, draw_packet.draw.dynamic_offset);
    }

    // vertex attributes
    for (let i = 0; i < 4; i++) {
      if (metadata & (DrawStreamFlags.attribute0 << i)) {
        const attrib_handle = stream[draw_packet.offset++];
        if (attrib_handle != NULL_HANDLE) {
          const attrib = this.resources.get_attribute(attrib_handle);
          const buffer = this.resources.get_buffer(attrib.buffer);
          pass.setVertexBuffer(i, buffer, attrib.byte_offset, attrib.byte_size);
        } else {
          pass.setVertexBuffer(i, null);
        }
      }
    }

    // index buffer
    if (metadata & DrawStreamFlags.index) {
      const index_handle = stream[draw_packet.offset++];
      const buffer = this.resources.get_buffer(index_handle);
      pass.setIndexBuffer(buffer, "uint32");
    }

    // draw count
    if (metadata & DrawStreamFlags.draw_count) {
      draw_packet.draw.draw_count = stream[draw_packet.offset++];
    }

    // vertex offset
    if (metadata & DrawStreamFlags.vertex_offset) {
      draw_packet.draw.vertex_offset = stream[draw_packet.offset++];
    }

    // index offset
    if (metadata & DrawStreamFlags.index_offset) {
      draw_packet.draw.index_offset = stream[draw_packet.offset++];
    }

    const info = draw_packet.draw;
    if (info.index_offset === NULL_HANDLE) {
      pass.draw(info.draw_count, 1, info.vertex_offset);
    } else {
      pass.drawIndexed(info.draw_count, 1, info.index_offset, info.vertex_offset);
    }
  }
}