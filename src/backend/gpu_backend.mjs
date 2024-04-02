import { ResourceManager } from "./resource_manager.mjs";
import { DrawStreamFlags } from "./draw_stream.mjs";

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

  render(rt_handle, draw_stream) {
    const rt = this.resources.get_render_target(rt_handle);
    const descriptor = rt.get_render_info(this.resources);

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass(descriptor);

    let draw_packet = {
      offset: 0,
      stream: draw_stream.stream,
      target: rt,
      pass: pass,
      draw: {
        dynamic_group: null,
        dynamic_cache: new Array(4),
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
    const pass = draw_packet.pass, target = draw_packet.target,
      stream = draw_packet.stream, metadata = draw_packet.stream[draw_packet.offset++];

    // shader
    if (metadata & DrawStreamFlags.shader) {
      const shader_handle = stream[draw_packet.offset++];
      const shader = this.resources.get_shader(shader_handle);
      const pipeline = target.get_pipeline(this.device, shader);
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

    // dynamic group
    if ((metadata >> 4) & 31) {
      let group_handle = metadata & DrawStreamFlags.dynamic_group ?
        stream[draw_packet.offset++] : draw_packet.draw.dynamic_group;
      const bind_group = this.resources.get_bind_group(group_handle);
      const group = bind_group.group;

      const offsets = draw_packet.draw.dynamic_cache.slice(0, bind_group.dynamic_entries);
      for (let i = 0; i < 4; i++)
        if (metadata & (DrawStreamFlags.dynamic_offset0 << i))
          draw_packet.draw.dynamic_cache[i] = offsets[i] = stream[draw_packet.offset++];

      pass.setBindGroup(3, group, offsets);
    }

    // vertex attributes
    for (let i = 0; i < 4; i++) {
      if (metadata & (DrawStreamFlags.attribute0 << i)) {
        const attrib_handle = stream[draw_packet.offset++];
        const attrib = this.resources.get_attribute(attrib_handle);
        const buffer = this.resources.get_buffer(attrib.buffer);
        pass.setVertexBuffer(i, buffer, attrib.byte_offset, attrib.byte_size);
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
    if (info.index_offset === (-1 >>> 0)) {
      pass.draw(info.draw_count, 1, info.vertex_offset);
    } else {
      pass.drawIndexed(info.draw_count, 1, info.index_offset, info.vertex_offset);
    }
  }
}