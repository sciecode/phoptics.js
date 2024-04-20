import { StructuredBuffer } from "./structured_buffer.mjs";

export class Mesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.dynamic = material.dynamic ? new StructuredBuffer(material.dynamic.info) : undefined;
  }
}