import { StructuredDynamic } from "./structured_dynamic.mjs";

export class Mesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.dynamic = (material.dynamic && this.geometry.draw.instance_count == 1) ? 
      new StructuredDynamic(material.dynamic) : undefined;
  }
}