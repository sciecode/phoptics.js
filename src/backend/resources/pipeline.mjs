export class Pipeline {
  constructor(device, resources, options = {}) {
      
    const graphics = options.graphics;
    const depth = graphics.depth || {}
    
    const layouts = options.layouts || { bindings: [] };
    const groups = new Array(4);
    for (let i = 0; i < 3; i++)
      groups[i] = layouts.bindings[i] || resources.empty_layout;
    groups[3] = layouts.dynamic || resources.empty_layout;
    
    const layout = device.createPipelineLayout({
      bindGroupLayouts: groups,
    });

    const module = device.createShaderModule({
      code: options.shader.code,
    });

    const blend = {
      color: parse_blend(graphics.blend.color),
      alpha: parse_blend(graphics.blend.alpha)
    };

    const descriptor = {
      layout: layout,
      vertex: {
        module: module,
        constants: options.constants,
        entryPoint: options.shader.vertex || 'vs',
        buffers: options.vertex,
      },
      fragment: {
        module: module,
        constants: options.constants,
        entryPoint: options.shader.fragment || 'fs',
        targets: graphics.formats.color.map( format => { 
          return {
            format: format,
            blend: blend
          };
        }),
      },
      depthStencil: !!graphics.formats.depth ? {
        depthWriteEnabled: depth.write != undefined ? depth.write : true,
        depthCompare: depth.test || "greater",
        depthBias: depth.bias,
        format: graphics.formats.depth
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