// HUD: the DOM layer over the canvas — stars, health, money, objective,
// speed, feed messages and the big centre banner.

import { MAX_STARS } from './config.js';
import { districtAt } from './city.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.starsEl = $('stars');
    this.healthEl = $('healthfill');
    this.moneyEl = $('money');
    this.districtEl = $('district');
    this.missionNameEl = $('mission-name');
    this.missionTextEl = $('mission-text');
    this.speedEl = $('speed');
    this.carNameEl = $('carname');
    this.hintEl = $('hint');
    this.feedEl = $('feed');
    this.bannerEl = $('banner');
    this.clockEl = $('clock');
    this.bannerTimer = 0;
    this.lastStars = -1;
    this.lastMoney = -1;
    this.lastHealth = -1;
    this.lastObjective = '';
    this.gameMinutes = 9 * 60;
  }

  update(dt, game) {
    const p = game.player;
    const stars = game.police.stars;
    if (stars !== this.lastStars) {
      this.lastStars = stars;
      let html = '';
      for (let i = 0; i < MAX_STARS; i += 1) {
        html += i < stars ? '★' : '<span class="off">★</span>';
      }
      if (game.police.evading) html += ' <span style="font-size:12px;color:#8fe388">EVADING</span>';
      this.starsEl.innerHTML = html;
    }
    const health = Math.round(p.health);
    if (health !== this.lastHealth) {
      this.lastHealth = health;
      this.healthEl.style.width = `${health}%`;
      this.healthEl.style.background = health > 50
        ? 'linear-gradient(90deg,#7be495,#3ecf6e)'
        : health > 25
          ? 'linear-gradient(90deg,#ffd25e,#f5a623)'
          : 'linear-gradient(90deg,#ff7a5c,#d33a2c)';
    }
    if (p.money !== this.lastMoney) {
      this.lastMoney = p.money;
      this.moneyEl.textContent = `$${p.money.toLocaleString('en-US')}`;
    }
    const px = p.car ? p.car.x : p.x;
    const py = p.car ? p.car.y : p.y;
    this.districtEl.textContent = districtAt(px, py);

    const m = game.missions.mission;
    const obj = game.missions.objective;
    let name = 'Free roam';
    let text = 'Explore Solmara. Missions arrive as you play.';
    if (game.missions.active && m) {
      name = `${m.name} · ${m.giver}`;
      text = obj ? obj.text : '';
    } else if (game.missions.fare && obj) {
      name = 'Taxi fare';
      text = obj.text;
    }
    const key = `${name}|${text}`;
    if (key !== this.lastObjective) {
      this.lastObjective = key;
      this.missionNameEl.textContent = name;
      this.missionTextEl.textContent = text;
    }

    this.speedEl.textContent = String(p.speedKmh);
    if (p.car) {
      this.carNameEl.textContent = `${p.car.model.name} · ${Math.round(p.car.health)}%`;
      this.hintEl.textContent = 'W/S drive · A/D steer · Space handbrake · E exit';
    } else {
      this.carNameEl.textContent = 'On foot';
      const near = p.nearestCar(game.cars, 60);
      this.hintEl.textContent = near
        ? `E — enter the ${near.model.name}${near.driver === 'traffic' ? ' (jack it!)' : ''}`
        : 'WASD move · Shift sprint · Mouse aim · Click shoot · E car';
    }

    // In-game clock: one game hour per two real minutes.
    this.gameMinutes += dt * 0.5;
    const total = Math.floor(this.gameMinutes);
    const day = 1 + Math.floor(total / 1440);
    const hh = String(Math.floor((total % 1440) / 60)).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    this.clockEl.textContent = `DAY ${day} · ${hh}:${mm}`;

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerEl.style.display = 'none';
    }
  }

  feed(text) {
    const div = document.createElement('div');
    div.textContent = text;
    this.feedEl.appendChild(div);
    while (this.feedEl.children.length > 4) this.feedEl.removeChild(this.feedEl.firstChild);
    window.setTimeout(() => {
      if (div.parentNode) div.parentNode.removeChild(div);
    }, 6000);
  }

  banner(big, sub) {
    this.bannerEl.querySelector('.big').textContent = big;
    this.bannerEl.querySelector('.sub').textContent = sub || '';
    this.bannerEl.style.display = 'block';
    this.bannerTimer = 4;
  }
}
