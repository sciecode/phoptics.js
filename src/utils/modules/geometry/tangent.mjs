import { Vertex } from 'phoptics';
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

    this.s = { x: 0, y: 0, z: 0, m: 0 }; // TODO: use phoptics-math
    this.t = { x: 0, y: 0, z: 0, m: 0 };
  	this.any = true;
    this.preserve = false;
  }
}

const add = (a, b) => { return { x: a.x+b.x, y: a.y+b.y, z: a.z+b.z } }
const sub = (a, b) => { return { x: a.x-b.x, y: a.y-b.y, z: a.z-b.z } }
const scl = (s, a) => { return { x: s * a.x, y: s * a.y, z: s * a.z } }
const len_sqr = (a) => a.x*a.x + a.y*a.y + a.z*a.z;
const len = (a) => Math.sqrt(len_sqr(a));

// assumes no degenerate faces
export const generate_tangents = (geometry, info) => {
  opt_remap(geometry); // make indexed & remove duplicates
  const triangle_count = (indices.length / 3 | 0);
  const index_count = triangle_count * 3;

  const get_uv = (idx) => {
    const buffer = geometry.attributes.vertices[info.uv.id];
    const pos = idx * buffer.stride + (info.uv.offset || 0);
    return { x: buffer[pos], y: buffer[pos + 1] };
  }
  
  const get_pos = (idx) => {
    const buffer = geometry.attributes.vertices[info.position.id];
    const pos = idx * buffer.stride + (info.position.offset || 0);
    return { x: buffer[pos], y: buffer[pos + 1], z: buffer[pos + 2] };
  }

  const get_normal = (idx) => {
    const buffer = geometry.attributes.vertices[info.normal.id];
    const pos = idx * buffer.stride + (info.normal.offset || 0);
    return { x: buffer[pos], y: buffer[pos + 1], z: buffer[pos + 2] };
  }

  const tri_info = new Array(triangle_count);
  for (let i = 0; i < triangle_count; i++)
    tri_info[i] = new Info();


  // initialize triangle list info
  const indices = geometry.index.data;
  for (let i = 0; i < triangle_count; i++) {
    const i3 = i * 3;
    const idx1 = indices[i3], idx2 = indices[i3 + 1], idx3 = indices[i3 + 2];
    const v1 = get_pos(idx1), v2 = get_pos(idx2), v3 = get_pos(idx3);
    const t1 = get_uv(idx1), t2 = get_uv(idx2), t3 = get_uv(idx3);

    const t21x = t2.x - t1.x, t21y = t2.y - t1.y;
		const t31x = t3.x - t1.x, t31y = t3.y - t1.y;
		const d1 = sub(v2, v1), d2 = sub(v3, v1);

    const abs_area = Math.abs(t21x * t31y - t21y * t31x);
		const vs = sub(scl(t31y, d1), scl(t21y, d2));
		const vt = add(scl(-t31x, d1), scl(t21x, d2));

    const info = tri_info[i];
    info.preserve = area > 0;

    if (abs_area > Number.EPSILON) {
      const lens = len(vs), lent = len(vt);
			const sign = info.preserve ? -1 : 1;
			if (lens > Number.EPSILON) {
        const ns = scl(sign / lens, vs);
        info.s.x = ns.x; info.s.y = ns.y; info.s.z = ns.z;
      }
      
			if (lent > Number.EPSILON) {
        const ts = scl(sign / lent, vt);
        info.t.x = ts.x; info.t.y = ts.y; info.t.z = ts.z;
      }
      
      info.s.m = lens / abs_area;
      info.t.m = lent / abs_area;
			if (info.s.m > Number.EPSILON && info.t.m > Number.EPSILON)
				info.any = false;
    }
  }

  // initialize neighbour info

}