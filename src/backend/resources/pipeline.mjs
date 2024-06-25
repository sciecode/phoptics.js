import { Format } from "../../common/constants.mjs";

export class Pipeline {
  constructor(device, resources, options = {}) {
      
    const graphics = options.graphics;
    const depth = graphics.depth || {}
    const layout = resources.get_pipeline_layout(options.layouts);
    const module = resources.get_shader(options.shader);

    const blend = graphics.blend === false ? undefined : {
      color: parse_blend(graphics.blend.color),
      alpha: parse_blend(graphics.blend.alpha)
    };

    const descriptor = {
      layout: layout,
      vertex: {
        module: module,
        constants: options.constants,
        entryPoint: options.shader.vertex || 'vs',
      },
      fragment: {
        module: module,
        constants: options.constants,
        entryPoint: options.shader.fragment || 'fs',
        targets: graphics.formats.color.map( format => { 
          return {
            format: Format.internal(format),
            blend: blend
          };
        }),
      },
      depthStencil: !!graphics.formats.depth ? {
        depthWriteEnabled: depth.write !== undefined ? depth.write : true,
        depthCompare: depth.test || "greater",
        depthBias: depth.bias,
        format: Format.internal(graphics.formats.depth)
      } : undefined,
      multisample: { count: graphics.multisampled ? 4 : 1 },
      primitive: {
        topology: graphics.primitive,
        cullMode: graphics.cull
      }
    }
    this.pipeline = device.createRenderPipeline(descriptor);
  }
}

const parse_blend = (info) => {
  const blend = { dstFactor: info.dst, srcFactor: info.src, operation: info.op };
  return blend;
}