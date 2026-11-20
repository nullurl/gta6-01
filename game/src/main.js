// SOLMARA: the game itself. Wires the city, the player, traffic, police,
// combat and missions into one loop, plus the title, pause and end screens.

import { City, LANDMARKS } from './city.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { spawnTraffic, spawnPedestrians, spawnParkedCars, seededRng, TrafficCar } from './traffic.js';
import { Bullets } from './combat.js';
import { MissionManager } from './missions.js';
import { Renderer } from './render.js';
import { Minimap } from './minimap.js';
import { Hud } from './hud.js';
import { initInput, isDown, wasPressed, mouse, endFrameInput } from './input.js';
import { initAudio, resumeAudio, toggleMute, updateAudio, playCrash, playPickup, playBusted } from './audio.js';
import { hasSave, saveGame, loadSave } from './save.js';
import { applyShotScene, shotName } from './shots.js';
import { damageCar, modelById, Car } from './vehicles.js';
import { WORLD_W, WORLD_H } from './config.js';

const $ = (id) => document.getElementById(id);

class Game {
  constructor() {
    this.canvas = $('game');
    this.city = new City();
    this.player = new Player(LANDMARKS.safehouse.x, LANDMARKS.safehouse.y);
    this.police = new Police(this.city);
    this.bullets = new Bullets();
    this.rivals = [];
    this.cars = [];
    this.traffic = [];
    this.peds = [];
    this.missions = new MissionManager(this);
    this.renderer = new Renderer(this.canvas);
    this.minimap = new Minimap($('minimap'));
    this.hud = new Hud();
    this.state = 'title'; // title | playing | paused | ended
    this.endKind = null; // 'busted' | 'wasted'
    this.time = 0;
    this.titlePan = 0;
    this.rng = seededRng();
    this.respawnAt = LANDMARKS.safehouse;

    this.police.onWantedChange = (stars, before) => {
      if (stars > before) this.feed(`WANTED LEVEL ${stars} — the Solmara PD is on you!`);
      else if (stars === 0 && before > 0) this.feed('You lost them. The heat is off.');
    };
    this.police.onBusted = () => this.endGame('busted');

    this.buildWorld();
    this.wireScreens();
    initInput(this.canvas);
    window.addEventListener('resize', () => this.renderer.resize());
    window.__solmara = this;
  }

  get view() {
    return this.renderer.view;
  }

  buildWorld() {
    this.cars = spawnParkedCars(this.city, this.rng);
    this.traffic = spawnTraffic(this.city, 14, this.rng, this.player);
    for (const t of this.traffic) this.cars.push(t.car);
    this.peds = spawnPedestrians(this.city, 26, this.rng, this.player);
    // The player's own starter car outside the safehouse, on the road.
    const starter = new Car(modelById('sundown'), LANDMARKS.safehouse.x, LANDMARKS.safehouse.y + 70, Math.PI / 2, '#7a8b99');
    starter.driver = null;
    this.cars.push(starter);
  }

  feed(text) {
    this.hud.feed(text);
  }

  banner(big, sub) {
    this.hud.banner(big, sub);
  }

  wireScreens() {
    $('btn-new').addEventListener('click', () => {
      initAudio();
      resumeAudio();
      this.startNewGame();
    });
    $('btn-continue').addEventListener('click', () => {
      initAudio();
      resumeAudio();
      this.continueGame();
    });
    $('btn-resume').addEventListener('click', () => this.togglePause(false));
    $('btn-save').addEventListener('click', () => {
      this.autosave();
      this.feed('Game saved.');
    });
    $('btn-restart-mission').addEventListener('click', () => {
      this.missions.restartMission();
      this.togglePause(false);
    });
    $('btn-quit').addEventListener('click', () => this.quitToTitle());
    $('btn-retry').addEventListener('click', () => this.retryAfterEnd());
    $('btn-end-quit').addEventListener('click', () => this.quitToTitle());
    if (hasSave()) $('btn-continue').classList.remove('hidden');
  }

