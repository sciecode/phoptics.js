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

  upload_texture_data(bid, options) {
    const resource = this.resources.get_texture(bid);
    const gpu_tex = resource.texture, block = resource.block;
    const level = options.mip_level, bytes = block.bytes;
    const size = {
      width: options.size?.width || Math.max(1, gpu_tex.width >> level),
      height: options.size?.height || Math.max(1, gpu_tex.height >> level),
    };
    const row = size.width / block.width, column = size.height / block.height;
    this.device.queue.writeTexture(
      { texture: gpu_tex, origin: options.target_origin, mipLevel: level },
      options.data,
      { offset: options.offset, bytesPerRow: bytes * row, rowsPerImage: column },
      size
    );
  }

  upload_texture_image(bid, options) {
    const gpu_tex = this.resources.get_texture(bid).texture;
    const level = options.mip_level;
    const size = {
      width: options.size?.width || Math.max(1, gpu_tex.width >> level),
      height: options.size?.height || Math.max(1, gpu_tex.height >> level),
    };
    this.device.queue.copyExternalImageToTexture(
      { source: options.image, flipY: options.flip_y, origin: options.source_origin },
      { texture: gpu_tex, origin: options.target_origin, colorSpace: options.encoding,
        premultipliedAlpha: options.alpha, mipLevel: level },
      size
    );
  }

  read_texture(tex, options) {
    const buffer = this.resources.get_buffer(options.dst);

    const size = options.size;
    const encoder = this.device.createCommandEncoder();
    encoder.copyTextureToBuffer(
      { texture: tex },
      { buffer, bytesPerRow: options.bytes_row, rowsPerImage: size.height },
      size
    );

    this.device.queue.submit([encoder.finish()]);

    return buffer;
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
        empty: [],
        draw_count: 0,
        vertex_offset: 0,
        index_offset: -1,
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
      if (metadata & (DrawStreamFlags.bind_globals << i)) {
        const group_handle = stream[draw_packet.offset++];
        const group = this.resources.get_bind_group(group_handle).group;
        pass.setBindGroup(i, group);
      }
    }

    // dynamic
    if (metadata & 0x30) {
      let group_handle = draw_packet.draw.dynamic_group = metadata & DrawStreamFlags.dynamic_group ?
        stream[draw_packet.offset++] : draw_packet.draw.dynamic_group;
      const bind_group = this.resources.get_bind_group(group_handle);
      const group = bind_group.group;

      if (metadata & (DrawStreamFlags.dynamic_offset))
        draw_packet.draw.dynamic_offset[0] = stream[draw_packet.offset++];

      pass.setBindGroup(3, group, bind_group.dynamic_entries ? draw_packet.draw.dynamic_offset : draw_packet.draw.empty);
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

    // index offset
    if (metadata & DrawStreamFlags.index_offset) {
      draw_packet.draw.index_offset = stream[draw_packet.offset++];
    }

    // index buffer
    if (metadata & DrawStreamFlags.index) {
      const index_handle = stream[draw_packet.offset++];
      if (index_handle != NULL_HANDLE) {
        const buffer = this.resources.get_buffer(index_handle);
        const type = draw_packet.draw.index_offset & 0x8000_0000 ? "uint32" : "uint16";
        pass.setIndexBuffer(buffer, type);
      }
    }

    // draw count
    if (metadata & DrawStreamFlags.draw_count) {
      draw_packet.draw.draw_count = stream[draw_packet.offset++];
    }

    // vertex offset
    if (metadata & DrawStreamFlags.vertex_offset) {
      draw_packet.draw.vertex_offset = stream[draw_packet.offset++];
    }

    const info = draw_packet.draw;
    if (info.index_offset === NULL_HANDLE) {
      pass.draw(info.draw_count, 1, info.vertex_offset);
    } else {
      pass.drawIndexed(info.draw_count, 1, info.index_offset & 0x7fff_ffff, info.vertex_offset);
    }
  }
}