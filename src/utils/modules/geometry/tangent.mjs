import { Vertex } from 'phoptics';
import { Vec3, Vec2 } from 'phoptics/math';
import { opt_remap } from 'phoptics/utils/modules/geometry/optimizer.mjs';
import { TYPE } from "./common/type.mjs";
import { Memory, memcpy } from './common/memory.mjs';

// TODO: move to a different module - this isn't required here
export const unweld = (geometry) => {
  const indices = geometry.index.data;
  const index_count = (indices.length / 3 | 0) * 3;
  const buffer_count = geometry.attributes.vertices.length;

  const buffers = geometry.attributes.vertices.map(vertex => {
    return {
      stride: vertex.stride,
      input: new Uint8Array(vertex.data.buffer, vertex.data.byteOffset, vertex.size),
    };
  });

  let mem = [];
  for (let i = 0; i < buffer_count; ++i)
    mem.push({ type: TYPE.u8, count: index_count * buffers[i].stride });
  Memory.allocate_layout(mem);

  for (let k = 0; k < buffer_count; k++) {
    const out = mem[k], buffer = buffers[k], stride = buffer.stride;
    for (let i = 0; i < indices.length; i++)
      memcpy(out, i * stride, buffer.input, indices[i] * stride, stride);

    const attrib = geometry.attributes.vertices[k];
    const type = attrib.data.constructor;
    const elements = out.byteLength / type.BYTES_PER_ELEMENT;
    geometry.attributes.vertices[k] = new Vertex({
      stride: attrib.stride,
      data: new type(out.buffer, out.byteOffset, elements),
    });
  }

  geometry.index = undefined;
}

class Info {
  constructor() {
    this.neighbours = [-1, -1, -1];
  	this.groups = [-1, -1, -1];

    this.s = new Vec3(); this.sm = 0;
    this.t = new Vec3(); this.tm = 0;
    
  	this.any = true;
    this.preserve = false;
  }
}

const non_zero = (v) => Math.abs(v) > Number.EPSILON;

// assumes no degenerate faces
export const generate_tangents = (geometry, info) => {
  opt_remap(geometry); // make indexed & remove duplicates
  
  const get_uv = (idx, v) => {
    const buffer = geometry.attributes.vertices[info.uv.id];
    v.from(buffer.data, idx * buffer.stride + (info.uv.offset || 0));
  }
  
  const get_pos = (idx, v) => {
    const buffer = geometry.attributes.vertices[info.position.id];
    v.from(buffer.data, idx * buffer.stride + (info.position.offset || 0));
  }

  const get_normal = (idx, v) => {
    const buffer = geometry.attributes.vertices[info.normal.id];
    v.from(buffer.data, idx * buffer.stride + (info.normal.offset || 0));
  }

  const indices = geometry.index.data;
  const triangle_count = (indices.length / 3 | 0);
  const tri_info = new Array(triangle_count);

  for (let i = 0; i < triangle_count; i++)
    tri_info[i] = new Info();

  // initialize triangle list info
  {
    const vs = new Vec3(), vt = new Vec3();
    const v1 = new Vec3(), v2 = new Vec3(), v3 = new Vec3();
    const t1 = new Vec2(), t2 = new Vec2(), t3 = new Vec2();
    for (let i = 0; i < triangle_count; i++) {
      const i3 = i * 3, info = tri_info[i];
      const idx1 = indices[i3], idx2 = indices[i3 + 1], idx3 = indices[i3 + 2];

      get_uv(idx1, t1), get_uv(idx2, t2), get_uv(idx3, t3);
      const t21 = t2.sub(t1), t31 = t3.sub(t1);
      const area = t21.x * t31.y - t21.y * t31.x;
      info.preserve = area > 0;

      if (non_zero(abs_area)) {
        get_pos(idx1, v1), get_pos(idx2, v2), get_pos(idx3, v3);
    		const d1 = v2.sub(v1), d2 = v3.sub(v1);
        
        const lens = vs.copy(d1).mul_f32(t31.y)
          .sub(v1.copy(d2).mul_f32(t21.y))
          .length();
        
        const lent = vt.copy(d1).mul_f32(-t31.x)
          .add(v1.copy(d2).mul_f32(t21.x))
          .length();
        
  			const sign = info.preserve ? -1 : 1;
  			if (non_zero(lens)) info.s.copy(vs).mul_f32(sign / lens);
  			if (non_zero(lent)) info.t.copy(vt).mul_f32(sign / lent);

        const abs_area = Math.abs(area);
        info.sm = lens / abs_area;
        info.tm = lent / abs_area;

  			if (non_zero(info.sm) && non_zero(info.tm)) info.any = false;
      }
    }
  }

  // initialize neighbour info

}