  startNewGame() {
    this.player = new Player(LANDMARKS.safehouse.x, LANDMARKS.safehouse.y);
    this.police.clear();
    this.bullets = new Bullets();
    this.rivals = [];
    this.missions = new MissionManager(this);
    this.buildWorld();
    this.renderer.snapTo(this.player.x, this.player.y);
    this.state = 'playing';
    $('title-screen').classList.add('hidden');
    $('pause-screen').classList.add('hidden');
    $('end-screen').classList.add('hidden');
    this.missions.nextMissionIndex = 0;
    this.missions.nextMissionTimer = 2;
    this.banner('SOLMARA', 'A new wheelman in town. Your first job is coming.');
  }

  continueGame() {
    const data = loadSave();
    this.startNewGame();
    if (!data) return;
    this.player.x = data.player.x;
    this.player.y = data.player.y;
    this.player.health = data.player.health;
    this.player.money = data.player.money;
    this.missions.restore(data.missions);
    if (data.clock) this.hud.gameMinutes = data.clock;
    this.renderer.snapTo(this.player.x, this.player.y);
    this.feed('Save loaded. Welcome back to Solmara.');
  }

  quitToTitle() {
    this.state = 'title';
    $('pause-screen').classList.add('hidden');
    $('end-screen').classList.add('hidden');
    $('title-screen').classList.remove('hidden');
    if (hasSave()) $('btn-continue').classList.remove('hidden');
  }

  togglePause(force) {
    if (this.state === 'playing' && force !== false) {
      this.state = 'paused';
      const m = this.missions.mission;
      $('pause-stats').textContent = `Cash $${this.player.money} · Jobs done ${this.missions.completedCount} / 5`
        + (m ? ` · Current job: ${m.name}` : '');
      $('pause-screen').classList.remove('hidden');
    } else if (this.state === 'paused' && force !== true) {
      this.state = 'playing';
      $('pause-screen').classList.add('hidden');
    }
  }

  endGame(kind) {
    if (this.state !== 'playing') return;
    this.state = 'ended';
    this.endKind = kind;
    playBusted();
    if (kind === 'busted') {
      this.player.fine(200);
      this.player.busted = true;
      $('end-title').textContent = 'BUSTED';
      $('end-text').textContent = 'The Solmara PD caught up with Rae. $200 fine, and the job is blown.';
      this.respawnAt = LANDMARKS.policeHQ;
      this.missions.failMission('Busted by the Solmara PD.');
    } else {
      this.player.fine(100);
      $('end-title').textContent = 'WASTED';
      $('end-text').textContent = 'Rae is down. The hospital patched you up for $100 — the job is blown.';
      this.respawnAt = LANDMARKS.hospital;
      this.missions.failMission('Rae went down.');
    }
    this.police.clear();
    $('end-screen').classList.remove('hidden');
  }

  retryAfterEnd() {
    this.player.resetAt(this.respawnAt.x, this.respawnAt.y);
    this.renderer.snapTo(this.player.x, this.player.y);
    $('end-screen').classList.add('hidden');
    this.state = 'playing';
    this.missions.restartMission();
  }

  autosave() {
    saveGame({
      player: this.player.serialize(),
      missions: this.missions.serialize(),
      clock: this.hud.gameMinutes,
    });
  }

  // ---- per-frame updates ----

