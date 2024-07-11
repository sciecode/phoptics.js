
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
    let import_map = {}, pos = shader.indexOf('@import');
    while (pos > -1) {
      const st = pos;
      pos += 8;
      const delim = shader.indexOf(';', pos);
      let comma = shader.indexOf(',', pos);
      while (comma + 1 && comma < delim) {
        const name = shader.substring(pos, comma).trim();
        const module = this.modules[name];
        if (!module) throw `ShaderLib: module '${name}' not loaded.`;
        if (!import_map[name]) {
          shader = shader.concat(module);
          import_map[name] = true;
        }
        pos = comma + 1;
        comma = shader.indexOf(',', pos);
      }

      if (!(delim + 1)) throw `ShaderLib: invalid @import syntax.`;
      const name = shader.substring(pos, delim).trim();
      const module = this.modules[name];
      if (!module) throw `ShaderLib: module '${name}' not loaded.`;
      shader = shader.substring(0, st).concat(shader.substring(delim + 1));
      if (!import_map[name]) {
        shader = shader.concat(module);
        import_map[name] = true;
      }
      pos = shader.indexOf('@import', delim + 1);
    }
    return shader;
  }
}