
export class ShaderLib {
  constructor(modules) {
    this.modules = {};
    if (modules) this.load(modules);
  }
  load(modules) {
    for (let name in modules)
      this.modules[name] = modules[name];
  }
  generate(shader) {
    let pos = shader.indexOf('@import');
    while (pos > -1) {
      const st = pos;
      pos += 8;
      const delim = shader.indexOf(';', pos);
      let comma = shader.indexOf(',', pos);
      while (comma + 1 && comma < delim) {
        const name = shader.substring(pos, comma).trim();
        const module = this.modules[name];
        if (!module) throw `ShaderLib: module '${name}' not loaded.`;
        shader = shader.concat(module);
        pos = comma + 1;
        comma = shader.indexOf(',', pos);
      }

      if (!(delim + 1)) throw `ShaderLib: invalid @import syntax.`;
      const name = shader.substring(pos, delim).trim();
      const module = this.modules[name];
      if (!module) throw `ShaderLib: module '${name}' not loaded.`;
      shader = shader.substring(0, st).concat(shader.substring(delim + 1), module);
      pos = shader.indexOf('@import', delim + 1);
    }
    return shader;
  }
}