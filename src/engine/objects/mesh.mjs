import { StructuredDynamic } from "./structured_dynamic.mjs";

export class Mesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.dynamic = material.dynamic ? new StructuredDynamic(material.dynamic.info) : undefined;
  }
}