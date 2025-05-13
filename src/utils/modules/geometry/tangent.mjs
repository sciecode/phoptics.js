import { Vertex, Attributes, RadixSort } from 'phoptics';
import { Vec2, Vec3, Vec4 } from 'phoptics/math';
import { opt_remap } from 'phoptics/utils/modules/geometry/optimizer.mjs';
import { unweld } from 'phoptics/utils/modules/geometry/transform.mjs';

class Info {
  constructor() {
    this.neighbours = [-1, -1, -1];
    this.groups = [-1, -1, -1];

    this.any = true;
    this.preserve = false;
    this.tangent = new Vec3();
  }
}

class Group {
  constructor() {
    this.count = 0;
    this.offset = 0;
    this.vert = 0;
    this.tangent = new Vec3();
    this.preserve = false;
  }
}

const non_zero = (v) => Math.abs(v) > Number.EPSILON;
const vec_non_zero = (v) => non_zero(v.x) || non_zero(v.y) || non_zero(v.z);

// assumes no degenerate faces
export const generate_tangents = (geometry, info) => {
  if (!geometry.index) opt_remap(geometry);

  const indices = geometry.index.data;
  const indices_count = geometry.index.count;
  const triangle_count = indices_count / 3;

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

  // initialize triangle list info
  const tri_info = init_info(indices, triangle_count, getters);

  // initialize neighbour info
  build_neighbours(tri_info, indices, triangle_count);

  // initialize groups
  const groups = new Array(indices_count);
  const tri_groups = new Array(indices_count);
  for (let i = 0; i < indices_count; i++) groups[i] = new Group();
  const group_count = build_groups(groups, tri_groups, tri_info, indices, triangle_count);

  // tangent space
  build_tangents(tri_info, indices, groups, tri_groups, group_count, getters);

  // populate
  const base = new Vec4().set(1, 0, 0, 1);
  const tangents = new Float32Array(indices_count * 4);
  for (let f = 0; f < triangle_count; f++) {
    const info = tri_info[f], f3 = f * 3;
    for (let i = 0; i < 3; i++) {
      const i4 = (f3 + i) * 4, group_id = info.groups[i];
      if (group_id != -1) {
        const group = groups[info.groups[i]];
        group.tangent.to(tangents, i4);
        tangents[i4 + 3] = group.preserve ? 1 : -1;
      } else {
        base.to(tangents, i4);
      }
    }
  }

  // finalize
  const vertices = unweld(geometry).attributes.vertices;
  vertices.push(
    new Vertex({
      stride: 16,
      data: tangents
    })
  );
  geometry.attributes = new Attributes(vertices);
};

const init_info = (indices, triangle_count, getters) => {
  const tri_info = new Array(triangle_count);
  for (let i = 0; i < triangle_count; i++)
    tri_info[i] = new Info();

  const vs = new Vec3();
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

      vs.copy(d1).mul_f32(t31.y);
      v1.copy(d2).mul_f32(t21.y);
      const lens = vs.sub(v1).mag();

      const sign = info.preserve ? 1 : -1;
      if (non_zero(lens)) info.tangent.copy(vs).mul_f32(sign / lens);
      if (non_zero(lens / Math.abs(area))) info.any = false;
    }
  }
  return tri_info;
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

  const get_edge = (idx, i0, i1) => {
    const [id0, id1, id2] = indices.slice(idx, idx + 3);
    if (id0 == i0 || id0 == i1) {
      if (id1 == i0 || id1 == i1) return [id0, id1, 0];
      else return [id2, id0, 2];
    } else return [id1, id2, 1];
  };

  for (let i = 0; i < edges.length; i++) {
    const [i0, i1, f] = edges[i];
    let t, i0_B, i1_B, eB, [i0_A, i1_A, eA] = get_edge(f * 3, i0, i1);

    if (info[f].neighbours[eA] == -1) {
      let j = i + 1, found = false;
      while (j < edges.length && i0 == edges[j][0] && i1 == edges[j][1] && !found) {
        t = edges[j][2];
        [i1_B, i0_B, eB] = get_edge(t * 3, edges[j][0], edges[j][1]);
        if (i0_A == i0_B && i1_A == i1_B && info[t].neighbours[eB] == -1) found = true;
        else ++j;
      }

      if (found) {
        info[f].neighbours[eA] = t;
        info[t].neighbours[eB] = f;
      }
    }
  }
};

