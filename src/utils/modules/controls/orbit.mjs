import { Vec3, Mat3x4 } from 'phoptics/math';
// TODO: use vec2

export class Orbit {
  constructor(node) {
    this.node = node;
    this.view = new Mat3x4();
    this.target = new Vec3();
    this.position = new Vec3();
    this.position.set(0, 0, 10);

    // rotation
    this.start = new Vec3();
    this.delta = new Vec3();
    this.tmp = new Vec3();
    this.sphr = new Vec3();
    this.sphr_delta = new Vec3();

    // zoom
    this.zoom = 1;
    this.zoom_limit = (new Vec3()).set(0, Infinity);

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
    this.tmp.copy(this.position).sub(this.target);
    let radius = this.tmp.length();
    this.sphr.x = Math.atan2(this.tmp.x, this.tmp.z);
		this.sphr.y = Math.acos(Math.min( Math.max(this.tmp.y / radius, - 1), 1));
    this.sphr.add(this.sphr_delta);
    this.sphr.y = Math.max(EPS, Math.min( Math.PI - EPS, this.sphr.y ));
    this.sphr_delta.set();

    
    // update offset
    radius = Math.min( Math.max(radius * this.zoom, this.zoom_limit.x), this.zoom_limit.y);
    const alp = Math.sin(this.sphr.y) * radius;
		this.tmp.x = alp * Math.sin(this.sphr.x);
		this.tmp.y = Math.cos(this.sphr.y) * radius;
		this.tmp.z = alp * Math.cos(this.sphr.x);
    this.zoom = 1;

    // update position
    this.position.copy(this.target).add(this.tmp);
    this.view.translate(this.position).look_at(this.target).view_inverse();
  }

  zn(e) {
		const scl = Math.pow(0.95, Math.abs(e.deltaY * 0.01));
    this.zoom = e.deltaY > 0 ? this.zoom / scl : this.zoom * scl;
    this.update();
  }

  dn(e) { 
    this.start.set(e.clientX, e.clientY);

    this.node.addEventListener('pointermove', this.mv_cb);
    this.node.addEventListener('pointerup', this.up_cb);
  }

  mv(e) {
    this.delta.set(e.clientX, e.clientY);
    this.tmp.copy(this.delta);
    this.delta.sub(this.start);
    this.start.copy(this.tmp);

    this.sphr_delta.x -= 2 * Math.PI * this.delta.x / this.node.clientHeight;
	  this.sphr_delta.y -= 2 * Math.PI * this.delta.y / this.node.clientHeight;

    this.update();
  }

  up() {
    this.node.removeEventListener('pointermove', this.mv_cb);
    this.node.removeEventListener('pointerup', this.up_cb);
  }
}

const EPS = 0.000001;