  update(dt) {
    this.time += dt;
    if (this.state === 'title') {
      // Slow cinematic pan across the city behind the title.
      this.titlePan += dt * 0.02;
      const cx = WORLD_W / 2 + Math.cos(this.titlePan) * 700;
      const cy = WORLD_H / 2 + Math.sin(this.titlePan * 0.7) * 450;
      this.renderer.follow(cx, cy, dt);
      this.updateAmbient(dt);
      return;
    }
    if (this.state !== 'playing') return;

    if (wasPressed('pause')) {
      this.togglePause();
      return;
    }
    if (wasPressed('mute')) {
      const m = toggleMute();
      this.feed(m ? 'Sound off.' : 'Sound on.');
    }

    const p = this.player;

    // Enter / exit cars.
    if (wasPressed('enter')) {
      if (p.car) {
        const fast = p.car.speed > 150;
        p.exitCar();
        if (fast) {
          p.hurt(12);
          this.feed('Bailing out at speed hurts.');
        }
      } else {
        const near = p.nearestCar(this.cars, 62);
        if (near) this.enterCar(near);
      }
    }

    // Aim with the mouse; shoot on foot.
    if (!p.car) {
      const wx = (mouse.x - this.canvas.width / 2) / this.renderer.zoom + this.renderer.camX;
      const wy = (mouse.y - this.canvas.height / 2) / this.renderer.zoom + this.renderer.camY;
      p.aimAngle = Math.atan2(wy - p.y, wx - p.x);
      if (mouse.clicked) {
        this.bullets.fire(p.x, p.y, p.aimAngle, 780, true);
        this.renderer.muzzle = 0.08;
        this.renderer.addShake(1.5);
        // Gunfire draws the law, but slowly: one star per 8 seconds of
        // shooting, so a firefight does not instantly max the heat.
        this.police.addStars(1, false, 8);
      }
      p.updateOnFoot(dt, this.city);
    } else {
      const throttle = (isDown('up') ? 1 : 0) + (isDown('down') ? -1 : 0);
      const steer = (isDown('left') ? -1 : 0) + (isDown('right') ? 1 : 0);
      const wrecked = p.car.health <= 0;
      p.car.drive(wrecked ? 0 : throttle, steer, isDown('brake'), dt);
      p.x = p.car.x;
      p.y = p.car.y;
      p.angle = p.car.angle;
      if (p.car.health <= 0 && !p.car.smoking) p.car.smoking = true;
    }

    this.updateAmbient(dt);
    this.police.update(dt, p, this.cars, (x, y, s) => {
      this.renderer.spawnParticles(x, y, 6, '#888', 120);
    });
    this.bullets.update(dt, this.city, this.cars, this.peds, this.rivals, p, (x, y, what) => {
      this.renderer.spawnParticles(x, y, 4, what === 'player' ? '#ff5c5c' : '#ffd25e', 140);
      if (what === 'player') this.renderer.addShake(4);
      if (what === 'ped') this.police.addStars(1);
    });
    for (const r of this.rivals) r.update(dt, p, this.city, this.bullets);
    this.missions.update(dt);
    this.collideAll(dt);

    // Slow health regen while the heat is off.
    if (this.police.stars === 0 && p.health > 0 && p.health < 100) p.heal(dt * 2);

    // Camera, HUD, minimap, audio.
    const fx = p.car ? p.car.x : p.x;
    const fy = p.car ? p.car.y : p.y;
    this.renderer.follow(fx, fy, dt);
    this.renderer.updateParticles(dt);
    this.hud.update(dt, this);
    this.minimap.draw(this);
    const nearestCop = this.police.nearestCopDist(p);
    updateAudio(!!p.car, p.speedKmh, nearestCop);

    if (p.dead) this.endGame('wasted');
  }

  enterCar(car) {
    const p = this.player;
    const wasTraffic = car.driver === 'traffic';
    if (wasTraffic) {
      const i = this.traffic.findIndex((t) => t.car === car);
      if (i >= 0) this.traffic.splice(i, 1);
      this.police.addStars(1);
      this.feed('You jacked a car — the law noticed.');
    }
    p.enterCar(car);
    playPickup();
  }

  updateAmbient(dt) {
    // Traffic drives; wrecked or far-away cars get replaced.
    for (const t of this.traffic) t.update(dt, this.cars, this.player.car);
    if (this.traffic.length < 14 && Math.random() < dt * 0.5) {
      const fresh = spawnTraffic(this.city, 1, this.rng, this.player);
      for (const t of fresh) {
        this.traffic.push(t);
        this.cars.push(t.car);
      }
    }
    // Pedestrians walk and flee.
    const threats = [];
    if (this.bullets.list.length > 0) {
      const b = this.bullets.list[0];
      threats.push({ x: b.x, y: b.y, radius: 260 });
    }
    if (this.player.car && this.player.car.speed > 160) {
      threats.push({ x: this.player.car.x, y: this.player.car.y, radius: 150 });
    }
    for (const ped of this.peds) ped.update(dt, this.city, threats, this.rng);
    if (this.peds.length < 26 && Math.random() < dt * 0.5) {
      const fresh = spawnPedestrians(this.city, 1, this.rng, this.player);
      this.peds.push(...fresh);
    }
  }

