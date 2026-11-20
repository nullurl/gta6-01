// Rendering: the camera and every brush stroke of Solmara — ground, roads,
// buildings, trees, cars, people, bullets, particles and mission beacons.

import { WORLD_W, WORLD_H, ROAD_XS, ROAD_YS, ROAD_W, BEACH_Y, SEA_Y, PALETTE } from './config.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camX = WORLD_W / 2;
    this.camY = WORLD_H / 2;
    this.zoom = 1;
    this.shake = 0;
    this.particles = [];
    this.muzzle = 0;
    this.resize();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.viewW = this.canvas.width / this.zoom;
    this.viewH = this.canvas.height / this.zoom;
  }

  get view() {
    return { x: this.camX, y: this.camY, w: this.viewW, h: this.viewH };
  }

  follow(x, y, dt) {
    const k = 1 - Math.exp(-6 * dt);
    this.camX += (x - this.camX) * k;
    this.camY += (y - this.camY) * k;
    this.camX = Math.max(this.viewW / 2, Math.min(WORLD_W - this.viewW / 2, this.camX));
    this.camY = Math.max(this.viewH / 2, Math.min(WORLD_H - this.viewH / 2, this.camY));
  }

  snapTo(x, y) {
    this.camX = x;
    this.camY = y;
  }

  addShake(amount) {
    this.shake = Math.min(14, this.shake + amount);
  }

  spawnParticles(x, y, n, color, speed) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.4 + Math.random() * 0.5,
        max: 0.9,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  updateParticles(dt) {
    const alive = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      alive.push(p);
    }
    this.particles = alive;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);
    if (this.muzzle > 0) this.muzzle -= dt;
  }

  draw(game) {
    const c = this.ctx;
    const { camX, camY } = this;
    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    c.save();
    c.translate(this.canvas.width / 2 + shakeX, this.canvas.height / 2 + shakeY);
    c.scale(this.zoom, this.zoom);
    c.translate(-camX, -camY);

    const left = camX - this.viewW / 2 - 60;
    const right = camX + this.viewW / 2 + 60;
    const top = camY - this.viewH / 2 - 60;
    const bottom = camY + this.viewH / 2 + 60;

    this.drawGround(c, left, right, top, bottom);
    this.drawRoads(c, left, right, top, bottom);
    this.drawParks(c, game, left, right, top, bottom);
    this.drawBuildings(c, game, left, right, top, bottom);
    this.drawTrees(c, game, left, right, top, bottom);
    this.drawMissionBeacon(c, game);
    this.drawCars(c, game, left, right, top, bottom);
    this.drawPeds(c, game, left, right, top, bottom);
    this.drawRivals(c, game);
    this.drawPlayer(c, game);
    this.drawBullets(c, game);
    this.drawParticles(c);

    c.restore();
    this.drawVignette(c);
  }

  drawGround(c, left, right, top, bottom) {
    c.fillStyle = PALETTE.ground;
    c.fillRect(left, top, right - left, bottom - top);
    // Mow stripes for a little texture.
    c.fillStyle = PALETTE.groundAlt;
    for (let y = Math.floor(top / 240) * 240; y < bottom; y += 240) {
      c.fillRect(left, y, right - left, 120);
    }
    // Beach and sea.
    c.fillStyle = PALETTE.beach;
    c.fillRect(left, BEACH_Y, right - left, SEA_Y - BEACH_Y);
    const seaGrad = c.createLinearGradient(0, SEA_Y, 0, WORLD_H);
    seaGrad.addColorStop(0, PALETTE.sea);
    seaGrad.addColorStop(1, PALETTE.seaDeep);
    c.fillStyle = seaGrad;
    c.fillRect(left, SEA_Y, right - left, WORLD_H - SEA_Y);
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(left, SEA_Y);
    c.lineTo(right, SEA_Y);
    c.stroke();
  }

  drawRoads(c, left, right, top, bottom) {
    c.fillStyle = PALETTE.sidewalk;
    for (const x of ROAD_XS) c.fillRect(x - ROAD_W / 2 - 10, top, ROAD_W + 20, bottom - top);
    for (const y of ROAD_YS) c.fillRect(left, y - ROAD_W / 2 - 10, right - left, ROAD_W + 20);
    c.fillStyle = PALETTE.road;
    for (const x of ROAD_XS) c.fillRect(x - ROAD_W / 2, top, ROAD_W, bottom - top);
    for (const y of ROAD_YS) c.fillRect(left, y - ROAD_W / 2, right - left, ROAD_W);
    // Centre dashes.
    c.fillStyle = PALETTE.lane;
    for (const x of ROAD_XS) {
      for (let y = Math.floor(top / 44) * 44; y < bottom; y += 44) {
        if (ROAD_YS.some((ry) => Math.abs(y - ry) < ROAD_W / 2 + 14)) continue;
        c.fillRect(x - 2, y, 4, 22);
      }
    }
    for (const y of ROAD_YS) {
      for (let x = Math.floor(left / 44) * 44; x < right; x += 44) {
        if (ROAD_XS.some((rx) => Math.abs(x - rx) < ROAD_W / 2 + 14)) continue;
        c.fillRect(x, y - 2, 22, 4);
      }
    }
  }

  drawParks(c, game, left, right, top, bottom) {
    c.fillStyle = PALETTE.park;
    for (const p of game.city.parks) {
      if (p.x1 < left || p.x0 > right || p.y1 < top || p.y0 > bottom) continue;
      c.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
    }
    c.fillStyle = PALETTE.plaza;
    for (const lot of game.city.lots) {
      if (lot.x1 < left || lot.x0 > right || lot.y1 < top || lot.y0 > bottom) continue;
      c.fillRect(lot.x0, lot.y0, lot.x1 - lot.x0, lot.y1 - lot.y0);
      c.strokeStyle = 'rgba(255,255,255,0.4)';
      c.lineWidth = 2;
      for (let x = lot.x0 + 35; x < lot.x1; x += 70) {
        c.beginPath();
        c.moveTo(x - 24, lot.y0 + 12);
        c.lineTo(x - 24, lot.y1 - 12);
        c.stroke();
      }
    }
  }

  drawBuildings(c, game, left, right, top, bottom) {
    for (const b of game.city.buildings) {
      if (b.x1 < left || b.x0 > right || b.y1 < top || b.y0 > bottom) continue;
      c.fillStyle = 'rgba(0,0,0,0.22)';
      c.fillRect(b.x0 + 6, b.y0 + 8, b.x1 - b.x0, b.y1 - b.y0);
      c.fillStyle = b.roof;
      c.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      c.strokeStyle = PALETTE.buildingEdge;
      c.lineWidth = 2;
      c.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      // Roof furniture: a lighter inset and a vent or two.
      c.fillStyle = 'rgba(255,255,255,0.14)';
      c.fillRect(b.x0 + 10, b.y0 + 10, b.x1 - b.x0 - 20, b.y1 - b.y0 - 20);
      c.fillStyle = 'rgba(0,0,0,0.18)';
      const vw = Math.min(18, (b.x1 - b.x0) / 4);
      c.fillRect(b.x0 + 14, b.y0 + 14, vw, vw);
      if (b.tall) {
        c.fillStyle = 'rgba(255,255,255,0.25)';
        c.fillRect(b.x0 + (b.x1 - b.x0) / 2 - 4, b.y0 + 12, 8, b.y1 - b.y0 - 24);
      }
    }
  }

  drawTrees(c, game, left, right, top, bottom) {
    for (const t of game.city.trees) {
      if (t.x < left || t.x > right || t.y < top || t.y > bottom) continue;
      c.fillStyle = 'rgba(0,0,0,0.2)';
      c.beginPath();
      c.ellipse(t.x + 4, t.y + 5, t.r, t.r * 0.8, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = t.palm ? PALETTE.tree : PALETTE.treeDark;
      c.beginPath();
      c.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = PALETTE.tree;
      c.beginPath();
      c.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.55, 0, Math.PI * 2);
      c.fill();
    }
  }

  drawMissionBeacon(c, game) {
    const marker = game.missions.markerPos();
    if (!marker) return;
    const pulse = 1 + Math.sin(performance.now() / 240) * 0.12;
    c.save();
    c.globalAlpha = 0.9;
    c.strokeStyle = '#ffd25e';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(marker.x, marker.y, 46 * pulse, 0, Math.PI * 2);
    c.stroke();
    c.globalAlpha = 0.25;
    c.fillStyle = '#ffd25e';
    c.beginPath();
    c.arc(marker.x, marker.y, 46 * pulse, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 0.5;
    c.fillStyle = '#ffd25e';
    c.beginPath();
    c.moveTo(marker.x - 8, marker.y - 90);
    c.lineTo(marker.x + 8, marker.y - 90);
    c.lineTo(marker.x, marker.y - 40);
    c.closePath();
    c.fill();
    c.restore();
  }

  drawCarShape(c, car) {
    const m = car.model;
    const L = m.len;
    const W = m.wid;
    c.save();
    c.translate(car.x, car.y);
    c.rotate(car.angle);
    // Shadow.
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath();
    c.roundRect(-L / 2 + 3, -W / 2 + 4, L, W, 7);
    c.fill();
    // Body.
    c.fillStyle = car.color;
    c.beginPath();
    c.roundRect(-L / 2, -W / 2, L, W, 7);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.35)';
    c.lineWidth = 1.5;
    c.stroke();
    // Cabin and glass.
    c.fillStyle = '#1d2530';
    c.beginPath();
    c.roundRect(-L * 0.18, -W / 2 + 4, L * 0.34, W - 8, 4);
    c.fill();
    c.fillStyle = 'rgba(160,220,255,0.5)';
    c.beginPath();
    c.roundRect(L * 0.06, -W / 2 + 5, L * 0.12, W - 10, 3);
    c.fill();
    // Headlights and taillights.
    c.fillStyle = '#fff7c0';
    c.fillRect(L / 2 - 3, -W / 2 + 3, 3, 5);
    c.fillRect(L / 2 - 3, W / 2 - 8, 3, 5);
    c.fillStyle = '#ff3b30';
    c.fillRect(-L / 2, -W / 2 + 3, 3, 5);
    c.fillRect(-L / 2, W / 2 - 8, 3, 5);
    // Police light bar.
    if (car.model.id === 'cruiser') {
      const flash = Math.floor(performance.now() / 220 + car.blinker) % 2 === 0;
      c.fillStyle = flash ? '#ff3b30' : '#2f7bff';
      c.fillRect(-4, -W / 2 + 2, 8, 6);
      c.fillStyle = flash ? '#2f7bff' : '#ff3b30';
      c.fillRect(-4, W / 2 - 8, 8, 6);
      c.fillStyle = '#14181f';
      c.font = 'bold 7px Verdana';
      c.textAlign = 'center';
      c.fillText('SPD', 0, 3);
    }
    // Damage smoke.
    if (car.smoking) {
      c.fillStyle = 'rgba(60,60,60,0.5)';
      const wob = Math.sin(performance.now() / 90 + car.id) * 4;
      c.beginPath();
      c.arc(L / 2 - 6 + wob, -4, 6, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  drawCars(c, game, left, right, top, bottom) {
    const all = [...game.cars, ...game.police.cops];
    for (const car of all) {
      if (car.x < left || car.x > right || car.y < top || car.y > bottom) continue;
      this.drawCarShape(c, car);
    }
    // The mission target car gets a gold ring.
    const target = game.missions.targetCar;
    if (target && game.missions.step && game.missions.step.type === 'steal') {
      c.strokeStyle = '#ffd25e';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(target.x, target.y, 40 + Math.sin(performance.now() / 200) * 4, 0, Math.PI * 2);
      c.stroke();
    }
  }

  drawPeds(c, game, left, right, top, bottom) {
    for (const p of game.peds) {
      if (p.x < left || p.x > right || p.y < top || p.y > bottom) continue;
      c.save();
      c.translate(p.x, p.y);
      if (p.state === 'down') {
        c.rotate(Math.PI / 2);
        c.fillStyle = p.color;
        c.beginPath();
        c.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
        c.fill();
      } else {
        c.rotate(p.angle);
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.beginPath();
        c.ellipse(2, 3, 9, 7, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(0, 0, 8, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#e8c39a';
        c.beginPath();
        c.arc(5, 0, 4.5, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }
  }

  drawRivals(c, game) {
    for (const r of game.rivals) {
      if (r.dead) {
        c.save();
        c.translate(r.x, r.y);
        c.rotate(Math.PI / 2);
        c.fillStyle = '#7a1f1f';
        c.beginPath();
        c.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
        continue;
      }
      c.save();
      c.translate(r.x, r.y);
      c.rotate(r.angle);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.beginPath();
      c.ellipse(2, 3, 10, 8, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#a83232';
      c.beginPath();
      c.arc(0, 0, 9, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#e8c39a';
      c.beginPath();
      c.arc(5, 0, 4.5, 0, Math.PI * 2);
      c.fill();
      // Gun.
      c.fillStyle = '#222';
      c.fillRect(8, -1.5, 9, 3);
      c.restore();
      // Health tick.
      c.fillStyle = '#333';
      c.fillRect(r.x - 12, r.y - 20, 24, 4);
      c.fillStyle = '#ff5c5c';
      c.fillRect(r.x - 12, r.y - 20, 24 * (r.health / 100), 4);
    }
  }

  drawPlayer(c, game) {
    const p = game.player;
    if (p.car) {
      // The car is drawn by drawCars; add a small marker above it.
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(p.car.x, p.car.y - 34);
      c.lineTo(p.car.x - 6, p.car.y - 44);
      c.lineTo(p.car.x + 6, p.car.y - 44);
      c.closePath();
      c.fill();
      return;
    }
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.aimAngle);
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath();
    c.ellipse(2, 3, 11, 9, 0, 0, Math.PI * 2);
    c.fill();
    // Rae: teal jacket, dark jeans.
    c.fillStyle = '#1f9e8a';
    c.beginPath();
    c.arc(0, 0, 10, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e8c39a';
    c.beginPath();
    c.arc(6, 0, 5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#222';
    c.fillRect(9, -1.5, 10, 3);
    // Muzzle flash.
    if (this.muzzle > 0) {
      c.fillStyle = '#ffe27a';
      c.beginPath();
      c.arc(22, 0, 7, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  drawBullets(c, game) {
    c.fillStyle = '#ffe27a';
    for (const b of game.bullets.list) {
      c.beginPath();
      c.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
      c.fill();
    }
  }

  drawParticles(c) {
    for (const p of this.particles) {
      c.globalAlpha = Math.max(0, p.life / p.max);
      c.fillStyle = p.color;
      c.beginPath();
      c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  drawVignette(c) {
    const g = c.createRadialGradient(
      this.canvas.width / 2, this.canvas.height / 2, Math.min(this.canvas.width, this.canvas.height) * 0.45,
      this.canvas.width / 2, this.canvas.height / 2, Math.max(this.canvas.width, this.canvas.height) * 0.75,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(10,8,4,0.35)');
    c.fillStyle = g;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // Off-screen objective arrow at the screen edge.
  drawObjectiveArrow(game) {
    const marker = game.missions.markerPos();
    if (!marker) return;
    const c = this.ctx;
    const p = game.player;
    const px = p.car ? p.car.x : p.x;
    const py = p.car ? p.car.y : p.y;
    const sx = (marker.x - this.camX) * this.zoom + this.canvas.width / 2;
    const sy = (marker.y - this.camY) * this.zoom + this.canvas.height / 2;
    if (sx > 0 && sx < this.canvas.width && sy > 0 && sy < this.canvas.height) return;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const angle = Math.atan2(sy - cy, sx - cx);
    const ex = cx + Math.cos(angle) * (Math.min(this.canvas.width, this.canvas.height) / 2 - 60);
    const ey = cy + Math.sin(angle) * (Math.min(this.canvas.width, this.canvas.height) / 2 - 60);
    c.save();
    c.translate(ex, ey);
    c.rotate(angle);
    c.fillStyle = '#ffd25e';
    c.beginPath();
    c.moveTo(16, 0);
    c.lineTo(-8, -10);
    c.lineTo(-8, 10);
    c.closePath();
    c.fill();
    c.restore();
    c.fillStyle = '#ffd25e';
    c.font = 'bold 13px Verdana';
    c.textAlign = 'center';
    c.fillText(`${Math.round(Math.hypot(marker.x - px, marker.y - py))}m`, ex, ey + 28);
  }
}
