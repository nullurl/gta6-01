// Story missions and taxi fares. Five jobs from fixer Mara and her crew take
// Rae from a first fare to the big score; fares fill the gaps in free roam.

import { LANDMARKS } from './city.js';
import { Car, modelById } from './vehicles.js';
import { makeRivals } from './combat.js';
import { playMissionComplete } from './audio.js';

export const MISSIONS = [
  {
    id: 'first-fare',
    name: 'First Fare',
    giver: 'Mara',
    pay: 150,
    intro: 'Mara: "New in town, wheelman? Prove you can drive. Pick up my client at the Marina."',
    steps: [
      { type: 'goto', x: LANDMARKS.marinaPickup.x, y: LANDMARKS.marinaPickup.y, radius: 70, text: 'Drive to the Marina pickup' },
      { type: 'dropoff', x: LANDMARKS.grandHotel.x, y: LANDMARKS.grandHotel.y, radius: 80, text: 'Take the client to the Grand Sol Hotel' },
    ],
  },
  {
    id: 'the-getaway',
    name: 'The Getaway',
    giver: 'Mara',
    pay: 300,
    intro: 'Mara: "Ivy is stuck at the Docks with the law on her tail. Get her out — and lose them."',
    steps: [
      { type: 'goto', x: LANDMARKS.docksMeet.x, y: LANDMARKS.docksMeet.y, radius: 70, text: 'Reach Ivy at the Docks' },
      { type: 'loseheat', text: 'Lose the police — break line of sight and stay hidden', heat: 2 },
    ],
  },
  {
    id: 'borrowed-wheels',
    name: 'Borrowed Wheels',
    giver: 'Deacon',
    pay: 250,
    intro: 'Deacon: "There is a Meridian Coupe sitting in the showroom lot. Bring it to my garage. Quietly."',
    steps: [
      { type: 'steal', text: 'Take the marked Meridian Coupe from the showroom lot' },
      { type: 'deliver', x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, radius: 80, text: "Deliver the Coupe to Deacon's Garage" },
    ],
  },
  {
    id: 'dockside-trouble',
    name: 'Dockside Trouble',
    giver: 'Ivy',
    pay: 400,
    intro: 'Ivy: "The dock crew crossed us. Clear them out of the yard — on foot — then get to the safehouse."',
    steps: [
      { type: 'clear', text: 'Clear the rival crew from the dockyard' },
      { type: 'goto', x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y, radius: 80, text: 'Drive to the safehouse' },
    ],
  },
  {
    id: 'the-big-score',
    name: 'The Big Score',
    giver: 'Mara',
    pay: 1000,
    intro: 'Mara: "Solmara Trust, midday, one bag. Grab it, outrun everything, and meet me at the safehouse."',
    steps: [
      { type: 'grab', x: LANDMARKS.bank.x, y: LANDMARKS.bank.y, radius: 70, text: 'Reach Solmara Trust on foot and grab the cash' },
      { type: 'escape', x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y, radius: 90, text: 'Escape to the safehouse with the cash', heat: 3 },
      { type: 'loseheat', text: 'Lose the police to finish the score' },
    ],
  },
];

export class MissionManager {
  constructor(game) {
    this.game = game;
    this.missionIndex = 0;
    this.stepIndex = 0;
    this.active = false;
    this.completedCount = 0;
    this.targetCar = null;
    this.rivals = [];
    this.fare = null;
    this.fareTimer = 12;
    this.nextMissionTimer = 0;
    this.nextMissionIndex = 0;
    this.failed = false;
  }

  get mission() {
    return MISSIONS[this.missionIndex] || null;
  }

  get step() {
    const m = this.mission;
    return m && this.active ? m.steps[this.stepIndex] : null;
  }

  get objective() {
    const s = this.step;
    if (s) return s;
    if (this.fare) return this.fare.step;
    return null;
  }

  // The world position the marker, minimap and arrow point at, or null.
  markerPos() {
    const o = this.objective;
    if (!o) return null;
    if (o.type === 'steal' && this.targetCar) return { x: this.targetCar.x, y: this.targetCar.y };
    if (o.type === 'clear') return { x: LANDMARKS.dockYard.x, y: LANDMARKS.dockYard.y };
    if (o.x !== undefined) return { x: o.x, y: o.y };
    return null;
  }

  startMission(index) {
    this.missionIndex = index;
    this.stepIndex = 0;
    this.active = true;
    this.failed = false;
    this.nextMissionTimer = 0; // an explicit start cancels any pending auto-start
    this.cleanupSpawns();
    const m = this.mission;
    if (!m) return;
    this.game.banner(m.name, m.intro);
    this.game.feed(`${m.giver}: ${m.name} — $${m.pay}`);
    if (m.id === 'borrowed-wheels') {
      const car = new Car(modelById('meridian'), LANDMARKS.showroom.x, LANDMARKS.showroom.y, 0, '#8a2f4d');
      car.driver = null;
      car.stolen = false;
      this.targetCar = car;
      this.game.cars.push(car);
    }
    if (m.id === 'dockside-trouble') {
      const spots = [
        { x: LANDMARKS.dockYard.x - 80, y: LANDMARKS.dockYard.y - 20 },
        { x: LANDMARKS.dockYard.x + 80, y: LANDMARKS.dockYard.y - 30 },
        { x: LANDMARKS.dockYard.x - 40, y: LANDMARKS.dockYard.y + 40 },
        { x: LANDMARKS.dockYard.x + 60, y: LANDMARKS.dockYard.y + 40 },
      ];
      this.rivals = makeRivals(spots);
      this.game.rivals = this.rivals;
    }
    this.enterStep();
  }

