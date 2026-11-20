// The Solmara PD: wanted stars, pursuing cruisers, busting and evading.
// Heat rises when the player is seen committing crimes and falls when unseen.

import { MAX_STARS, EVADE_DIST, EVADE_TIME, BUST_TIME, BUST_DIST } from './config.js';
import { Car, modelById, damageCar } from './vehicles.js';
import { clamp, angleDiff } from './random.js';
import { playSirenBlip } from './audio.js';

export class Police {
  constructor(city) {
    this.city = city;
    this.stars = 0;
    this.cops = [];
    this.unseenTime = 0;
    this.decayTimer = 0;
    this.bustTimer = 0;
    this.crimeCooldown = 0;
    this.evading = false;
    this.lastKnownX = 0;
    this.lastKnownY = 0;
    this.hasLastKnown = false;
    this.onWantedChange = null;
    this.onBusted = null;
  }

  addStars(n, silent, cooldownSec = 1.5) {
    if (this.crimeCooldown > 0 && n > 0) return;
    const before = this.stars;
    this.stars = clamp(this.stars + n, 0, MAX_STARS);
    if (n > 0) this.crimeCooldown = cooldownSec;
    if (this.stars !== before) {
      // Only fresh heat resets the escape clock; decay leaves it running.
      if (this.stars > before) {
        this.unseenTime = 0;
        this.evading = false;
        if (!silent) playSirenBlip();
      }
      if (this.onWantedChange) this.onWantedChange(this.stars, before);
    }
  }

  setStars(n) {
    const before = this.stars;
    this.stars = clamp(n, 0, MAX_STARS);
    this.unseenTime = 0;
    this.evading = false;
    if (this.stars !== before && this.onWantedChange) this.onWantedChange(this.stars, before);
  }

  clear() {
    this.setStars(0);
    this.cops = [];
    this.bustTimer = 0;
  }

  wantedCount() {
    // Cruisers on the street for the current heat.
    return this.stars === 0 ? 0 : Math.min(1 + this.stars, 6);
  }

  nearestCopDist(player) {
    let best = Infinity;
    for (const cop of this.cops) {
      const d = Math.hypot(cop.x - player.x, cop.y - player.y);
      if (d < best) best = d;
    }
    return best;
  }

  spawnCopNear(player) {
    // Spawn on a road 700-1000 units away, off the player's screen.
    const angle = Math.random() * Math.PI * 2;
    const dist = 700 + Math.random() * 300;
    let x = player.x + Math.cos(angle) * dist;
    let y = player.y + Math.sin(angle) * dist;
    const near = this.city.nearestIntersection(x, y);
    x = near.x;
    y = near.y;
    const car = new Car(modelById('cruiser'), x, y, Math.atan2(player.y - y, player.x - x), '#f2f2f2');
    car.driver = 'police';
    car.blinker = Math.random() * 10;
    this.cops.push(car);
    return car;
  }

  update(dt, player, cars, onCrash) {
    if (this.crimeCooldown > 0) this.crimeCooldown -= dt;

    const px = player.car ? player.car.x : player.x;
    const py = player.car ? player.car.y : player.y;
    const playerSpeed = player.speed;

    // Evade logic: unseen for a while, then the heat falls one star at a time.
    // While evading, cruisers search the last known position and no fresh
    // ones join the chase, so a fast car that breaks away can shake them.
    const nearest = this.nearestCopDist({ x: px, y: py });
    if (this.stars > 0) {
      if (nearest > EVADE_DIST) {
        this.unseenTime += dt;
        if (this.unseenTime > EVADE_TIME) {
          this.evading = true;
          this.decayTimer += dt;
          if (this.decayTimer > 3) {
            this.decayTimer = 0;
            this.addStars(-1);
            if (this.stars === 0) this.evading = false;
          }
        }
      } else {
        this.unseenTime = 0;
        this.evading = false;
        this.decayTimer = 0;
        this.lastKnownX = px;
        this.lastKnownY = py;
        this.hasLastKnown = true;
      }
    }

    // Keep the street force at strength — but not while the trail is cold.
    const want = this.evading ? 0 : this.wantedCount();
    while (this.cops.length < want) this.spawnCopNear(player);
    while (this.cops.length > want && !this.evading) this.cops.pop();
    if (this.evading) {
      // Cruisers that lost the trail drift off and leave.
      this.cops = this.cops.filter((cop) => Math.hypot(cop.x - px, cop.y - py) < 1300);
    }

    // Bust logic: pinned at near-zero speed next to a cruiser.
    if (this.stars > 0 && playerSpeed < 12 && nearest < BUST_DIST) {
      this.bustTimer += dt;
      if (this.bustTimer > BUST_TIME && this.onBusted) {
        this.bustTimer = 0;
        this.onBusted();
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }

    // Drive every cruiser at the player — or at the last known spot when the
    // player is out of sight. Cruisers only know where the player is while
    // one of them can see them; beyond that they search the old position,
    // which is what makes breaking away possible.
    const tracking = nearest <= EVADE_DIST;
    const searchX = this.hasLastKnown ? this.lastKnownX : px;
    const searchY = this.hasLastKnown ? this.lastKnownY : py;
    for (const cop of this.cops) {
      cop.blinker += dt;
      const tx = tracking ? px : searchX;
      const ty = tracking ? py : searchY;
      const dx = tx - cop.x;
      const dy = ty - cop.y;
      const dist = Math.hypot(dx, dy);
      const wantAngle = Math.atan2(dy, dx);
      const diff = angleDiff(cop.angle, wantAngle);
      let steer = clamp(diff * 2.4, -1, 1);
      let throttle = tracking ? 0.9 : 0.7;
      if (dist < 60 && tracking) {
        // Ram: keep pushing into the player.
        throttle = 1;
      } else if (Math.abs(diff) > 2.2 && cop.speed < 40) {
        // Turned around: back up and swing.
        throttle = -0.7;
        steer = -steer;
      } else if (dist < 40 && !tracking) {
        throttle = 0;
      }
      // Rubber-band a little so a fast car can still escape at low heat.
      const topBoost = this.stars >= 4 ? 1.08 : this.stars >= 2 ? 1.0 : 0.92;
      cop.drive(throttle, steer, false, dt);
      if (cop.speed > cop.model.top * topBoost) {
        const s = cop.model.top * topBoost / cop.speed;
        cop.vx *= s;
        cop.vy *= s;
      }
      const hitBuilding = this.city.collideCircle(cop, 22);
      if (hitBuilding && cop.speed > 120) {
        damageCar(cop, 8);
        if (onCrash) onCrash(cop.x, cop.y, 0.4);
        cop.vx *= 0.5;
        cop.vy *= 0.5;
      }
    }
  }
}
