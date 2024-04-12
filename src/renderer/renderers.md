- [ ] ShaderLayout
  - [ ] Receives RenderPass - formats & per_pass bind layout
  - [ ] Receives per_shader, per_material, per_draw binding layouts
  - [ ] Creates Pipeline Layout
  - [ ] Stores RenderPass format

- [ ] Shader
  - [ ] Receives & Stores ShaderLayout Ref
  - [ ] Creates per_shader bind group variation

- [ ] Material
  - [ ] Receives Shader Ref
  - [ ] Receives Pipeline variations info
  - [ ] Creates per_material bind group variation
  - [ ] Requests Pipeline from cache & stores ref