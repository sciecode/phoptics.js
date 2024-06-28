import { Index, Vertex, Geometry } from 'phoptics';

export class SkyboxGeometry extends Geometry {
  constructor() {
    let positions = new Float32Array([
       1,  1, -1,
      -1,  1, -1,
       1, -1, -1,
      -1, -1, -1,
       1,  1,  1,
      -1,  1,  1,
       1, -1,  1,
      -1, -1,  1,
    ]);

    let index = new Uint16Array([
      0, 1, 2,
      1, 3, 2, // front
      5, 4, 7,
      4, 6, 7, // back
      4, 5, 0,
      5, 1, 0, // up
      2, 3, 6,
      3, 7, 6, // down
      4, 0, 6,
      0, 2, 6, // right
      1, 5, 3,
      5, 7, 3, // left
    ]);

    super({
      draw: { count: 36 },
      index: (new Index({ data: index, stride: 2 })).free_storage(),
      vertices: [(new Vertex({ data: positions, stride: 12 })).free_storage()]
    });
  }
}