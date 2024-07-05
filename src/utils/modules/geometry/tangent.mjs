import { Vertex, RadixSort } from 'phoptics';
import { Vec3, Vec2 } from 'phoptics/math';
import { opt_remap } from 'phoptics/utils/modules/geometry/optimizer.mjs';

import { TYPE } from "./common/type.mjs";
import { Memory, memcpy } from './common/memory.mjs';

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
};

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

class Group {
  constructor() {
    this.count = 0;
    this.offset = 0;
    this.vert = 0;
    this.preserve = false;
  }
}

const non_zero = (v) => Math.abs(v) > Number.EPSILON;

// assumes no degenerate faces
export const generate_tangents = (geometry, info) => {
  if (!geometry.index) opt_remap(geometry); // make indexed & remove duplicates

  const get_uv = (idx, v) => {
    const buffer = geometry.attributes.vertices[info.uv.id];
    v.from(buffer.data, idx * buffer.stride / buffer.data.BYTES_PER_ELEMENT + (info.uv.offset || 0));
  };

  const get_pos = (idx, v) => {
    const buffer = geometry.attributes.vertices[info.position.id];
    v.from(buffer.data, idx * buffer.stride / buffer.data.BYTES_PER_ELEMENT + (info.position.offset || 0));
  };

  const get_normal = (idx, v) => {
    const buffer = geometry.attributes.vertices[info.normal.id];
    v.from(buffer.data, idx * buffer.stride / buffer.data.BYTES_PER_ELEMENT + (info.normal.offset || 0));
  };

  const indices = geometry.index.data;
  const triangle_count = (indices.length / 3 | 0);
  const indices_count = triangle_count * 3;
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

      if (non_zero(area)) {
        get_pos(idx1, v1), get_pos(idx2, v2), get_pos(idx3, v3);
        const d1 = v2.sub(v1), d2 = v3.sub(v1);

        const lens = vs.copy(d1).mul_f32(t31.y)
          .sub(v1.copy(d2).mul_f32(t21.y))
          .length();

        const lent = vt.copy(d1).mul_f32(-t31.x)
          .add(v1.copy(d2).mul_f32(t21.x))
          .length();

        const sign = info.preserve ? -1 : 1; // TODO: validate - should be correct for WebGPU tex coords
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
  build_neighbours(tri_info, indices, triangle_count);

  // initialize groups
  const groups = new Array(indices_count);
  const tri_groups = new Array(indices_count);
  for (let i = 0; i < indices_count; i++) groups[i] = new Group();
  const group_count = build_groups(groups, tri_groups, tri_info, indices, triangle_count);

  // create tangent space
};

const get_edge = (indices, idx, i0, i1) => {
  const [id0, id1, id2] = indices.slice(idx, idx + 3);
	if (id0 == i0 || id0 == i1) {
		if (id1 == i0 || id1 == i1) return [id0, id1, 0];
		else return [id2, id0, 2];
	} else return [id1, id2, 1];
}

const build_neighbours = (info, indices, triangle_count) => {
  const edges = new Array(triangle_count * 3);
  for (let f = 0; f < triangle_count; f++) {
    const f3 = f * 3;
    for (let i = 0; i < 3; i++) {
      const i0 = indices[f3 + i];
      const i1 = indices[f3 + (i + 1) % 3];
      edges[f3 + i] = i0 < i1 ? [i0, i1, f] : [i1, i0, f];
    }
  }

  RadixSort(edges, { get: (a) => a[0] });
  
  for (let i = 0, s = 0; i < edges.length; i++) {
    if (edges[s][0] != edges[i][0]) {
      const st = s;
      const len = i-s;
      s = i;
      if (len > 1) RadixSort(edges, { st, len, get: (a) => a[1] });
    }
  }
  
  for (let i = 0, s = 0; i < edges.length; i++) {
    if (edges[s][0] != edges[i][0] || edges[s][1] != edges[i][1]) {
      const st = s;
      const len = i-s;
      s = i;
      if (len > 1) RadixSort(edges, { st, len, get: (a) => a[2] });
    }
  }

  for (let i = 0; i < edges.length; i++) {
		const [i0, i1, f] = edges[i];
		let [i0_A, i1_A, eA] = get_edge(indices, f * 3, i0, i1);

		if (info[f].neighbours[eA] == -1) {
			let j = i + 1, found = false;
			while (j < edges.length && i0 == edges[j][0] && i1 == edges[j][1] && !found) {
				let [i0_B, i1_B, eB] = get_edge(indices, t * 3, edges[j][0], edges[j][1]), t = edges[j][2];
				if (i0_A == i0_B && i1_A == i1_B && info[t].neighbours[eb] == -1) found = true;
				else ++j;
			}

			if (found) {
				const t = edges[j][2];
				info[f].neighbours[eA] = t;
				info[t].neighbours[eB] = f;
			}
		}
	}
}

const add_tri_group = (group, tri_groups, face) => {
  tri_groups[group.offset + group.count++] = face;
};

const assign = (info, indices, groups, tri_groups, face, group, group_id) => {
  let i = 2;
  const tri = info[face];
  const idx = 3 * face, vert = group.vert;

  if (vert == indices[idx]) i = 0;
  else if (vert == indices[idx + 1]) i = 1;
  if (tri.groups[i] == group_id) return true;
  else if (tri.groups[i] == -1) return false;

  if (tri.any && tri.group[0] == -1 && tri.group[1] == -1 && tri.group[2] == -1)
    tri.preserve = group.preserve;
  if (tri.preserve != group.preserve) return false;

  add_tri_group(group, tri_groups, face);
  tri.groups[i] = group_id;

  let nl = tri.neighbours[i], nr = tri.neighbours[i > 0 ? (i - 1) : 2];
  if (nl >= 0) assign(info, indices, groups, tri_groups, nl, group, group_id);
  if (nr >= 0) assign(info, indices, groups, tri_groups, nr, group, group_id);

  return true;
};

const build_groups = (groups, tri_groups, info, indices, triangle_count) => {
  let group_count = 0, offset = 0;
  for (let f = 0; f < triangle_count; f++) {
    let tri = info[f];
    for (let i = 0; i < 3; i++) {
      if (!tri.any && tri.groups[i] == -1) {
        const group_id = group_count++, group = groups[group_id];
        tri.groups[i] = group_id;
        group.vert = indices[f * 3 + i];
        group.count = 0;
        group.offset = offset;
        group.preserve = tri.preserve;

        add_tri_group(group, tri_groups, f);

        let nl = tri.neighbours[i], nr = tri.neighbours[i > 0 ? (i - 1) : 2];
        if (nl >= 0) assign(info, indices, groups, tri_groups, nl, group, group_id);
        if (nr >= 0) assign(info, indices, groups, tri_groups, nr, group, group_id);
        offset += group.count;
      }
    }
  }

  return group_count;
};