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
    for (let i = 0; i < indices.length; i++) {
      try {
        memcpy(out, i * stride, buffer.input, indices[i] * stride, stride);
      } catch (_) {
        console.log(i, indices[i], indices.length);
        console.log(out, i * stride, buffer.input, indices[i] * stride, stride);
        throw 'f';
      }
    }

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

class TSpace {
  constructor() {
    this.s = new Vec3().set(1, 0, 0); this.sm = 1;
    this.t = new Vec3().set(0, 1, 0); this.tm = 1;
    this.preserve = false;
  }
  copy(v) {
    this.s.copy(v.s); this.sm = v.sm;
    this.t.copy(v.t); this.tm = v.tm;
  }
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

class Group {
  constructor() {
    this.count = 0;
    this.offset = 0;
    this.vert = 0;
    this.preserve = false;
  }
}

class SubGroup {
  constructor() {
    this.count = 0;
    this.members = null;
  }
}

const non_zero = (v) => Math.abs(v) > Number.EPSILON;
const vec_non_zero = (v) => non_zero(v.x) || non_zero(v.y) || non_zero(v.z);

// assumes no degenerate faces
export const generate_tangents = (geometry, info) => {
  if (!geometry.index) opt_remap(geometry); // make indexed & remove duplicates

  const getters = {
    uv: (idx, v) => {
      const buffer = geometry.attributes.vertices[info.uv.id];
      v.from(buffer.data, idx * buffer.stride / buffer.data.BYTES_PER_ELEMENT + (info.uv.offset || 0));
    },
    pos: (idx, v) => {
      const buffer = geometry.attributes.vertices[info.position.id];
      v.from(buffer.data, idx * buffer.stride / buffer.data.BYTES_PER_ELEMENT + (info.position.offset || 0));
    },
    normal: (idx, v) => {
      const buffer = geometry.attributes.vertices[info.normal.id];
      v.from(buffer.data, idx * buffer.stride / buffer.data.BYTES_PER_ELEMENT + (info.normal.offset || 0));
    }
  };

  const indices = geometry.index.data;
  const triangle_count = (indices.length / 3 | 0);
  const indices_count = triangle_count * 3;

  // initialize triangle list info
  const tri_info = init_info(indices, triangle_count, getters);

  // initialize neighbour info
  build_neighbours(tri_info, indices, triangle_count);

  // initialize groups
  const groups = new Array(indices_count);
  const tri_groups = new Array(indices_count);
  for (let i = 0; i < indices_count; i++) groups[i] = new Group();
  const group_count = build_groups(groups, tri_groups, tri_info, indices, triangle_count);

  // create tangent space
  const t_spaces = build_tspaces(tri_info, indices, groups, tri_groups, group_count, indices_count, getters);

  // populate
  const tangents = new Float32Array(indices_count * 4);
  for (let i = 0; i < indices_count; i++) {
    const i4 = i * 4, frame = t_spaces[i];
    frame.s.to(tangents, i4);
    tangents[i4 + 3] = frame.preserve ? 1 : -1;
  }

  // finalize
  unweld(geometry);
  geometry.attributes.vertices.push(
    new Vertex({
      stride: 16,
      data: tangents
    })
  );
};

const init_info = (indices, triangle_count, getters) => {
  const tri_info = new Array(triangle_count);
  for (let i = 0; i < triangle_count; i++)
    tri_info[i] = new Info();

  const vs = new Vec3(), vt = new Vec3();
  const v1 = new Vec3(), v2 = new Vec3(), v3 = new Vec3();
  const t1 = new Vec2(), t2 = new Vec2(), t3 = new Vec2();
  for (let i = 0; i < triangle_count; i++) {
    const i3 = i * 3, info = tri_info[i];
    const idx1 = indices[i3], idx2 = indices[i3 + 1], idx3 = indices[i3 + 2];

    getters.uv(idx1, t1), getters.uv(idx2, t2), getters.uv(idx3, t3);
    const t21 = t2.sub(t1), t31 = t3.sub(t1);
    const area = t21.x * t31.y - t21.y * t31.x;
    info.preserve = area > 0;

    if (non_zero(area)) {
      getters.pos(idx1, v1), getters.pos(idx2, v2), getters.pos(idx3, v3);
      const d1 = v2.sub(v1), d2 = v3.sub(v1);

      const lens = vs.copy(d1).mul_f32(t31.y)
        .sub(v1.copy(d2).mul_f32(t21.y))
        .length();

      const lent = vt.copy(d1).mul_f32(-t31.x)
        .add(v1.copy(d2).mul_f32(t21.x))
        .length();

      const sign = info.preserve ? 1 : -1;
      if (non_zero(lens)) info.s.copy(vs).mul_f32(sign / lens);
      if (non_zero(lent)) info.t.copy(vt).mul_f32(sign / lent);

      const abs_area = Math.abs(area);
      info.sm = lens / abs_area;
      info.tm = lent / abs_area;

      if (non_zero(info.sm) && non_zero(info.tm)) info.any = false;
    }
  }

  return tri_info;
};

const build_tspaces = (tri_info, indices, groups, tri_groups, group_count, indices_count, getters) => {
  const t_spaces = new Array(indices_count);
  for (let i = 0; i < indices_count; i++) t_spaces[i] = new TSpace();

  let max_faces = 0;
  for (let i = 0; i < group_count; i++)
    if (max_faces < groups[i].count) max_faces = groups[i].count;

  const sub_spaces = new Array(max_faces);
  const uni_group = new Array(max_faces);
  let members = new Uint32Array(max_faces);
  for (let i = 0; i < max_faces; i++) {
    sub_spaces[i] = new TSpace();
    uni_group[i] = new SubGroup();
  }

  const tmp_group = new SubGroup();
  for (let i = 0; i < group_count; i++) {
    let group = groups[i], sub_group_count = 0;
    for (let j = 0; j < group.count; j++) {
      const f = tri_groups[group.offset + j], info = tri_info[f];
      let index = 2;
      if (info.groups[0] == i) index = 0;
      else if (info.groups[1] == i) index = 1;

      for (let k = 0; k < group.count; k++) members[k] = tri_groups[group.offset + k];
      if (group.count > 1) RadixSort(members, { st: 0, len: group.count });

      let found = false, s = 0;
      tmp_group.count = group.count;
      tmp_group.members = members;
      while (s < sub_group_count && !found) {
        found = compare_sub_group(tmp_group, uni_group[s]);
        if (!found) s++;
      }

      if (!found) {
        uni_group[sub_group_count].count = group.count;
        uni_group[sub_group_count].members = members;
        eval_tspace(sub_spaces[sub_group_count++], members, group.count, tri_info, indices, group.vert, getters);
        members = new Uint32Array(max_faces);
      }

      const tangent = t_spaces[f * 3 + index];
      tangent.copy(sub_spaces[s]);
      tangent.preserve = group.preserve;
    }
  }

  return t_spaces;
};

const eval_tspace = (st, members, member_count, tri_info, indices, vert, getters) => {
  let angle_sum = 0;
  st.s.set(0, 0, 0); st.sm = 0;
  st.t.set(0, 0, 0); st.tm = 0;

  let n = new Vec3(), vs = new Vec3(), vt = new Vec3();
  let p0 = new Vec3(), p1 = new Vec3(), p2 = new Vec3();
  let v1 = new Vec3(), v2 = new Vec3();
  for (let i = 0; i < member_count; i++) {
    const f = members[i], info = tri_info[f];

    if (!info.any) {
      let i = 2;
      const f3 = f * 3;
      if (indices[f3] == vert) i = 0;
      else if (indices[f3 + 1]) i = 1;

      getters.normal(vert, n);
      vs.copy(info.s).sub(p0.copy(n).mul_f32(n.dot(info.s)));
      if (vec_non_zero(vs)) vs.unit();
      vt.copy(info.t).sub(p0.copy(n).mul_f32(n.dot(info.t)));
      if (vec_non_zero(vt)) vt.unit();

      let i1 = indices[f3 + i],
        i2 = indices[f3 + (i < 2 ? i + 1 : 0)],
        i0 = indices[f3 + (i > 0 ? i - 1 : 2)];

      getters.pos(i0, p0);
      getters.pos(i1, p1);
      getters.pos(i2, p2);
      v1.copy(p0).sub(p1);
      v2.copy(p2).sub(p1);

      v1.sub(p0.copy(n).mul_f32(n.dot(v1)));
      if (vec_non_zero(v1)) v1.unit();
      v2.sub(p0.copy(n).mul_f32(n.dot(v2)));
      if (vec_non_zero(v2)) v2.unit();

      let cos = v1.dot(v2);
      cos = cos > 1 ? 1 : (cos < -1 ? -1 : cos);
      let ang = Math.acos(cos);

      st.s.add(vs.mul_f32(ang));
      st.t.add(vt.mul_f32(ang));
      st.sm += ang * info.sm;
      st.tm += ang * info.tm;
      angle_sum += ang;
    }
  }

  if (vec_non_zero(st.s)) st.s.unit();
  if (vec_non_zero(st.t)) st.t.unit();
  if (angle_sum > 0) {
    st.sm /= angle_sum;
    st.tm /= angle_sum;
  }
};

const compare_sub_group = (cur, other) => {
  if (cur.count != other.count) return false;
  for (let i = 0; i < cur.count; i++)
    if (cur.members[i] != other.members[i]) return false;
  return true;
};

const get_edge = (indices, idx, i0, i1) => {
  const [id0, id1, id2] = indices.slice(idx, idx + 3);
  if (id0 == i0 || id0 == i1) {
    if (id1 == i0 || id1 == i1) return [id0, id1, 0];
    else return [id2, id0, 2];
  } else return [id1, id2, 1];
};

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
      const len = i - s;
      s = i;
      if (len > 1) RadixSort(edges, { st, len, get: (a) => a[1] });
    }
  }

  for (let i = 0, s = 0; i < edges.length; i++) {
    if (edges[s][0] != edges[i][0] || edges[s][1] != edges[i][1]) {
      const st = s;
      const len = i - s;
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
        let t = edges[j][2], [i0_B, i1_B, eB] = get_edge(indices, t * 3, edges[j][0], edges[j][1]);
        if (i0_A == i0_B && i1_A == i1_B && info[t].neighbours[eB] == -1) found = true;
        else ++j;
      }

      if (found) {
        const t = edges[j][2];
        info[f].neighbours[eA] = t;
        info[t].neighbours[eB] = f;
      }
    }
  }
};

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