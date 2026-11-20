// Combat: the player's pistol, bullets, and the rival crew that shoots back.
// Shooting is on foot only; drive-by would need its own aim model.

import { PLAYER_RADIUS } from './config.js';
import { playShoot } from './audio.js';

export class Bullets {
  constructor() {
    this.list = [];
  }

  fire(x, y, angle, speed, fromPlayer) {
    this.list.push({
      x: x + Math.cos(angle) * 20,
      y: y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.9,
      fromPlayer,
    });
    playShoot();
  }

  // Move bullets; report hits against buildings, cars, peds and rivals.
  update(dt, city, cars, peds, rivals, player, onHit) {
    const alive = [];
    for (const b of this.list) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) continue;
      if (city.buildingHit(b.x, b.y, 2)) {
        onHit(b.x, b.y, 'wall');
        continue;
      }
      let spent = false;
      if (!b.fromPlayer) {
        // Enemy bullet: only the player can be hit.
        if (!player.car && Math.hypot(b.x - player.x, b.y - player.y) < PLAYER_RADIUS + 4) {
          player.hurt(6);
          onHit(b.x, b.y, 'player');
          spent = true;
        }
      } else {
        for (const r of rivals) {
          if (r.dead) continue;
          if (Math.hypot(b.x - r.x, b.y - r.y) < 15) {
            r.health -= 50;
            onHit(b.x, b.y, 'rival');
            if (r.health <= 0) r.dead = true;
            spent = true;
            break;
          }
        }
        if (!spent) {
          for (const car of cars) {
            if (car === player.car) continue;
            const dx = b.x - car.x;
            const dy = b.y - car.y;
            const localX = dx * Math.cos(-car.angle) - dy * Math.sin(-car.angle);
            const localY = dx * Math.sin(-car.angle) + dy * Math.cos(-car.angle);
            if (Math.abs(localX) < car.model.len / 2 && Math.abs(localY) < car.model.wid / 2) {
              car.health = Math.max(0, car.health - 12);
              if (car.health < 35) car.smoking = true;
              onHit(b.x, b.y, 'car');
              spent = true;
              break;
            }
          }
        }
        if (!spent) {
          for (const p of peds) {
            if (p.state === 'down') continue;
            if (Math.hypot(b.x - p.x, b.y - p.y) < 12) {
              p.knockDown();
              onHit(b.x, b.y, 'ped');
              spent = true;
              break;
            }
          }
        }
      }
      if (!spent) alive.push(b);
    }
    this.list = alive;
  }
}

export class Rival {
  constructor(x, y, name) {
    this.x = x;
    this.y = y;
    this.name = name;
    this.health = 100;
    this.dead = false;
    this.shootTimer = 1 + Math.random() * 1.5;
    this.angle = Math.random() * Math.PI * 2;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.strafeTimer = 0;
  }

  update(dt, player, city, bullets) {
    if (this.dead) return;
    const px = player.car ? player.car.x : player.x;
    const py = player.car ? player.car.y : player.y;
    const d = Math.hypot(px - this.x, py - this.y);
    this.angle = Math.atan2(py - this.y, px - this.x);
    // Strafe sideways when the player is close, to stay a moving target.
    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeTimer = 1.2 + Math.random();
      this.strafe = -this.strafe;
    }
    if (d < 320) {
      const mx = Math.cos(this.angle + Math.PI / 2) * this.strafe;
      const my = Math.sin(this.angle + Math.PI / 2) * this.strafe;
      this.x += mx * 55 * dt;
      this.y += my * 55 * dt;
      city.collideCircle(this, 12);
    }
    this.shootTimer -= dt;
    if (d < 420 && this.shootTimer <= 0 && !player.dead) {
      this.shootTimer = 1.2 + Math.random() * 0.9;
      const spread = (Math.random() - 0.5) * 0.22;
      bullets.fire(this.x, this.y, this.angle + spread, 620, false);
    }
  }
}

export function makeRivals(spots) {
  const names = ['Vic', 'Sloan', 'Kurt', 'Dana', 'Rook', 'Milo'];
  return spots.map((s, i) => new Rival(s.x, s.y, names[i % names.length]));
}
