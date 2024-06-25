import { Vec2, Vec3, Mat3x4 } from 'phoptics/math';

export class Orbit {
  constructor(node) {
    this.node = node;
    this.view = new Mat3x4();
    this.target = new Vec3();
    this.position = new Vec3().set(0, 0, 10);
    
    // rotation
    this.start = new Vec2();
    this.delta = new Vec2();
    this.sphr = new Vec2();
    this.sphr_delta = new Vec2();

    // zoom
    this.zoom = 1;
    this.zoom_limit = new Vec2().set(0, Infinity);

    this.dn_cb = this.dn.bind(this);
    this.mv_cb = this.mv.bind(this);
    this.up_cb = this.up.bind(this);
    this.zn_cb = this.zn.bind(this);

    this.node.addEventListener('pointerdown', this.dn_cb);
    this.node.addEventListener('wheel', this.zn_cb, { passive: true });

    this.update();
  }

  update() {
    // update rotation
    this.position.sub(this.target);
    let radius = this.position.length();
    this.sphr.theta = Math.atan2(this.position.x, this.position.z);
		this.sphr.phi = Math.acos(Math.min(Math.max(this.position.y / radius, -1), 1));
    this.sphr.add(this.sphr_delta);
    this.sphr.phi = Math.max(EPS, Math.min(Math.PI - EPS, this.sphr.phi));
    this.sphr_delta.set();

    // update offset
    radius = Math.min(Math.max(radius * this.zoom, this.zoom_limit.x), this.zoom_limit.y);
    const alp = Math.sin(this.sphr.phi) * radius;
		this.position.y = Math.cos(this.sphr.phi) * radius;
		this.position.x = alp * Math.sin(this.sphr.theta);
		this.position.z = alp * Math.cos(this.sphr.theta);
    this.zoom = 1;

    // update position
    this.position.add(this.target);
    this.view.translate(this.position).look_at(this.target).view_inverse();
  }

  zn(e) {
		const scl = Math.pow(0.95, Math.abs(e.deltaY * 0.01));
    this.zoom = e.deltaY > 0 ? this.zoom / scl : this.zoom * scl;
    this.update();
  }
  
  mv(e) {
    this.delta.set(e.clientX, e.clientY).sub(this.start);
    this.start.set(e.clientX, e.clientY);

    this.sphr_delta.theta -= 2 * Math.PI * this.delta.x / this.node.clientHeight;
    this.sphr_delta.phi -= 2 * Math.PI * this.delta.y / this.node.clientHeight;

    this.update();
  }

  dn(e) { 
    this.start.set(e.clientX, e.clientY);

    this.node.addEventListener('pointermove', this.mv_cb);
    this.node.addEventListener('pointerup', this.up_cb);
  }

  up() {
    this.node.removeEventListener('pointermove', this.mv_cb);
    this.node.removeEventListener('pointerup', this.up_cb);
  }
}

const EPS = 0.000001;