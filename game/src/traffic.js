// Ambient life: traffic cars that drive the road grid and pedestrians who walk
// the sidewalks and flee from danger. Both use the city's road graph.

import { ROAD_XS, ROAD_YS, LANE } from './config.js';
import { CAR_MODELS, Car, modelById } from './vehicles.js';
import { mulberry32, pick, range } from './random.js';

const PED_COLORS = ['#d94f3d', '#3d7dd9', '#e8c33c', '#4fae62', '#c05fd0', '#e8e8e8', '#333a44', '#e07840'];
const PED_NAMES = ['Tomas', 'Lena', 'Marco', 'Priya', 'Jonas', 'Aisha', 'Ruth', 'Diego', 'Nina', 'Omar'];

export class TrafficCar {
  constructor(car, city) {
    this.car = car;
    this.car.driver = 'traffic';
    this.city = city;
    this.target = this.pickNextTarget();
    this.wait = 0;
    this.panicked = 0;
  }

  pickNextTarget() {
    const near = this.city.nearestIntersection(this.car.x, this.car.y);
    const options = this.city.neighbours(near);
    return options[Math.floor(Math.random() * options.length)] || near;
  }

  update(dt, cars, playerCar) {
    const car = this.car;
    if (this.wait > 0) {
      this.wait -= dt;
      car.drive(0, 0, false, dt);
      return;
    }
    const tx = this.target.x;
    const ty = this.target.y;
    const dx = tx - car.x;
    const dy = ty - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 30) {
      this.target = this.pickNextTarget();
      return;
    }
    // Lane offset: drive on the right side of the road.
    const movingVertical = Math.abs(dx) < Math.abs(dy);
    let lx = tx;
    let ly = ty;
    if (movingVertical) lx = tx + (dy > 0 ? LANE : -LANE);
    else ly = ty + (dx > 0 ? -LANE : LANE);
    const want = Math.atan2(ly - car.y, lx - car.x);
    let steer = 0;
    let d = want - car.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    steer = Math.max(-1, Math.min(1, d * 2.2));

    // Brake for the car ahead.
    let throttle = 0.55;
    const aheadX = car.x + Math.cos(car.angle) * 70;
    const aheadY = car.y + Math.sin(car.angle) * 70;
    for (const other of cars) {
      if (other === car) continue;
      if (Math.hypot(other.x - aheadX, other.y - aheadY) < 42) {
        throttle = -0.8;
        break;
      }
    }
    if (this.panicked > 0) {
      this.panicked -= dt;
      throttle = 1;
    }
    car.drive(throttle, steer, false, dt);
  }

  panic() {
    this.panicked = 2.5;
  }
}

export class Pedestrian {
  constructor(x, y, rng) {
    this.x = x;
    this.y = y;
    this.angle = rng() * Math.PI * 2;
    this.speed = range(rng, 45, 70);
    this.color = pick(rng, PED_COLORS);
    this.name = pick(rng, PED_NAMES);
    this.state = 'walk'; // walk | flee | down
    this.stateTime = 0;
    this.tx = x;
    this.ty = y;
    this.retarget(rng);
  }

  retarget(rng) {
    // Walk to a nearby point along a road (sidewalk offset).
    const vertical = rng() < 0.5;
    if (vertical) {
      const rx = pick(rng, ROAD_XS);
      this.tx = rx + (rng() < 0.5 ? 46 : -46);
      this.ty = this.y + range(rng, -400, 400);
    } else {
      const ry = pick(rng, ROAD_YS);
      this.ty = ry + (rng() < 0.5 ? 46 : -46);
      this.tx = this.x + range(rng, -400, 400);
    }
  }

  update(dt, city, threats, rng) {
    this.stateTime -= dt;
    if (this.state === 'down') {
      if (this.stateTime <= 0) {
        this.state = 'flee';
        this.stateTime = 3;
      }
      return;
    }
    // Flee from gunfire or a fast car nearby.
    let fleeX = 0;
    let fleeY = 0;
    for (const t of threats) {
      const d = Math.hypot(t.x - this.x, t.y - this.y);
      if (d < t.radius) {
        fleeX += (this.x - t.x) / (d + 1);
        fleeY += (this.y - t.y) / (d + 1);
      }
    }
    if (fleeX !== 0 || fleeY !== 0) {
      this.state = 'flee';
      this.stateTime = 2;
      this.angle = Math.atan2(fleeY, fleeX);
      const sp = 200;
      this.x += Math.cos(this.angle) * sp * dt;
      this.y += Math.sin(this.angle) * sp * dt;
      city.collideCircle(this, 10);
      return;
    }
    if (this.state === 'flee' && this.stateTime > 0) {
      const sp = 200;
      this.x += Math.cos(this.angle) * sp * dt;
      this.y += Math.sin(this.angle) * sp * dt;
      city.collideCircle(this, 10);
      return;
    }
    this.state = 'walk';
    const dx = this.tx - this.x;
    const dy = this.ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      this.retarget(rng);
      return;
    }
    this.angle = Math.atan2(dy, dx);
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    city.collideCircle(this, 10);
  }

  knockDown() {
    if (this.state !== 'down') {
      this.state = 'down';
      this.stateTime = 5;
    }
  }
}

export function spawnTraffic(city, count, rng, excludeNear) {
  const list = [];
  let guard = 0;
  while (list.length < count && guard < count * 40) {
    guard += 1;
    const p = city.intersections[Math.floor(rng() * city.intersections.length)];
    const vertical = rng() < 0.5;
    const along = range(rng, -120, 120);
    const x = vertical ? p.x + (rng() < 0.5 ? LANE : -LANE) : p.x + along;
    const y = vertical ? p.y + along : p.y + (rng() < 0.5 ? LANE : -LANE);
    if (excludeNear && Math.hypot(x - excludeNear.x, y - excludeNear.y) < 500) continue;
    const model = pick(rng, CAR_MODELS.filter((m) => m.id !== 'cruiser'));
    const car = new Car(model, x, y, rng() * Math.PI * 2, pick(rng, model.colors));
    list.push(new TrafficCar(car, city));
  }
  return list;
}

export function spawnPedestrians(city, count, rng, excludeNear) {
  const list = [];
  let guard = 0;
  while (list.length < count && guard < count * 40) {
    guard += 1;
    const x = range(rng, 150, 3450);
    const y = range(rng, 150, 2450);
    if (!city.isOnRoad(x, y)) continue;
    if (excludeNear && Math.hypot(x - excludeNear.x, y - excludeNear.y) < 350) continue;
    list.push(new Pedestrian(x, y, rng));
  }
  return list;
}

export function spawnParkedCars(city, rng) {
  // Parked cars in the lots and along road edges: free to take.
  const cars = [];
  for (const lot of city.lots) {
    const n = Math.floor((lot.x1 - lot.x0) / 70);
    for (let i = 0; i < n; i += 1) {
      if (rng() < 0.4) continue;
      const model = pick(rng, CAR_MODELS.filter((m) => m.id !== 'cruiser'));
      const x = lot.x0 + 35 + i * 70;
      const y = (lot.y0 + lot.y1) / 2 + (rng() < 0.5 ? -20 : 20);
      const car = new Car(model, x, y, rng() < 0.5 ? 0 : Math.PI, pick(rng, model.colors));
      car.driver = null;
      cars.push(car);
    }
  }
  return cars;
}

export function seededRng() {
  return mulberry32(987654321);
}