  collideAll(dt) {
    const p = this.player;
    const allCars = [...this.cars, ...this.police.cops];

    // Cars vs buildings.
    for (const car of allCars) {
      const before = car.speed;
      const hit = this.city.collideCircle(car, 21);
      if (hit && before > 130) {
        damageCar(car, Math.min(20, before / 22));
        playCrash();
        this.renderer.spawnParticles(car.x, car.y, 8, '#aaa', 160);
        car.vx *= 0.45;
        car.vy *= 0.45;
        if (car === p.car) this.renderer.addShake(5);
      }
    }

    // Cars vs cars.
    for (let i = 0; i < allCars.length; i += 1) {
      for (let j = i + 1; j < allCars.length; j += 1) {
        const a = allCars[i];
        const b = allCars[j];
        const relSpeed = Math.hypot(a.vx - b.vx, a.vy - b.vy);
        if (a.collideWith(b) && relSpeed > 120) {
          damageCar(a, relSpeed / 30);
          damageCar(b, relSpeed / 30);
          playCrash();
          this.renderer.spawnParticles((a.x + b.x) / 2, (a.y + b.y) / 2, 8, '#ccc', 180);
          if (a === p.car || b === p.car) this.renderer.addShake(4);
          // Ramming a cop car while accelerating raises the heat — a cruiser
          // shunting a slow or coasting player does not.
          if ((a.driver === 'police' || b.driver === 'police') && (a === p.car || b === p.car)
            && p.car.speed > 120 && isDown('up')) {
            this.police.addStars(1);
          }
          // Traffic cars panic when hit.
          for (const t of this.traffic) {
            if (t.car === a || t.car === b) t.panic();
          }
        }
      }
    }

    // Cars vs pedestrians (only the player's car can hurt them).
    if (p.car && p.car.speed > 50) {
      for (const ped of this.peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.x - p.car.x, ped.y - p.car.y) < 26) {
          ped.knockDown();
          this.police.addStars(1);
          this.feed('You hit a pedestrian!');
          this.renderer.spawnParticles(ped.x, ped.y, 8, '#ff5c5c', 140);
          this.renderer.addShake(3);
        }
      }
    }

    // Dust behind a fast car.
    if (p.car && p.car.speed > 200 && Math.random() < dt * 20) {
      this.renderer.spawnParticles(
        p.car.x - Math.cos(p.car.angle) * 24,
        p.car.y - Math.sin(p.car.angle) * 24,
        1, '#c9b489', 30,
      );
    }
  }

  draw() {
    this.renderer.draw(this);
    if (this.state === 'playing') this.renderer.drawObjectiveArrow(this);
  }

  loop = (t) => {
    const dt = Math.min(0.05, (t - (this.lastT || t)) / 1000 || 0.016);
    this.lastT = t;
    this.update(dt);
    this.draw();
    endFrameInput();
    requestAnimationFrame(this.loop);
  };

  start() {
    const shot = shotName();
    if (shot && shot !== 'start') {
      // Screenshot mode: skip the title and stage the scene. The transient
      // mission banner is hidden so the capture shows the game itself; the
      // persistent HUD still carries the mission name and objective.
      this.startNewGame();
      applyShotScene(this);
      this.hud.bannerEl.style.display = 'none';
      this.hud.bannerTimer = 0;
      this.hud.update(0, this);
      this.minimap.draw(this);
    }
    window.__solmaraReady = true;
    requestAnimationFrame(this.loop);
  }
}

const game = new Game();
game.start();
