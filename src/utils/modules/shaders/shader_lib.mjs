import { Shader } from 'phoptics';

export class ShaderLib {
  constructor(modules) {
    this.modules = {};
    this.shaders = new Map();
    if (modules) this.load_modules(modules);
  }
  load_modules(modules) {
    for (let name in modules)
      this.modules[name] = modules[name];
  }
  register(shaders) {
    for (let name in shaders)
      this.shaders.set(name, this.process(shaders[name]));
  }
  get(name) { return this.shaders.get(name); }
  destroy(name) { this.shaders.get(name).destroy(); this.shaders.delete(name); }
  process(shader) {
    let import_map = {}, pos = shader.indexOf('@import');
    while (pos > -1) {
      const st = pos; pos += 8;
      const delim = shader.indexOf(';', pos);
      let comma = shader.indexOf(',', pos);

      while (comma + 1 && comma < delim) {
        const name = shader.substring(pos, comma).trim();
        shader = this.#append(name, shader, import_map);
        pos = comma + 1;
        comma = shader.indexOf(',', pos);
      }

      if (!(delim + 1)) throw `ShaderLib: invalid @import syntax.`;
      const name = shader.substring(pos, delim).trim();
      shader = shader.substring(0, st).concat(shader.substring(delim + 1));
      shader = this.#append(name, shader, import_map);
      pos = shader.indexOf('@import', delim + 1);
    }
    return new Shader({ code: shader });
  }
  #append(name, shader, import_map) {
    const module = this.modules[name];
    if (!module) throw `ShaderLib: module '${name}' not loaded.`;
    if (!import_map[name]) {
      shader = shader.concat(module);
      import_map[name] = true;
    }
    return shader;
  }
}