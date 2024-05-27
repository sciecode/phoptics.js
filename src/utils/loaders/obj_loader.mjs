
const parse_faces = (info) => {
  do {
    const entries = info.lines[info.i].substring(2).split(' ');
    for (let index of entries) info.indices.push(index.split('/').map(e => parseInt(e) - 1));
    info.i++;
  } while (info.lines[info.i][0] == 'f');
}

const parse_positions = (info) => {
  do {
    const entries = info.lines[info.i].substring(2).split(' ');
    info.positions.push(entries.map(e => parseFloat(e)));
    info.i++;
  } while (info.lines[info.i][0] == 'v' && info.lines[info.i][1] == ' ');
}

const parse_normals = (info) => {
  do {
    const entries = info.lines[info.i].substring(3).split(' ');
    info.normals.push(entries.map(e => parseFloat(e)));
    info.i++;
  } while (info.lines[info.i][0] == 'v' && info.lines[info.i][1] == 'n');
}

const parse_uvs = (info) => {
  do {
    const entries = info.lines[info.i].substring(3).split(' ');
    info.uvs.push(entries.map(e => parseFloat(e)));
    info.i++;
  } while (info.lines[info.i][0] == 'v' && info.lines[info.i][1] == 't');
}

export class OBJLoader {

  constructor() {}

  async load(url) {
    return fetch(url).then( async response => {
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

      const stride = 3 + 3 + 2;
      const vert_count = info.indices.length;
      const data = new Float32Array(vert_count * stride);

      for (let i = 0; i < vert_count; i++) {
        let [ipos, iuv, inorm] = info.indices[i];
        const i8 = i * 8;
        data[i8] = info.positions[ipos][0];
        data[i8 + 1] = info.positions[ipos][1];
        data[i8 + 2] = info.positions[ipos][2];
        data[i8 + 3] = info.normals[inorm][0];
        data[i8 + 4] = info.normals[inorm][1];
        data[i8 + 5] = info.normals[inorm][2];
        data[i8 + 6] = info.uvs[iuv][0];
        data[i8 + 7] = info.uvs[iuv][1];
      }

      return { data, count: vert_count, stride: 32 };

    });
  }

}