  enterStep() {
    const s = this.step;
    if (!s) return;
    if (s.heat) this.game.police.setStars(s.heat);
    if (s.type === 'clear') this.game.feed('Rivals ahead — get out of the car to shoot.');
  }

  advanceStep() {
    const m = this.mission;
    this.stepIndex += 1;
    if (this.stepIndex >= m.steps.length) {
      this.completeMission();
      return;
    }
    this.game.feed(this.step.text);
    this.enterStep();
  }

  completeMission() {
    const m = this.mission;
    this.game.player.earn(m.pay);
    this.completedCount += 1;
    playMissionComplete();
    this.game.banner('JOB DONE', `${m.name} complete — earned $${m.pay}`);
    this.game.feed(`Earned $${m.pay}`);
    this.active = false;
    this.cleanupSpawns();
    this.game.autosave();
    if (this.missionIndex + 1 < MISSIONS.length) {
      this.nextMissionIndex = this.missionIndex + 1;
      this.nextMissionTimer = 6;
    } else {
      this.game.banner('SOLMARA LEGEND', 'Every job done. The city is yours — fares still pay.');
    }
  }

  failMission(reason) {
    if (!this.active) return;
    this.failed = true;
    this.active = false;
    this.cleanupSpawns();
    this.game.banner('JOB FAILED', reason);
  }

  restartMission() {
    if (this.missionIndex < MISSIONS.length) this.startMission(this.missionIndex);
  }

  cleanupSpawns() {
    if (this.targetCar && this.targetCar.driver !== 'player') {
      const i = this.game.cars.indexOf(this.targetCar);
      if (i >= 0) this.game.cars.splice(i, 1);
    }
    this.targetCar = null;
    this.rivals = [];
    this.game.rivals = [];
  }

  // Taxi fares between jobs: pickup, then dropoff, paid by distance.
  spawnFare() {
    const spots = [
      LANDMARKS.marinaPickup, LANDMARKS.grandHotel, LANDMARKS.hospital,
      LANDMARKS.bank, LANDMARKS.garage, LANDMARKS.safehouse, LANDMARKS.policeHQ,
    ];
    const a = spots[Math.floor(Math.random() * spots.length)];
    let b = spots[Math.floor(Math.random() * spots.length)];
    if (b === a) b = spots[(spots.indexOf(a) + 3) % spots.length];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const pay = 40 + Math.round(dist / 20);
    this.fare = {
      stage: 'pickup',
      pay,
      step: { type: 'goto', x: a.x, y: a.y, radius: 70, text: `Fare: pick up a passenger at ${a.label}` },
      dropoff: { x: b.x, y: b.y, label: b.label },
    };
    this.game.feed(`New fare: ${a.label} → ${b.label} ($${pay})`);
  }

  update(dt) {
    const g = this.game;
    if (this.nextMissionTimer > 0) {
      this.nextMissionTimer -= dt;
      if (this.nextMissionTimer <= 0) this.startMission(this.nextMissionIndex);
      return;
    }
    if (!this.active) {
      // Free roam: offer fares on a timer.
      if (!this.fare) {
        this.fareTimer -= dt;
        if (this.fareTimer <= 0) {
          this.fareTimer = 25;
          this.spawnFare();
        }
      }
    }

    const p = g.player;
    const px = p.car ? p.car.x : p.x;
    const py = p.car ? p.car.y : p.y;

    // Fare progress.
    if (this.fare && !this.active) {
      const f = this.fare;
      const d = Math.hypot(px - f.step.x, py - f.step.y);
      if (d < f.step.radius) {
        if (f.stage === 'pickup') {
          f.stage = 'dropoff';
          f.step = { type: 'goto', x: f.dropoff.x, y: f.dropoff.y, radius: 80, text: `Fare: drop off at ${f.dropoff.label}` };
          g.feed('Passenger aboard — drive to the destination.');
        } else {
          p.earn(f.pay);
          g.feed(`Fare complete — earned $${f.pay}`);
          this.fare = null;
          this.fareTimer = 20;
          g.autosave();
        }
      }
      return;
    }

    const s = this.step;
    if (!s || !this.active) return;
    switch (s.type) {
      case 'goto':
      case 'dropoff':
      case 'grab':
      case 'escape': {
        const d = Math.hypot(px - s.x, py - s.y);
        if (s.type === 'grab' && p.car) break; // the grab needs boots on the ground
        if (d < s.radius) this.advanceStep();
        break;
      }
      case 'steal': {
        if (this.targetCar && p.car === this.targetCar) {
          this.game.police.addStars(1);
          this.game.feed('You took the Coupe — the heat is on.');
          this.advanceStep();
        }
        break;
      }
      case 'deliver': {
        const d = Math.hypot(px - s.x, py - s.y);
        if (p.car === this.targetCar && d < s.radius) this.advanceStep();
        break;
      }
      case 'clear': {
        if (this.rivals.length > 0 && this.rivals.every((r) => r.dead)) this.advanceStep();
        break;
      }
      case 'loseheat': {
        if (g.police.stars === 0) this.advanceStep();
        break;
      }
      default:
        break;
    }
  }

  serialize() {
    return {
      missionIndex: this.missionIndex,
      completedCount: this.completedCount,
      active: this.active,
      stepIndex: this.stepIndex,
    };
  }

  restore(data) {
    if (!data) return;
    this.missionIndex = Math.min(data.missionIndex || 0, MISSIONS.length - 1);
    this.completedCount = data.completedCount || 0;
    this.active = false;
    this.stepIndex = 0;
    // A saved mid-mission run restarts the mission fresh on continue.
    this.nextMissionIndex = this.missionIndex;
    this.nextMissionTimer = 3;
  }
}
