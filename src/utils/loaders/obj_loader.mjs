
const parse_faces = (info) => {
  do {
    const entries = info.lines[info.i].substring(2).split(' ');
    for (let index of entries) info.indices.push(parseInt(index.split('/')[0]) - 1);
    info.i++;
  } while (info.lines[info.i][0] == 'f');
}

const parse_positions = (info) => {
  do {
    const entries = info.lines[info.i].substring(2).split(' ');
    for (let index of entries) info.positions.push(parseFloat(index));
    info.i++;
  } while (info.lines[info.i][0] == 'v' && info.lines[info.i][1] == ' ');
}

const parse_normals = (info) => {
  do {
    const entries = info.lines[info.i].substring(3).split(' ');
    for (let index of entries) info.normals.push(parseFloat(index));
    info.i++;
  } while (info.lines[info.i][0] == 'v' && info.lines[info.i][1] == 'n');
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
        normals: []
      };

      for (; info.i < info.lines.length;) {
        switch (info.lines[info.i][0]) {
          case 'f': parse_faces(info); break;
          case 'v':
            if (info.lines[info.i][1] == ' ') parse_positions(info);
            else if (info.lines[info.i][1] == 'n') parse_normals(info);
            break;
          default: info.i++;
        }
      }

      return {
        indices: info.indices,
        positions: info.positions,
        normals: info.normals,
      }

    });
  }

}