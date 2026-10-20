/**
 * Vector2.js — Thin helper/wrapper for 2D vector math.
 * Works with plain {x,y} objects so it can be used inside or outside p5.js.
 */
class Vector2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }

  /* ── Static factories ───────────────────────────────────── */
  static from(obj)          { return new Vector2(obj.x, obj.y); }
  static fromAngle(angle)   { return new Vector2(Math.cos(angle), Math.sin(angle)); }
  static random2D() {
    const a = Math.random() * Math.PI * 2;
    return new Vector2(Math.cos(a), Math.sin(a));
  }
  static zero()  { return new Vector2(0, 0); }
  static add(a, b) { return new Vector2(a.x + b.x, a.y + b.y); }
  static sub(a, b) { return new Vector2(a.x - b.x, a.y - b.y); }
  static mul(a, s) { return new Vector2(a.x * s, a.y * s); }
  static dist(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  static dot(a, b) { return a.x * b.x + a.y * b.y; }

  /* ── Instance methods ───────────────────────────────────── */
  add(v)    { this.x += v.x; this.y += v.y; return this; }
  sub(v)    { this.x -= v.x; this.y -= v.y; return this; }
  mul(s)    { this.x *= s;   this.y *= s;   return this; }
  div(s)    { if (s !== 0) { this.x /= s; this.y /= s; } return this; }

  copy()    { return new Vector2(this.x, this.y); }

  mag()     { return Math.sqrt(this.x * this.x + this.y * this.y); }
  magSq()   { return this.x * this.x + this.y * this.y; }

  normalize() {
    const m = this.mag();
    if (m > 0) { this.x /= m; this.y /= m; }
    return this;
  }

  setMag(m) { return this.normalize().mul(m); }

  limit(max) {
    const m = this.mag();
    if (m > max) this.setMag(max);
    return this;
  }

  heading() { return Math.atan2(this.y, this.x); }

  dist(v) { return Vector2.dist(this, v); }

  dot(v)  { return Vector2.dot(this, v); }

  lerp(v, t) {
    this.x += (v.x - this.x) * t;
    this.y += (v.y - this.y) * t;
    return this;
  }

  toObj() { return { x: this.x, y: this.y }; }

  toString() { return `Vector2(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`; }
}
