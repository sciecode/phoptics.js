
export class Shader {
  constructor(device, resources, options = {}) {
    const formats = options.formats;

    const vertex = options.vertex || {};
    const desc_pipeline = options.pipeline || {};
    const depth = desc_pipeline.depth || {}
    const blend = !desc_pipeline.blend ? undefined : {
      alpha: desc_pipeline.blend?.alpha || {},
      color: desc_pipeline.blend?.color || {},
    };
    
    const layouts = options.layouts || { bindings: [] };
    const groups = new Array(4);
    for (let i = 0; i < 3; i++)
      groups[i] = layouts.bindings[i] || resources.empty_layout;
    groups[3] = layouts.dynamic || resources.empty_layout;
    
    const layout = device.createPipelineLayout({
      bindGroupLayouts: groups,
    });

    const module = device.createShaderModule({
      code: options.code,
    });

    const descriptor = {
      layout: layout,
      vertex: {
        module: module,
        constants: options.constants,
        entryPoint: vertex.entry || 'vs',
        buffers: vertex.buffers,
      },
      fragment: {
        module: module,
        constants: options.constants,
        entryPoint: options.fragment?.entry || 'fs',
        targets: formats.color.map( format => { 
          return {
            format: format,
            blend: blend
          };
        }),
      },
      depthStencil: !!formats.depth ? {
        depthWriteEnabled: depth.write || true,
        depthCompare: depth.test || "greater-equal",
        depthBias: depth.bias,
        format: formats.depth
      } : undefined,
      multisample: desc_pipeline.multisample,
      primitive: {
        cullMode: "back"
      }
    } 

    this.pipeline = device.createRenderPipeline(descriptor);
  }
}