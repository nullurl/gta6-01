// Cars: arcade velocity-vector physics, body styles and the car catalogue.
// Every car in Solmara is one of these original models.

import { CAR_GRIP, CAR_DRAG, CAR_ROLL } from './config.js';
import { clamp } from './random.js';

export const CAR_MODELS = [
  { id: 'comet', name: 'Comet GT', top: 330, accel: 210, brake: 320, turn: 2.6, len: 46, wid: 22, colors: ['#d33a2c', '#f2c230', '#2c6fd3', '#e8e8e8'] },
  { id: 'sundown', name: 'Sundown Sedan', top: 260, accel: 170, brake: 300, turn: 2.3, len: 46, wid: 22, colors: ['#7a8b99', '#3f6d4e', '#b56576', '#d9d9d9'] },
  { id: 'vagabond', name: 'Vagabond Van', top: 215, accel: 140, brake: 260, turn: 1.9, len: 52, wid: 24, colors: ['#e8e8e8', '#5b8da8', '#c96f4a'] },
  { id: 'meridian', name: 'Meridian Coupe', top: 300, accel: 195, brake: 310, turn: 2.5, len: 44, wid: 21, colors: ['#22242c', '#8a2f4d', '#2f6d8a', '#e8b93c'] },
  { id: 'kestrel', name: 'Kestrel Hatch', top: 245, accel: 165, brake: 290, turn: 2.4, len: 40, wid: 20, colors: ['#e07840', '#4a9e6b', '#7a6fc0', '#d9d9d9'] },
  { id: 'bison', name: 'Bison Pickup', top: 240, accel: 155, brake: 280, turn: 2.1, len: 50, wid: 23, colors: ['#5a4632', '#31435c', '#a03a2c', '#d9d9d9'] },
  { id: 'cruiser', name: 'SPD Cruiser', top: 315, accel: 215, brake: 330, turn: 2.7, len: 47, wid: 22, colors: ['#f2f2f2'] },
];

export function modelById(id) {
  return CAR_MODELS.find((m) => m.id === id) || CAR_MODELS[1];
}

let nextCarId = 1;

export class Car {
  constructor(model, x, y, angle, color) {
    this.id = nextCarId;
    nextCarId += 1;
    this.model = model;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.vx = 0;
    this.vy = 0;
    this.color = color || model.colors[0];
    this.health = 100;
    this.smoking = false;
    this.driver = null; // 'player' | 'traffic' | 'police' | null (parked)
    this.stolen = false;
    this.blinker = 0;
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  get speedKmh() {
    return Math.round(this.speed * 0.55);
  }

  // Arcade drive step. throttle -1..1, steer -1..1, handbrake bool, dt seconds.
  drive(throttle, steer, handbrake, dt) {
    const m = this.model;
    const fx = Math.cos(this.angle);
    const fy = Math.sin(this.angle);
    const forwardSpeed = this.vx * fx + this.vy * fy;

    // Engine force along the heading.
    let accel = 0;
    if (throttle > 0) accel = throttle * m.accel;
    else if (throttle < 0) {
      accel = forwardSpeed > 8 ? throttle * m.brake : throttle * m.accel * 0.6;
    }
    this.vx += fx * accel * dt;
    this.vy += fy * accel * dt;

    // Steering: faster turn at speed, capped so slow cars still turn.
    const spd = this.speed;
    const turnAuthority = clamp(spd / 120, 0.25, 1);
    const dir = forwardSpeed < -1 ? -1 : 1;
    this.angle += steer * m.turn * turnAuthority * dir * dt * (handbrake ? 1.5 : 1);

    // Grip: bleed sideways velocity, less when handbraking (drift).
    const nx = Math.cos(this.angle);
    const ny = Math.sin(this.angle);
    const fSpeed = this.vx * nx + this.vy * ny;
    const sSpeed = -this.vx * ny + this.vy * nx;
    const grip = handbrake ? CAR_GRIP * 0.25 : CAR_GRIP;
    const newSide = sSpeed * Math.exp(-grip * dt);
    this.vx = nx * fSpeed - ny * newSide;
    this.vy = ny * fSpeed + nx * newSide;

    // Drag and rolling resistance.
    const drag = Math.exp(-(CAR_DRAG * 0.12 + CAR_ROLL * 0.1) * dt);
    this.vx *= drag;
    this.vy *= drag;

    // Top speed cap (forward only).
    const f2 = this.vx * nx + this.vy * ny;
    if (f2 > m.top) {
      const over = f2 - m.top;
      this.vx -= nx * over;
      this.vy -= ny * over;
    }
    if (f2 < -m.top * 0.45) {
      const over = -m.top * 0.45 - f2;
      this.vx += nx * over;
      this.vy += ny * over;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  // Simple circle-ish collision between two cars: push apart, swap some speed.
  collideWith(other) {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    const min = (this.model.len + other.model.len) / 2 - 8;
    const d2 = dx * dx + dy * dy;
    if (d2 >= min * min || d2 < 0.01) return false;
    const d = Math.sqrt(d2);
    const push = (min - d) / 2;
    const ux = dx / d;
    const uy = dy / d;
    this.x -= ux * push;
    this.y -= uy * push;
    other.x += ux * push;
    other.y += uy * push;
    const rel = (this.vx - other.vx) * ux + (this.vy - other.vy) * uy;
    if (rel > 0) {
      const impulse = rel * 0.6;
      this.vx -= ux * impulse;
      this.vy -= uy * impulse;
      other.vx += ux * impulse;
      other.vy += uy * impulse;
      return true;
    }
    return true;
  }
}

export function damageCar(car, amount) {
  car.health = Math.max(0, car.health - amount);
  if (car.health < 35) car.smoking = true;
}
