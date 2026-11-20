// Screenshot scenes: deterministic setups of the real running game, chosen
// with ?shot=<scene>. The game plays normally from each setup; the captures
// are the game's own rendering, never edited or composited.

import { LANDMARKS } from './city.js';
import { Car, modelById } from './vehicles.js';

export function shotName() {
  const params = new URLSearchParams(window.location.search);
  return params.get('shot') || null;
}

// Place the player in a car at a spot, facing a direction, already moving.
function placeInCar(game, modelId, color, x, y, angle, speed) {
  const car = new Car(modelById(modelId), x, y, angle, color);
  car.vx = Math.cos(angle) * speed;
  car.vy = Math.sin(angle) * speed;
  game.cars.push(car);
  game.player.x = x;
  game.player.y = y;
  game.player.enterCar(car);
  return car;
}

function placeCopBehind(game, x, y, angle, speed) {
  const car = new Car(modelById('cruiser'), x, y, angle, '#f2f2f2');
  car.driver = 'police';
  car.vx = Math.cos(angle) * speed;
  car.vy = Math.sin(angle) * speed;
  game.police.cops.push(car);
  return car;
}

const SCENES = {
  // 1-cover: a police chase — wanted 3, cruisers behind, mission 5 objective up.
  chase(game) {
    const car = placeInCar(game, 'comet', '#d33a2c', 2400, 1200, 0, 260);
    void car;
    placeCopBehind(game, 2250, 1180, 0, 280);
    placeCopBehind(game, 2280, 1245, 0.1, 270);
    placeCopBehind(game, 2400, 1330, -Math.PI / 2, 240);
    game.police.setStars(3);
    game.missions.missionIndex = 4;
    game.missions.startMission(4);
    game.missions.stepIndex = 1; // escape step: safehouse marker + heat
    game.missions.enterStep();
    game.player.earn(1250);
    game.renderer.snapTo(2400, 1200);
  },

  // 2-city: cruising downtown at speed, traffic and pedestrians around.
  downtown(game) {
    placeInCar(game, 'meridian', '#2f6d8a', 2700, 900, Math.PI / 2, 200);
    game.missions.startMission(0);
    game.player.earn(320);
    game.renderer.snapTo(2700, 900);
  },

  // 3-docks: on-foot combat at the dockyard, rivals in view, wanted 2.
  docks(game) {
    const p = game.player;
    p.x = LANDMARKS.dockYard.x - 160;
    p.y = LANDMARKS.dockYard.y + 40;
    p.angle = 0;
    p.aimAngle = 0.1;
    game.missions.missionIndex = 3;
    game.missions.startMission(3);
    game.police.setStars(2);
    game.renderer.snapTo(p.x + 80, p.y);
  },

  // 4-beach: a quiet sunset drive along the beach road (free roam, no job yet).
  beach(game) {
    placeInCar(game, 'kestrel', '#e07840', 1500, 2400, 0, 180);
    game.player.earn(640);
    game.missions.nextMissionTimer = 0; // stay in free roam for this shot
    game.renderer.snapTo(1500, 2400);
  },
};

export function applyShotScene(game) {
  const name = shotName();
  if (!name || name === 'start') return false;
  const scene = SCENES[name];
  if (!scene) return false;
  scene(game);
  return true;
}
