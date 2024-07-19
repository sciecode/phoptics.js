import { Geometry, Vertex } from 'phoptics';

const parse_faces = (info) => {
  do {
    const entries = info.lines[info.i].substring(2).split(' ');
    for (let index of entries) info.indices.push(index.split('/').map(e => parseInt(e) - 1));
    info.i++;
  } while (info.lines[info.i][0] == 'f');
};

const parse_positions = (info) => {
  do {
    const entries = info.lines[info.i].substring(2).split(' ');
    info.positions.push(entries.map(e => parseFloat(e)));
    info.i++;
  } while (info.lines[info.i][0] == 'v' && info.lines[info.i][1] == ' ');
};

const parse_normals = (info) => {
  do {
    const entries = info.lines[info.i].substring(3).split(' ');
    info.normals.push(entries.map(e => parseFloat(e)));
    info.i++;
  } while (info.lines[info.i][0] == 'v' && info.lines[info.i][1] == 'n');
};

const parse_uvs = (info) => {
  do {
    const entries = info.lines[info.i].substring(3).split(' ');
    info.uvs.push(entries.map(e => parseFloat(e)));
    info.i++;
  } while (info.lines[info.i][0] == 'v' && info.lines[info.i][1] == 't');
};

export class OBJLoader {

  constructor() {}

  async load(url) {
    return fetch(url).then(async response => {
      if (!response.ok) return undefined;

      let info = {
        i: 0,
        lines: (await response.text()).split('\n'),
        indices: [],
        positions: [],
        normals: [],
        uvs: [],
      };

      for (; info.i < info.lines.length;) {
        switch (info.lines[info.i][0]) {
          case 'f': parse_faces(info); break;
          case 'v':
            if (info.lines[info.i][1] == ' ') parse_positions(info);
            else if (info.lines[info.i][1] == 'n') parse_normals(info);
            else if (info.lines[info.i][1] == 't') parse_uvs(info);
            break;
          default: info.i++;
        }
      }

      const vert_count = info.indices.length;
      let vertices = [];

      if (info.positions.length) {
        const pos = { data: new Float32Array(3 * vert_count), stride: 12 };
        for (let i = 0; i < vert_count; i++) {
          let [ipos, iuv, inorm] = info.indices[i];
          const i3 = i * 3;
          pos.data[i3] = info.positions[ipos][0];
          pos.data[i3 + 1] = info.positions[ipos][1];
          pos.data[i3 + 2] = info.positions[ipos][2];
        }
        vertices.push(new Vertex(pos));
      }

      if (info.normals.length) {
        const norm = { data: new Float32Array(3 * vert_count), stride: 12 };
        for (let i = 0; i < vert_count; i++) {
          let [ipos, iuv, inorm] = info.indices[i];
          const i3 = i * 3;
          norm.data[i3] = info.normals[inorm][0];
          norm.data[i3 + 1] = info.normals[inorm][1];
          norm.data[i3 + 2] = info.normals[inorm][2];
        }
        vertices.push(new Vertex(norm));
      }

      if (info.uvs.length) {
        const uv = { data: new Float32Array(2 * vert_count), stride: 8 };
        for (let i = 0; i < vert_count; i++) {
          let [ipos, iuv, inorm] = info.indices[i];
          const i2 = i * 2;
          uv.data[i2] = info.uvs[iuv][0] % 1;
          uv.data[i2 + 1] = info.uvs[iuv][1] % 1;
        }
        vertices.push(new Vertex(uv));
      }

      const geo = new Geometry({
        draw: { count: vert_count },
        vertices
      });

      return geo;

    });
  }

}