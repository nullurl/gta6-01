// Rae Vega: on-foot movement, entering and leaving cars, health and cash.
// The player is either walking or driving exactly one car at a time.

import { WALK_SPEED, SPRINT_SPEED, PLAYER_RADIUS, PLAYER_HEALTH, START_MONEY } from './config.js';
import { isDown } from './input.js';
import { clamp } from './random.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.health = PLAYER_HEALTH;
    this.money = START_MONEY;
    this.car = null;
    this.aimAngle = 0;
    this.onFoot = true;
    this.dead = false;
    this.busted = false;
    this.walkCycle = 0;
  }

  get speed() {
    return this.car ? this.car.speed : Math.hypot(this.vx, this.vy);
  }

  get speedKmh() {
    return this.car ? this.car.speedKmh : Math.round(this.speed * 0.35);
  }

  // On-foot step: WASD movement with acceleration and building collision.
  updateOnFoot(dt, city) {
    let ix = 0;
    let iy = 0;
    if (isDown('up')) iy -= 1;
    if (isDown('down')) iy += 1;
    if (isDown('left')) ix -= 1;
    if (isDown('right')) ix += 1;
    const len = Math.hypot(ix, iy) || 1;
    const maxSpeed = isDown('sprint') ? SPRINT_SPEED : WALK_SPEED;
    const tx = (ix / len) * maxSpeed * (ix || iy ? 1 : 0);
    const ty = (iy / len) * maxSpeed * (ix || iy ? 1 : 0);
    const k = 1 - Math.exp(-10 * dt);
    this.vx += (tx - this.vx) * k;
    this.vy += (ty - this.vy) * k;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.speed > 10) {
      this.angle = Math.atan2(this.vy, this.vx);
      this.walkCycle += dt * this.speed * 0.06;
    }
    city.collideCircle(this, PLAYER_RADIUS);
  }

  enterCar(car) {
    this.car = car;
    this.onFoot = false;
    car.driver = 'player';
    this.x = car.x;
    this.y = car.y;
  }

  exitCar() {
    if (!this.car) return;
    const car = this.car;
    const side = Math.random() < 0.5 ? 1 : -1;
    this.x = car.x + Math.cos(car.angle + Math.PI / 2) * side * 30;
    this.y = car.y + Math.sin(car.angle + Math.PI / 2) * side * 30;
    car.driver = null;
    car.vx *= 0.3;
    car.vy *= 0.3;
    this.car = null;
    this.onFoot = true;
    this.vx = 0;
    this.vy = 0;
    this.angle = car.angle;
  }

  // The closest car the player could enter (within reach, roughly).
  nearestCar(cars, maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of cars) {
      const d = (car.x - this.x) * (car.x - this.x) + (car.y - this.y) * (car.y - this.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  hurt(amount) {
    if (this.dead) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this.dead = true;
  }

  heal(amount) {
    this.health = Math.min(PLAYER_HEALTH, this.health + amount);
  }

  earn(amount) {
    this.money += amount;
  }

  fine(amount) {
    this.money = Math.max(0, this.money - amount);
  }

  resetAt(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.health = PLAYER_HEALTH;
    this.dead = false;
    this.busted = false;
    if (this.car) {
      this.car.driver = null;
      this.car = null;
    }
    this.onFoot = true;
  }

  serialize() {
    return {
      x: this.x, y: this.y, health: this.health, money: this.money,
      car: this.car ? { model: this.car.model.id, color: this.car.color, health: this.car.health } : null,
    };
  }
}
