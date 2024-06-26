import { ResourceType, UNINITIALIZED } from "../constants.mjs";
import { OffsetAllocator } from "../../common/offset_allocator.mjs";
import { PoolStorage } from "../../common/pool_storage.mjs";
import { SparseSet } from "../../common/sparse_set.mjs";

export class VertexHeaps {
  constructor(backend) {
    this.backend = backend;

    this.heaps = new PoolStorage(); // buffers, allocators, backing
    this.bindings = new SparseSet(); // groups, layouts
    this.classes = new SparseSet(); // heaps, offsets
  }

  build_classes(attributes) {
    let vert_id = 0, inst_id = 0;
    let vertices = { entries: [], class: 0, size: 0 };
    let instanced = { entries: [], class: 0, size: 0 };
    for (let attrib of attributes.entries) {
      if (attrib.type == ResourceType.Vertex) {
        vertices.size += attrib.stride;
        vertices.class |= attrib.stride << (vert_id++ << 3);
        vertices.entries.push(attrib);
      } else {
        instanced.size += attrib.stride;
        instanced.class |= attrib.stride << (inst_id++ << 3);
        instanced.entries.push(attrib);
      }
    }

    return { vertices, instanced };
  }

  get_attributes(attributes) {
    let bid = attributes.get_bid();

    if (bid == UNINITIALIZED) {
      const { vertices, instanced } = this.build_classes(attributes);

      if (vertices.class) {
        // find / create class
        // find / create heap
        // allocate
      }

      if (instanced.class) {
        // find / create class
        // find / create heap
        // allocate
      }

      // query if binding exists / create
      // initialize attributes obj
    } else {
      // check for updates
      // for each heap update backing, store range
    }
  }
}