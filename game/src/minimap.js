// The minimap: the whole city shrunk to a corner canvas, with the player,
// the objective, police and fares drawn on it every frame.

import { WORLD_W, WORLD_H, ROAD_XS, ROAD_YS, BEACH_Y, SEA_Y } from './config.js';

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = canvas.width;
    this.h = canvas.height;
  }

  draw(game) {
    const c = this.ctx;
    const sx = this.w / WORLD_W;
    const sy = this.h / WORLD_H;
    c.clearRect(0, 0, this.w, this.h);
    c.fillStyle = '#232a35';
    c.fillRect(0, 0, this.w, this.h);
    // Sea and beach.
    c.fillStyle = '#1d5f7a';
    c.fillRect(0, SEA_Y * sy, this.w, this.h - SEA_Y * sy);
    c.fillStyle = '#8a7a52';
    c.fillRect(0, BEACH_Y * sy, this.w, (SEA_Y - BEACH_Y) * sy);
    // Roads.
    c.strokeStyle = '#4a5261';
    c.lineWidth = 2;
    for (const x of ROAD_XS) {
      c.beginPath();
      c.moveTo(x * sx, 0);
      c.lineTo(x * sx, this.h);
      c.stroke();
    }
    for (const y of ROAD_YS) {
      c.beginPath();
      c.moveTo(0, y * sy);
      c.lineTo(this.w, y * sy);
      c.stroke();
    }
    // Parks.
    c.fillStyle = '#3f7d44';
    for (const p of game.city.parks) {
      c.fillRect(p.x0 * sx, p.y0 * sy, (p.x1 - p.x0) * sx, (p.y1 - p.y0) * sy);
    }
    // Objective marker (pulsing).
    const marker = game.missions.markerPos();
    if (marker) {
      const pulse = 3 + Math.sin(performance.now() / 180) * 1.5;
      c.fillStyle = '#ffd25e';
      c.beginPath();
      c.arc(marker.x * sx, marker.y * sy, pulse + 2, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#14100a';
      c.lineWidth = 1;
      c.stroke();
    }
    // Police cruisers flash blue/red.
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    c.fillStyle = flash ? '#4aa3ff' : '#ff4a4a';
    for (const cop of game.police.cops) {
      c.beginPath();
      c.arc(cop.x * sx, cop.y * sy, 3, 0, Math.PI * 2);
      c.fill();
    }
    // Rivals show red while a mission runs.
    c.fillStyle = '#ff5c5c';
    for (const r of game.rivals) {
      if (!r.dead) {
        c.fillRect(r.x * sx - 2, r.y * sy - 2, 4, 4);
      }
    }
    // Player arrow.
    const p = game.player;
    const px = (p.car ? p.car.x : p.x) * sx;
    const py = (p.car ? p.car.y : p.y) * sy;
    const angle = p.car ? p.car.angle : p.angle;
    c.save();
    c.translate(px, py);
    c.rotate(angle);
    c.fillStyle = '#ffffff';
    c.strokeStyle = '#14100a';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(7, 0);
    c.lineTo(-5, -4.5);
    c.lineTo(-5, 4.5);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
    // Viewport frame.
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = 1;
    const vw = game.view.w / WORLD_W * this.w;
    const vh = game.view.h / WORLD_H * this.h;
    c.strokeRect(
      (game.view.x - game.view.w / 2) / WORLD_W * this.w,
      (game.view.y - game.view.h / 2) / WORLD_H * this.h,
      vw,
      vh,
    );
  }
}