const build_groups = (groups, tri_groups, info, indices, triangle_count) => {
  const add_tri_group = (group, face) => {
    tri_groups[group.offset + group.count++] = face;
  };

  const assign = (face, group, group_id) => {
    let i = 2;
    const tri = info[face];
    const idx = face * 3, vert = group.vert;

    if (vert == indices[idx]) i = 0;
    else if (vert == indices[idx + 1]) i = 1;

    if (tri.groups[i] == group_id) return true;
    else if (tri.groups[i] != -1) return false;

    if (tri.any && tri.groups[0] == -1 && tri.groups[1] == -1 && tri.groups[2] == -1)
      tri.preserve = group.preserve;
    if (tri.preserve != group.preserve) return false;

    add_tri_group(group, face);
    tri.groups[i] = group_id;

    let nl = tri.neighbours[i], nr = tri.neighbours[i > 0 ? (i - 1) : 2];
    if (nl >= 0) assign(nl, group, group_id);
    if (nr >= 0) assign(nr, group, group_id);
    return true;
  };

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

        add_tri_group(group, f);

        let nl = tri.neighbours[i], nr = tri.neighbours[i > 0 ? (i - 1) : 2];
        if (nl >= 0) assign(nl, group, group_id);
        if (nr >= 0) assign(nr, group, group_id);
        offset += group.count;
      }
    }
  }
  return group_count;
};

const build_tangents = (tri_info, indices, groups, tri_groups, group_count, getters) => {
  let max_faces = 0;
  for (let i = 0; i < group_count; i++)
    if (max_faces < groups[i].count) max_faces = groups[i].count;

  for (let i = 0; i < group_count; i++) {
    const group = groups[i];
    const vert = group.vert, tangent = group.tangent;
    const s = group.offset, t = s + group.count;

    let n = new Vec3(), vs = new Vec3();
    let p0 = new Vec3(), p1 = new Vec3(), p2 = new Vec3();
    let v1 = new Vec3(), v2 = new Vec3();

    tangent.set(0, 0, 0);
    for (let i = s, il = t; i < il; i++) {
      const f = tri_groups[i], f3 = f * 3, info = tri_info[f];
      getters.normal(vert, n);

      if (!info.any) {
        let i = 2;
        if (indices[f3] == vert) i = 0;
        else if (indices[f3 + 1] == vert) i = 1;

        vs.copy(info.tangent);
        p0.copy(n).mul_f32(n.dot(info.tangent));
        vs.sub(p0);
        if (vec_non_zero(vs)) vs.unit();

        let i0 = indices[f3 + (i > 0 ? i - 1 : 2)];
        let i2 = indices[f3 + (i < 2 ? i + 1 : 0)];
        getters.pos(i0, p0);
        getters.pos(vert, p1);
        getters.pos(i2, p2);
        v1.copy(p0).sub(p1);
        v2.copy(p2).sub(p1);

        v1.sub(p0.copy(n).mul_f32(n.dot(v1)));
        if (vec_non_zero(v1)) v1.unit();
        v2.sub(p0.copy(n).mul_f32(n.dot(v2)));
        if (vec_non_zero(v2)) v2.unit();

        let cos = v1.dot(v2);
        let ang = Math.acos(cos);

        tangent.add(vs.mul_f32(ang));
      }
    }

    if (vec_non_zero(tangent)) tangent.unit();
  }
};