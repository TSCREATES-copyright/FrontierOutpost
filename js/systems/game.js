
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { createRenderer } from '../core/renderer.js';
import { createScene } from '../core/scene.js';
import { createCamera } from '../core/camera.js';
import { createGameLoop } from '../core/gameLoop.js';
import { safeNumber } from '../utils/helpers.js';
import { createNotificationCenter } from '../ui/notifications.js';
import { createMinimapController } from '../ui/minimap.js';

// ─── GLOBALS ─────────────────────────────────────────────────────────────────
const W = window.innerWidth;
const H = window.innerHeight;

const renderer = createRenderer(THREE, W, H);
document.body.appendChild(renderer.domElement);

const scene = createScene(THREE);

const camera = createCamera(THREE, W, H);
const notificationCenter = createNotificationCenter({
  alertsContainer: document.getElementById('alerts'),
  killFeedContainer: document.getElementById('killFeed'),
});
const minimapController = createMinimapController(document.getElementById('minimapCanvas'));

// ─── CLOCK & STATE ────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let gameActive = false;
const lastHUD = {};
let kills = 0, wood = 0, stone = 0, berries = 0, scrap = 0;
let playerHealth = 100, playerMaxHealth = 100;
let playerLevel = 1, playerXP = 0, playerNextXP = 100, skillPoints = 0;
let speedMultiplier = 1.0, combatDamageMult = 1.0;
let reloadSpeedMult = 1.0, headshotBonus = 2.0, berryGatherMult = 1;
let staminaDrainMult = 1.0, buildCostMult = 1.0, isReloading = false;
const SAVE_KEY = 'frontier_outpost_progress_v1';
let autoSaveTimer = 0;
let respawnGraceTimer = 0;
const RESPAWN_GRACE_DURATION = 8.0;

const SKILLS = {
  combatDamage: { name: 'DEADLY AIM', desc: '+15% Weapon Damage', cost: 1, category: 'Combat', max: 3, level: 0 },
  reloadSpeed: { name: 'QUICK HANDS', desc: 'Faster Reload Speed', cost: 1, category: 'Combat', max: 3, level: 0 },
  headshotBonus: { name: 'MARKSMAN', desc: '+50% Headshot Damage', cost: 2, category: 'Combat', max: 1, level: 0 },
  
  maxHealth: { name: 'IRON WILL', desc: '+20 Max Health', cost: 1, category: 'Survival', max: 5, level: 0 },
  berryGather: { name: 'FORAGER', desc: 'Double Berries from Bushes', cost: 1, category: 'Survival', max: 1, level: 0 },
  staminaDrain: { name: 'ENDURANCE', desc: '-20% Stamina Drain', cost: 1, category: 'Survival', max: 3, level: 0 },
  
  buildCost: { name: 'FRUGAL BUILDER', desc: '-20% Structure Cost', cost: 2, category: 'Building', max: 2, level: 0 },
  wallHealth: { name: 'FORTIFIED', desc: '+50 Wall Health', cost: 1, category: 'Building', max: 3, level: 0 },
  buildSpeed: { name: 'SWIFT HANDS', desc: 'Faster Build Speed', cost: 1, category: 'Building', max: 1, level: 0 },
  
  lanternBright: { name: 'BRIGHT SPARK', desc: 'Brighter Lantern', cost: 1, category: 'Utility', max: 1, level: 0 },
  inventoryCap: { name: 'PACK MULE', desc: 'Larger Inventory Capacity', cost: 1, category: 'Utility', max: 1, level: 0 },
  moveSpeed: { name: 'AGILITY', desc: '+5% Movement Speed', cost: 1, category: 'Utility', max: 3, level: 0 }
};

function renderSkillMenu() {
  const container = document.getElementById('skillCategories');
  container.innerHTML = '';
  const categories = ['Combat', 'Survival', 'Building', 'Utility'];
  
  categories.forEach(cat => {
    const catDiv = document.createElement('div');
    catDiv.className = 'chest-section'; // Reuse chest-section for category container
    
    const catTitle = document.createElement('h3');
    catTitle.textContent = cat;
    catDiv.appendChild(catTitle);
    
    for (const [id, skill] of Object.entries(SKILLS)) {
      if (skill.category === cat) {
        const skillDiv = document.createElement('div');
        skillDiv.className = 'skill-card';
        skillDiv.style.marginBottom = '15px';
        
        const nameEl = document.createElement('h4');
        nameEl.textContent = skill.name + ` (${skill.level}/${skill.max})`;
        
        const descEl = document.createElement('p');
        descEl.textContent = skill.desc;
        
        const costEl = document.createElement('div');
        costEl.style.fontSize = '0.8rem';
        costEl.style.color = '#78ff78';
        costEl.style.marginBottom = '10px';
        costEl.textContent = `Cost: ${skill.cost} SP`;
        
        const btn = document.createElement('button');
        btn.style.background = 'linear-gradient(to bottom, #4a5a3a, #2a3a1a)';
        btn.style.border = '1px solid #6a7a5a';
        btn.style.color = '#e8d5a0';
        btn.style.padding = '6px 12px';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.style.fontFamily = "'Georgia', serif";
        btn.style.fontWeight = 'bold';
        btn.style.letterSpacing = '0.05em';
        btn.style.transition = 'all 0.2s';
        btn.style.textTransform = 'uppercase';
        btn.style.fontSize = '0.8rem';
        btn.style.width = '100%';
        
        if (skill.level >= skill.max) {
          btn.textContent = 'MAXED';
          btn.style.background = 'rgba(0,0,0,0.5)';
          btn.style.color = '#555';
          btn.style.borderColor = '#333';
          btn.disabled = true;
        } else {
          btn.textContent = 'UNLOCK';
          btn.onmouseover = () => {
            btn.style.background = 'linear-gradient(to bottom, #5a6a4a, #3a4a2a)';
            btn.style.borderColor = '#c8a050';
            btn.style.color = '#fff';
            btn.style.boxShadow = '0 0 10px rgba(200,160,80,0.4)';
          };
          btn.onmouseout = () => {
            btn.style.background = 'linear-gradient(to bottom, #4a5a3a, #2a3a1a)';
            btn.style.borderColor = '#6a7a5a';
            btn.style.color = '#e8d5a0';
            btn.style.boxShadow = 'none';
          };
          btn.onmousedown = () => btn.style.transform = 'scale(0.96)';
          btn.onmouseup = () => btn.style.transform = 'scale(1)';
          btn.onclick = () => upgradeSkill(id);
        }
        
        skillDiv.appendChild(nameEl);
        skillDiv.appendChild(descEl);
        skillDiv.appendChild(costEl);
        skillDiv.appendChild(btn);
        catDiv.appendChild(skillDiv);
      }
    }
    container.appendChild(catDiv);
  });
}

function addXP(amount) {
  playerXP += amount;
  while (playerXP >= playerNextXP) {
    playerXP -= playerNextXP;
    playerLevel++;
    playerNextXP = Math.floor(playerNextXP * 1.5);
    skillPoints++;
    showAlert('LEVEL UP! Press [K] for Skills', true);
  }
  document.getElementById('lvlText').textContent = playerLevel;
  document.getElementById('xpText').textContent = playerXP + '/' + playerNextXP;
  document.getElementById('xpFill').style.width = (playerXP / playerNextXP * 100) + '%';
  document.getElementById('spHint').style.display = skillPoints > 0 ? 'block' : 'none';
  document.getElementById('spCount').textContent = skillPoints;
}

window.upgradeSkill = function(id) {
  const skill = SKILLS[id];
  if (skillPoints < skill.cost || skill.level >= skill.max) return;
  
  skillPoints -= skill.cost;
  skill.level++;
  
  if (id === 'maxHealth') { playerMaxHealth += 20; playerHealth += 20; }
  if (id === 'staminaDrain') { staminaDrainMult -= 0.2; }
  if (id === 'moveSpeed') { speedMultiplier += 0.05; }
  if (id === 'combatDamage') { combatDamageMult += 0.15; }
  if (id === 'reloadSpeed') { reloadSpeedMult -= 0.2; }
  if (id === 'headshotBonus') { headshotBonus += 0.5; }
  if (id === 'berryGather') { berryGatherMult = 2; }
  if (id === 'buildCost') { buildCostMult -= 0.2; }
  if (id === 'wallHealth') { window.wallMaxHealth = (window.wallMaxHealth || 150) + 50; }
  if (id === 'lanternBright') { window.lanternUpgraded = true; if (lanternActive) playerLantern.intensity = 3.0; }
  
  document.getElementById('spCount').textContent = skillPoints;
  document.getElementById('spHint').style.display = skillPoints > 0 ? 'block' : 'none';
  updateHUD(0);
  renderSkillMenu();
};
let playerStamina = 100, playerMaxStamina = 100;
let playerHunger = 100, playerMaxHunger = 100;
let playerTemp = 100, playerMaxTemp = 100;
let rawMeat = 0, cookedMeat = 0, cookTimer = 0;
let isExhausted = false;
let outOfCombatTimer = 0;
let isRaining = false;
let hitMarkerTimer = 0;
let deathMarker = null;
let activeWeapon = 0;
let previousWeapon = 0;
let quickBuildType = 'wood';
const weapons = [
  { name: 'Axe',     type: 'melee', damage: 35, range: 2.5, rate: 1.0  },
  { name: 'Pickaxe', type: 'melee', damage: 20, range: 2.5, rate: 0.8  },
  { name: 'Revolver',type: 'gun',   damage: 45, range: 60,  rate: 0.5, ammo: 6, maxAmmo: 6, reserveAmmo: 24 },
  { name: 'Rifle',   type: 'gun',   damage: 70, range: 150, rate: 1.5, ammo: 5, maxAmmo: 5, reserveAmmo: 15 },
];
let weaponCooldown = 0;
let headBob = 0, headBobAmt = 0;
let crosshairBloom = 0;

function safeNum(v, fallback = 0) {
  return safeNumber(v, fallback);
}

function captureProgressSnapshot() {
  const skillLevels = {};
  for (const [id, skill] of Object.entries(SKILLS)) {
    skillLevels[id] = safeNum(skill.level, 0);
  }
  return {
    v: 1,
    ts: Date.now(),
    player: {
      health: playerHealth, maxHealth: playerMaxHealth,
      stamina: playerStamina, maxStamina: playerMaxStamina,
      hunger: playerHunger, maxHunger: playerMaxHunger,
      temp: playerTemp, maxTemp: playerMaxTemp,
      level: playerLevel, xp: playerXP, nextXP: playerNextXP, skillPoints,
      x: playerBody.position.x, y: playerBody.position.y, z: playerBody.position.z
    },
    resources: { wood, stone, berries, scrap, rawMeat, cookedMeat, kills },
    world: { worldTime, isNight, daysSurvived, waveTimer, waveTimerMax, waveNumber },
    upgrades: {
      speedMultiplier, combatDamageMult, reloadSpeedMult, headshotBonus,
      berryGatherMult, staminaDrainMult, buildCostMult,
      wallMaxHealth: window.wallMaxHealth || 150,
      lanternUpgraded: !!window.lanternUpgraded
    },
    skills: skillLevels,
    weapons: weapons.map(w => ({
      name: w.name, damage: w.damage, level: w.level || 1,
      ammo: w.ammo, maxAmmo: w.maxAmmo, reserveAmmo: w.reserveAmmo
    }))
  };
}

function applyProgressSnapshot(data) {
  if (!data || typeof data !== 'object') return false;
  const p = data.player || {};
  const r = data.resources || {};
  const w = data.world || {};
  const u = data.upgrades || {};
  const skillLevels = data.skills || {};
  const weaponData = Array.isArray(data.weapons) ? data.weapons : [];

  playerMaxHealth = Math.max(20, safeNum(p.maxHealth, playerMaxHealth));
  playerHealth = Math.max(1, Math.min(playerMaxHealth, safeNum(p.health, playerHealth)));
  playerMaxStamina = Math.max(20, safeNum(p.maxStamina, playerMaxStamina));
  playerStamina = Math.max(0, Math.min(playerMaxStamina, safeNum(p.stamina, playerStamina)));
  playerMaxHunger = Math.max(20, safeNum(p.maxHunger, playerMaxHunger));
  playerHunger = Math.max(0, Math.min(playerMaxHunger, safeNum(p.hunger, playerHunger)));
  playerMaxTemp = Math.max(20, safeNum(p.maxTemp, playerMaxTemp));
  playerTemp = Math.max(0, Math.min(playerMaxTemp, safeNum(p.temp, playerTemp)));
  playerLevel = Math.max(1, Math.floor(safeNum(p.level, playerLevel)));
  playerXP = Math.max(0, Math.floor(safeNum(p.xp, playerXP)));
  playerNextXP = Math.max(50, Math.floor(safeNum(p.nextXP, playerNextXP)));
  skillPoints = Math.max(0, Math.floor(safeNum(p.skillPoints, skillPoints)));

  wood = Math.max(0, Math.floor(safeNum(r.wood, wood)));
  stone = Math.max(0, Math.floor(safeNum(r.stone, stone)));
  berries = Math.max(0, Math.floor(safeNum(r.berries, berries)));
  scrap = Math.max(0, Math.floor(safeNum(r.scrap, scrap)));
  rawMeat = Math.max(0, Math.floor(safeNum(r.rawMeat, rawMeat)));
  cookedMeat = Math.max(0, Math.floor(safeNum(r.cookedMeat, cookedMeat)));
  kills = Math.max(0, Math.floor(safeNum(r.kills, kills)));

  worldTime = Math.max(0, safeNum(w.worldTime, worldTime));
  isNight = !!w.isNight;
  daysSurvived = Math.max(0, Math.floor(safeNum(w.daysSurvived, daysSurvived)));
  waveTimerMax = Math.max(20, safeNum(w.waveTimerMax, waveTimerMax));
  waveTimer = Math.max(0, Math.min(waveTimerMax, safeNum(w.waveTimer, waveTimer)));
  waveNumber = Math.max(0, Math.floor(safeNum(w.waveNumber, waveNumber)));

  speedMultiplier = Math.max(0.5, safeNum(u.speedMultiplier, speedMultiplier));
  combatDamageMult = Math.max(0.5, safeNum(u.combatDamageMult, combatDamageMult));
  reloadSpeedMult = Math.max(0.2, safeNum(u.reloadSpeedMult, reloadSpeedMult));
  headshotBonus = Math.max(1, safeNum(u.headshotBonus, headshotBonus));
  berryGatherMult = Math.max(1, Math.floor(safeNum(u.berryGatherMult, berryGatherMult)));
  staminaDrainMult = Math.max(0.2, safeNum(u.staminaDrainMult, staminaDrainMult));
  buildCostMult = Math.max(0.2, safeNum(u.buildCostMult, buildCostMult));
  window.wallMaxHealth = Math.max(150, Math.floor(safeNum(u.wallMaxHealth, window.wallMaxHealth || 150)));
  window.lanternUpgraded = !!u.lanternUpgraded;

  for (const [id, skill] of Object.entries(SKILLS)) {
    const lvl = Math.floor(safeNum(skillLevels[id], skill.level));
    skill.level = Math.max(0, Math.min(skill.max, lvl));
  }

  for (let i = 0; i < weapons.length && i < weaponData.length; i++) {
    const src = weaponData[i];
    if (!src || typeof src !== 'object') continue;
    if (typeof src.name === 'string') weapons[i].name = src.name;
    weapons[i].damage = Math.max(1, safeNum(src.damage, weapons[i].damage));
    weapons[i].level = Math.max(1, Math.floor(safeNum(src.level, weapons[i].level || 1)));
    if (weapons[i].type === 'gun') {
      weapons[i].maxAmmo = Math.max(1, Math.floor(safeNum(src.maxAmmo, weapons[i].maxAmmo)));
      weapons[i].ammo = Math.max(0, Math.min(weapons[i].maxAmmo, Math.floor(safeNum(src.ammo, weapons[i].ammo))));
      weapons[i].reserveAmmo = Math.max(0, Math.floor(safeNum(src.reserveAmmo, weapons[i].reserveAmmo)));
    }
  }

  const sx = safeNum(p.x, playerBody.position.x);
  const sy = safeNum(p.y, playerBody.position.y);
  const sz = safeNum(p.z, playerBody.position.z);
  playerBody.position.set(Math.max(-82, Math.min(82, sx)), Math.max(2, sy), Math.max(-82, Math.min(82, sz)));
  playerVel.set(0, 0, 0);

  document.getElementById('lvlText').textContent = playerLevel;
  document.getElementById('xpText').textContent = playerXP + '/' + playerNextXP;
  document.getElementById('xpFill').style.width = (playerXP / playerNextXP * 100) + '%';
  document.getElementById('spHint').style.display = skillPoints > 0 ? 'block' : 'none';
  document.getElementById('spCount').textContent = skillPoints;
  document.getElementById('dayCounter').textContent = `Day ${daysSurvived + 1}`;
  document.getElementById('killCount').textContent = String(kills);

  updateResources();
  updateHUD(0.016);
  renderSkillMenu();
  return true;
}

function saveProgress(manual = false) {
  if (!gameStarted) return false;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(captureProgressSnapshot()));
    if (manual) showAlert('Progress saved locally.', false);
    return true;
  } catch (err) {
    if (manual) showAlert('Save failed: local storage unavailable.', true);
    return false;
  }
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return applyProgressSnapshot(parsed);
  } catch (err) {
    return false;
  }
}

function quickHeal() {
  if (berries < 3) { showAlert('Need 3 Berries to Quick Heal!', true); return; }
  if (playerHealth >= playerMaxHealth) { showAlert('Health already full!', false); return; }
  berries -= 3;
  playerHealth = Math.min(playerMaxHealth, playerHealth + 30);
  updateResources();
  showAlert('Quick Heal used! +30 HP', false);
  document.getElementById('damageFlash').style.boxShadow = 'inset 0 0 100px rgba(80,255,80,0.4)';
  setTimeout(() => { 
    const hpRatio = playerHealth / playerMaxHealth;
    const targetAlpha = hpRatio < 0.3 ? 0.6 - hpRatio * 2 : 0;
    document.getElementById('damageFlash').style.boxShadow = `inset 0 0 150px rgba(255,0,0,${targetAlpha})`;
  }, 300);
}
let targetSwayX = 0, targetSwayY = 0;
let currentSwayX = 0, currentSwayY = 0;

// ═══════════════════════════════════════════════════════════════════════════
// UPGRADE 3: DAY/NIGHT CYCLE
// ═══════════════════════════════════════════════════════════════════════════
const DAY_DURATION = 180; // seconds for a full day
let worldTime = 0;        // 0 → DAY_DURATION
let isNight = false;
let daysSurvived = 0;

const SKY_DAY   = new THREE.Color(0x87ceeb);
const SKY_DUSK  = new THREE.Color(0xd45c2a);
const SKY_NIGHT = new THREE.Color(0x050d1a);
const FOG_DAY   = new THREE.Color(0x8aabbf);
const FOG_DUSK  = new THREE.Color(0x5a3020);
const FOG_NIGHT = new THREE.Color(0x020509);

// Moon object (simple sphere)
const moonGeo  = new THREE.SphereGeometry(4, 10, 10); moonGeo.userData = { shared: true };
const moonMat  = new THREE.MeshBasicMaterial({ color: 0xe8e4d0 }); moonMat.userData = { shared: true };
const moonMesh = new THREE.Mesh(moonGeo, moonMat);
moonMesh.position.set(-80, 120, -60);
scene.add(moonMesh);

function updateDayNight(dt) {
  worldTime = (worldTime + dt) % DAY_DURATION;
  const t = worldTime / DAY_DURATION; // 0→1 full cycle

  // t=0 dawn, t=0.25 midday, t=0.5 dusk, t=0.75 midnight, t=1 dawn
  const sunAngle = t * Math.PI * 2;
  const sunY = Math.sin(sunAngle - Math.PI * 0.5); // -1 at night, +1 at noon

  // Interpolate sky color through day/dusk/night
  let skyCol = new THREE.Color();
  let fogCol = new THREE.Color();
  let sunIntensity, ambIntensity;
  let targetFogDensity = 0.022;

  if (t < 0.1) {
    // Dawn: Night -> Dusk
    const p = t / 0.1;
    skyCol.lerpColors(SKY_NIGHT, SKY_DUSK, p);
    fogCol.lerpColors(FOG_NIGHT, FOG_DUSK, p);
    sunIntensity = 0.02 + p * 0.38;
    ambIntensity = 0.05 + p * 0.05;
    targetFogDensity = 0.045 - p * 0.023;
  } else if (t < 0.2) {
    // Morning: Dusk -> Day
    const p = (t - 0.1) / 0.1;
    skyCol.lerpColors(SKY_DUSK, SKY_DAY, p);
    fogCol.lerpColors(FOG_DUSK, FOG_DAY, p);
    sunIntensity = 0.4 + p * 1.4;
    ambIntensity = 0.1 + p * 0.4;
    targetFogDensity = 0.022;
  } else if (t < 0.4) {
    // Day
    skyCol.copy(SKY_DAY);
    fogCol.copy(FOG_DAY);
    sunIntensity = 1.8;
    ambIntensity = 0.5;
    targetFogDensity = 0.022;
  } else if (t < 0.5) {
    // Evening: Day -> Dusk
    const p = (t - 0.4) / 0.1;
    skyCol.lerpColors(SKY_DAY, SKY_DUSK, p);
    fogCol.lerpColors(FOG_DAY, FOG_DUSK, p);
    sunIntensity = 1.8 - p * 1.4;
    ambIntensity = 0.5 - p * 0.4;
    targetFogDensity = 0.022 + p * 0.023;
  } else if (t < 0.6) {
    // Dusk: Dusk -> Night
    const p = (t - 0.5) / 0.1;
    skyCol.lerpColors(SKY_DUSK, SKY_NIGHT, p);
    fogCol.lerpColors(FOG_DUSK, FOG_NIGHT, p);
    sunIntensity = 0.4 - p * 0.38;
    ambIntensity = 0.1 - p * 0.05;
    targetFogDensity = 0.045;
  } else {
    // Night
    skyCol.copy(SKY_NIGHT);
    fogCol.copy(FOG_NIGHT);
    sunIntensity = 0.02;
    ambIntensity = 0.05;
    targetFogDensity = 0.045;
  }

  if (isRaining) {
    targetFogDensity += 0.025;
    ambIntensity *= 0.6;
    sunIntensity *= 0.4;
  }

  renderer.setClearColor(skyCol);
  scene.fog.color.copy(fogCol);
  scene.fog.density = targetFogDensity;
  sun.intensity = sunIntensity;
  ambient.intensity = ambIntensity;

  // Move sun
  sun.position.set(
    Math.cos(sunAngle) * 120,
    Math.sin(sunAngle) * 120,
    60
  );

  // Move moon (opposite of sun)
  moonMesh.position.set(
    Math.cos(sunAngle + Math.PI) * 120,
    Math.sin(sunAngle + Math.PI) * 120,
    -60
  );
  moonMesh.visible = sunY < 0;

  // Night state transition
  const wasNight = isNight;
  isNight = (t > 0.55 && t < 0.95);
  
if (isNight && !wasNight) {
  showAlert('⚠ Night falls — A raiding party approaches!', true);
  const aliveCount = bandits.filter(b => b.userData.health > 0).length;
  const raidCap = Math.max(0, (MAX_BANDITS_BASE + daysSurvived * 3) - aliveCount);
  const raidSize = Math.min(12, 3 + Math.floor(daysSurvived * 1.5), raidCap);
  for(let i=0; i<raidSize; i++) {
    const spawn = findBanditSpawnNearPlayer(34, 56, 28);
    if (!spawn) continue;
    createBandit(spawn.x, spawn.z, true);
  }
}
  if (!isNight && wasNight) {
    daysSurvived++;
    document.getElementById('dayCounter').textContent = `Day ${daysSurvived + 1}`;
    showAlert(`Day ${daysSurvived + 1} - The wilderness grows more dangerous.`, false);
    
    if (trees.length < 80) {
      for (let i=0; i<5; i++) {
        let x,z; do { x=(Math.random()-0.5)*180; z=(Math.random()-0.5)*180; } while(Math.sqrt(x*x+z*z)<12);
        createTree(x,z);
      }
    }
    if (rocks.length < 50) {
      for (let i=0; i<3; i++) {
        let x,z; do { x=(Math.random()-0.5)*160; z=(Math.random()-0.5)*160; } while(Math.sqrt(x*x+z*z)<10);
        createRock(x,z);
      }
    }
    if (bushes.length < 30) {
      for (let i=0; i<2; i++) {
        let x,z; do { x=(Math.random()-0.5)*180; z=(Math.random()-0.5)*180; } while(Math.sqrt(x*x+z*z)<12);
        createBush(x,z);
      }
    }
    if (deers.length < 8) {
      for (let i=0; i<3; i++) {
        let x,z; do { x=(Math.random()-0.5)*160; z=(Math.random()-0.5)*160; } while(Math.sqrt(x*x+z*z)<20);
        createDeer(x,z);
      }
    }
  }

  // Update HUD clock label
  const timeEl = document.getElementById('timeLabel');
  const clockEl = document.getElementById('dayNightClock');
  if (t < 0.1 || t > 0.9) {
    timeEl.textContent = 'DAWN'; clockEl.firstChild.textContent = '🌅 ';
  } else if (t < 0.5) {
    timeEl.textContent = 'DAY'; clockEl.firstChild.textContent = '☀️ ';
  } else if (t < 0.6) {
    timeEl.textContent = 'DUSK'; clockEl.firstChild.textContent = '🌇 ';
  } else {
    timeEl.textContent = 'NIGHT'; clockEl.firstChild.textContent = '🌙 ';
  }
}

// ─── INPUT ────────────────────────────────────────────────────────────────────
const keys = {};
const mouse = { x: 0, y: 0, buttons: 0 };
let mouseDX = 0, mouseDY = 0;
let pointerLocked = false;
let yaw = 0, pitch = 0;

let prevKeys = {};

document.addEventListener('keydown', e => { 
  if (e.code === 'KeyI' || e.code === 'Tab') e.preventDefault();
  keys[e.code] = true; 
  handleKey(e.code); 
});
document.addEventListener('keyup',   e => { 
  keys[e.code] = false; 
});

document.addEventListener('mousemove', e => {
  if (pointerLocked) { 
    mouseDX += e.movementX; mouseDY += e.movementY; 
  } else if (isChestOpen || isWorkbenchOpen || isSkillMenuOpen) {
    const cursor = document.getElementById('customCursor');
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  }
});
document.addEventListener('mousedown', e => { 
  if (e.button === 0 && pointerLocked) {
    mouse.buttons |= 1; 
    if (interactTarget && !isWorkbenchOpen && !isChestOpen && !isSkillMenuOpen) {
      doInteract();
      mouse.buttons &= ~1; // Consume the click
    }
  }
});
document.addEventListener('mouseup',   e => { if (e.button === 0) mouse.buttons &= ~1; });
document.addEventListener('wheel', e => {
  if (!gameActive || isWorkbenchOpen || isChestOpen || isSkillMenuOpen) return;
  if (VoxelSystem.active) {
    if (e.deltaY > 0) {
      VoxelSystem.buildType = VoxelSystem.buildType === 'wood' ? 'stone' : 'wood';
    } else {
      VoxelSystem.buildType = VoxelSystem.buildType === 'wood' ? 'stone' : 'wood';
    }
    quickBuildType = VoxelSystem.buildType;
    return;
  }
  if (e.deltaY > 0) { selectWeapon((activeWeapon + 1) % 4); }
  else { selectWeapon((activeWeapon + 3) % 4); }
});

function tryDemolishStructure() {
  raycaster.setFromCamera({x:0,y:0}, camera);
  const hits = raycaster.intersectObjects([...walls, ...planters, ...chests, ...campfires, ...turrets, ...workbenches, ...blockMeshes], true);
  if (hits.length > 0) {
    let base = hits[0].object;
    while(base.parent && !base.userData.type) base = base.parent;
    if (base.userData.type === 'wood' || base.userData.type === 'stone' || base.userData.type === 'wall' || base.userData.type === 'door' || base.userData.type === 'stairs' || base.userData.type === 'roof' || base.userData.type === 'planter' || base.userData.type === 'chest' || base.userData.type === 'campfire' || base.userData.type === 'turret' || base.userData.type === 'workbench') {
      const dist = hits[0].distance;
      if (dist < 4.5) {
        scene.remove(base);
        disposeObject(base);
        
        if (base.userData.type === 'wood' || base.userData.type === 'stone') {
          const type = base.userData.type;
          const p = base.position;
          removeBlock(p.x, p.y, p.z);
          if (type === 'wood') wood += 1;
          else stone += 1;
        } else if (base.userData.type === 'wall' || base.userData.type === 'door' || base.userData.type === 'stairs' || base.userData.type === 'roof') {
          const idx = walls.indexOf(base);
          if (idx > -1) walls.splice(idx, 1);
        } else if (base.userData.type === 'planter') {
          const idx = planters.indexOf(base);
          if (idx > -1) planters.splice(idx, 1);
        } else if (base.userData.type === 'chest') {
          const idx = chests.indexOf(base);
          if (idx > -1) chests.splice(idx, 1);
          const inv = base.userData.inventory;
          createCorpseStash(base.position.x, base.position.z, inv.wood, inv.stone, inv.berries, inv.rawMeat, inv.cookedMeat, inv.scrap);
        } else if (base.userData.type === 'campfire') {
          const idx = campfires.indexOf(base);
          if (idx > -1) campfires.splice(idx, 1);
        } else if (base.userData.type === 'turret') {
          const idx = turrets.indexOf(base);
          if (idx > -1) turrets.splice(idx, 1);
        } else if (base.userData.type === 'workbench') {
          const idx = workbenches.indexOf(base);
          if (idx > -1) workbenches.splice(idx, 1);
        }
        
        if (base.userData.type !== 'wood' && base.userData.type !== 'stone') wood += 1;
        updateResources();
        showAlert('Structure demolished. +1 Resource refunded.', false);
        spawnParticle(base.position, 0x5a3a1a);
        screenShake(0.1);
      }
    }
  }
}

function handleKey(code) {
  if (!gameActive) return;
  if ((isWorkbenchOpen || isChestOpen || isSkillMenuOpen) && code !== 'Escape' && code !== 'KeyK') return;
  if (code === 'Tab') { VoxelSystem.active = false; selectWeapon(previousWeapon); return; }
  if (code === 'Digit1') { VoxelSystem.active = false; selectWeapon(0); }
  if (code === 'Digit2') { VoxelSystem.active = false; selectWeapon(1); }
  if (code === 'Digit3') { VoxelSystem.active = false; selectWeapon(2); }
  if (code === 'Digit4') { VoxelSystem.active = false; selectWeapon(3); }
  if (code === 'KeyR') { if (!VoxelSystem.active) reload(); }
  if (code === 'KeyB') { 
    if (VoxelSystem.active) tryPlaceStructure(); 
    else { VoxelSystem.active = true; VoxelSystem.buildType = 'wood'; quickBuildType = 'wood'; } 
  }
  if (code === 'KeyQ') { if (VoxelSystem.active) tryDemolishStructure(); }
  if (code === 'KeyV') { 
    if (VoxelSystem.active) tryPlaceStructure(); 
    else { VoxelSystem.active = true; VoxelSystem.buildType = 'stone'; quickBuildType = 'stone'; } 
  }
  if (code === 'KeyG') {
    VoxelSystem.active = !VoxelSystem.active;
    if (VoxelSystem.active) VoxelSystem.buildType = quickBuildType;
  }
  if (code === 'KeyT') { VoxelSystem.active = false; tryPlaceTrap(); }
  if (code === 'KeyY') { VoxelSystem.active = false; tryPlaceTurret(); }
  if (code === 'KeyU') { VoxelSystem.active = false; tryPlaceWorkbench(); }
  if (code === 'KeyX') { VoxelSystem.active = false; tryPlaceBarrel(); }
  if (code === 'KeyP') { VoxelSystem.active = false; tryPlacePlanter(); }
  if (code === 'KeyO') { VoxelSystem.active = false; tryPlaceChest(); }
  if (code === 'KeyK') {
    if (isWorkbenchOpen || isChestOpen) return;
    const sm = document.getElementById('skillMenu');
    if (!isSkillMenuOpen) {
      VoxelSystem.active = false;
      isSkillMenuOpen = true;
      sm.style.display = 'block';
      renderSkillMenu();
      document.exitPointerLock();
      if (document.body.classList.contains('ui-active')) return;
      document.getElementById('customCursor').style.display = 'block';
    } else {
      closeSkillMenu();
    }
  }
  if (code === 'KeyE') {
    if (!isWorkbenchOpen && !isChestOpen && !isSkillMenuOpen) {
      doInteract();
    }
  }
  if (code === 'KeyC') { eatFood(); }
  if (code === 'KeyH') { quickHeal(); }
  if (code === 'KeyL') { toggleLantern(); }
  if (code === 'KeyM') {
    const zoom = minimapController.cycleZoom();
    showAlert(`Minimap zoom: ${zoom.toFixed(1)}x`, false);
  }
  if (code === 'KeyI') {
    const el = document.getElementById('debugMenu');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }
  if (code === 'Escape') { 
    if (isWorkbenchOpen) { closeWorkbench(); return; }
    if (isChestOpen) { closeChest(); return; }
    if (isSkillMenuOpen) { closeSkillMenu(); return; }
    if (VoxelSystem.active) { VoxelSystem.active = false; return; } 
  }
  // UPGRADE 1: Space handled in updatePlayer
}


// ─── LIGHTING ─────────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xfff4e0, 0.5);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff0cc, 1.8);
sun.position.set(80, 120, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 400;
sun.shadow.camera.left = sun.shadow.camera.bottom = -150;
sun.shadow.camera.right = sun.shadow.camera.top = 150;
sun.shadow.bias = -0.001;
scene.add(sun);

const sky = new THREE.HemisphereLight(0x87ceeb, 0x5a7a40, 0.6);
scene.add(sky);

// ─── MATERIALS ────────────────────────────────────────────────────────────────
const MATS = {
  ground:   new THREE.MeshLambertMaterial({ color: 0x4a6a2a }),
  rock:     new THREE.MeshLambertMaterial({ color: 0x7a7a6a }),
  rockDark: new THREE.MeshLambertMaterial({ color: 0x5a5a4a }),
  treeTrunk:new THREE.MeshLambertMaterial({ color: 0x5a3a1a }),
  treeLeaf: new THREE.MeshLambertMaterial({ color: 0x2a6a20 }),
  treeLeaf2:new THREE.MeshLambertMaterial({ color: 0x336624 }),
  dirt:     new THREE.MeshLambertMaterial({ color: 0x6a4a2a }),
  wall:     new THREE.MeshLambertMaterial({ color: 0x8a6a3a }),
  bandit:   new THREE.MeshLambertMaterial({ color: 0x8b3a2a }),
  banditHead:new THREE.MeshLambertMaterial({ color: 0xd4a070 }),
  campfire: new THREE.MeshLambertMaterial({ color: 0x5a3000, emissive: 0x220e00 }),
  fireGlow: new THREE.MeshLambertMaterial({ color: 0xff6600, emissive: 0xff3300, transparent: true, opacity: 0.85 }),
  path:     new THREE.MeshLambertMaterial({ color: 0x8a6a4a }),
  wMetal:   new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.9 }),
  wMetalDk: new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.3, metalness: 1.0 }),
  wWood:    new THREE.MeshStandardMaterial({ color: 0x6b3a1f, roughness: 0.85, metalness: 0.0 }),
  wWoodDk:  new THREE.MeshStandardMaterial({ color: 0x4a2510, roughness: 0.9,  metalness: 0.0 }),
  wBrass:   new THREE.MeshStandardMaterial({ color: 0xb8860b, roughness: 0.35, metalness: 0.85 }),
  wBlade:   new THREE.MeshStandardMaterial({ color: 0x9090a0, roughness: 0.2,  metalness: 1.0 }),
};
for (const key in MATS) MATS[key].userData = { shared: true };

// ─── ENTITY SYSTEM ────────────────────────────────────────────────────────────
const entities = [];
const trees   = [];
const rocks   = [];
const bushes  = [];
const bandits = [];
const deers   = [];
const walls   = [];
const campfires = [];
const traps   = [];
const particles = [];
const planters = [];
const chests = [];
const projectiles = [];

// ─── UTILS ────────────────────────────────────────────────────────────────────
function disposeObject(obj) {
  if (!obj) return;
  obj.traverse(child => {
    if (child.isMesh || child.isSprite) {
      if (child.geometry && !child.geometry.userData.shared) child.geometry.dispose();
      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(m => { 
          if (!m.userData || !m.userData.shared) {
            if (m.map) m.map.dispose();
            m.dispose(); 
          }
        });
      }
    }
  });
  // Note: callers always call scene.remove(obj) before disposeObject,
  // so obj.parent is already null here. We only remove if still parented
  // (e.g. child nodes cleaned up via traverse).
}


// ─── TERRAIN ──────────────────────────────────────────────────────────────────
function noise2D(x, z) {
  const X = Math.floor(x), Z = Math.floor(z);
  const fx = x-X, fz = z-Z;
  function r(a,b) { let n=Math.sin(a*127.1+b*311.7)*43758.5; return n-Math.floor(n); }
  const a=r(X,Z), b=r(X+1,Z), c=r(X,Z+1), d=r(X+1,Z+1);
  const ux=fx*fx*(3-2*fx), uz=fz*fz*(3-2*fz);
  return a+(b-a)*ux+(c-a)*uz+(a-b-c+d)*ux*uz;
}

function getHeight(x, z) {
  let h = 0;
  h += noise2D(x*0.015, z*0.015) * 8;
  h += noise2D(x*0.04,  z*0.04)  * 3;
  h += noise2D(x*0.1,   z*0.1)   * 1;
  const d = Math.sqrt(x*x+z*z);
  const flat = Math.max(0, 1 - d/20);
  h *= (1 - flat * 0.9);
  return h;
}

const GRID = 120, CELL = 2;
const terrainGeo = new THREE.PlaneGeometry(GRID*CELL, GRID*CELL, GRID, GRID);
terrainGeo.rotateX(-Math.PI/2);
const pos = terrainGeo.attributes.position;
const colors = new Float32Array(pos.count * 3);
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i), z = pos.getZ(i);
  const h = getHeight(x, z);
  pos.setY(i, h);
  const t = Math.max(0, Math.min(1, (h + 2) / 12));
  colors[i*3+0] = 0.25 + t*0.2;
  colors[i*3+1] = 0.35 + t*0.15;
  colors[i*3+2] = 0.12;
}
terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
terrainGeo.computeVertexNormals();
terrainGeo.userData = { shared: true };
const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const terrain = new THREE.Mesh(terrainGeo, terrainMat);
terrain.receiveShadow = true;
scene.add(terrain);

function getTerrainHeight(x, z) { return getHeight(x, z); }

const MAX_BANDITS_BASE = 28;

function isSpawnPointBlocked(x, z, radius = 1.5) {
  if (x < -82 || x > 82 || z < -82 || z > 82) return true;

  for (const b of blockMeshes) {
    const dx = x - b.position.x;
    const dz = z - b.position.z;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  for (const w of walls) {
    const dx = x - w.position.x;
    const dz = z - w.position.z;
    if (dx * dx + dz * dz < (radius + 1.0) * (radius + 1.0)) return true;
  }
  return false;
}

function findBanditSpawnNearPlayer(minDist, maxDist, maxAttempts = 20) {
  const px = playerBody.position.x;
  const pz = playerBody.position.z;
  for (let i = 0; i < maxAttempts; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = minDist + Math.random() * (maxDist - minDist);
    const x = Math.max(-80, Math.min(80, px + Math.cos(angle) * dist));
    const z = Math.max(-80, Math.min(80, pz + Math.sin(angle) * dist));

    const dy =
      Math.abs(getTerrainHeight(x + 1.0, z) - getTerrainHeight(x - 1.0, z)) +
      Math.abs(getTerrainHeight(x, z + 1.0) - getTerrainHeight(x, z - 1.0));
    if (dy > 4.0) continue;
    if (isSpawnPointBlocked(x, z, 1.6)) continue;
    if (new THREE.Vector2(x - px, z - pz).lengthSq() < minDist * minDist) continue;
    return { x, z };
  }
  return null;
}

// ─── TREE BUILDER ─────────────────────────────────────────────────────────────
function createTree(x, z) {
  const h = getTerrainHeight(x, z);
  const group = new THREE.Group();
  group.position.set(x, h, z);

  const trunkH = 2.5 + Math.random()*2;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, trunkH, 6), MATS.treeTrunk);
  trunk.position.y = trunkH/2;
  trunk.castShadow = true;
  group.add(trunk);

  const layers = 3;
  for (let i = 0; i < layers; i++) {
    const r = 1.8 - i*0.4;
    const ch = 1.5 + i*0.3;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, ch, 7), i%2===0 ? MATS.treeLeaf : MATS.treeLeaf2);
    cone.position.y = trunkH + i*0.8 + 0.5;
    cone.castShadow = true;
    group.add(cone);
  }

  group.userData = { type:'tree', health:100, maxHealth:100, wood:3+Math.floor(Math.random()*3) };
  scene.add(group);
  trees.push(group);
  return group;
}

// ─── ROCK BUILDER ─────────────────────────────────────────────────────────────
function createRock(x, z) {
  const h = getTerrainHeight(x, z);
  const group = new THREE.Group();
  group.position.set(x, h, z);
  const s = 0.7 + Math.random()*0.9;

  for (let i = 0; i < 3; i++) {
    const geo = new THREE.DodecahedronGeometry(s*(0.6+Math.random()*0.5), 0);
    const mesh = new THREE.Mesh(geo, i===0 ? MATS.rock : MATS.rockDark);
    mesh.position.set((Math.random()-0.5)*0.5, s*0.4, (Math.random()-0.5)*0.5);
    mesh.rotation.set(Math.random(), Math.random(), Math.random());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  group.userData = { type:'rock', health:100, maxHealth:100, stone:2+Math.floor(Math.random()*3) };
  scene.add(group);
  rocks.push(group);
  return group;
}

// ─── CAMPFIRE ─────────────────────────────────────────────────────────────────
function createPlanter(x, z) {
  const h = getTerrainHeight(x, z);
  const group = new THREE.Group();
  group.position.set(x, h, z);
  
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 1.2), MATS.wWood);
  box.position.y = 0.2;
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);
  
  const dirt = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.42, 1.0), MATS.bush);
  dirt.position.y = 0.2;
  dirt.material.color.setHex(0x3a2a1a);
  group.add(dirt);
  
  group.userData = { type: 'planter', health: 50, maxHealth: 50, growth: 0, ready: false };
  scene.add(group);
  planters.push(group);
}

function createChest(x, z) {
  const h = getTerrainHeight(x, z);
  const group = new THREE.Group();
  group.position.set(x, h, z);
  
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.6), MATS.wWoodDk);
  box.position.y = 0.3;
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);
  
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.1, 0.62), MATS.wWood);
  lid.position.y = 0.65;
  group.add(lid);
  
  group.userData = { 
    type: 'chest', health: 100, maxHealth: 100,
    inventory: { wood: 0, stone: 0, scrap: 0, berries: 0, rawMeat: 0, cookedMeat: 0 } 
  };
  scene.add(group);
  chests.push(group);
}

function createCampfire(x, z) {
  const h = getTerrainHeight(x, z);
  const group = new THREE.Group();
  group.position.set(x, h, z);

  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.8, 5), MATS.campfire);
    const angle = (i/4)*Math.PI*2;
    log.position.set(Math.cos(angle)*0.2, 0.05, Math.sin(angle)*0.2);
    log.rotation.z = Math.PI/2 + Math.random()*0.3;
    log.rotation.y = angle;
    group.add(log);
  }

  const flameMat = MATS.fireGlow.clone();
  flameMat.userData.shared = false;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 6), flameMat);
  flame.position.y = 0.35;
  flame.name = 'flame';
  group.add(flame);

  const fireLight = new THREE.PointLight(0xff6600, 2.5, 8);
  fireLight.position.y = 0.5;
  group.add(fireLight);

  group.userData = { type:'campfire', light: fireLight, isLit: true, fuel: 180 };
  scene.add(group);
  campfires.push(group);
  return group;
}

// ─── BUILD SYSTEM ─────────────────────────────────────────────────────────────
const TILE   = 2.0;
const WALL_H = 2.2;
const WALL_T = 0.28;

const wallMatBase  = new THREE.MeshStandardMaterial({ color:0x8a6a3a, roughness:0.85, metalness:0.05 });
const wallMatBeam  = new THREE.MeshStandardMaterial({ color:0x5a3a1a, roughness:0.9,  metalness:0.0  });
const wallMatPlank = new THREE.MeshStandardMaterial({ color:0x9a7a4a, roughness:0.8,  metalness:0.0  });
const wallMatIron  = new THREE.MeshStandardMaterial({ color:0x3a3a3a, roughness:0.4,  metalness:0.8  });
const doorMatWood  = new THREE.MeshStandardMaterial({ color:0x7a4a2a, roughness:0.8,  metalness:0.0  });

function worldToTile(wx, wz) { return { tx: Math.floor(wx / TILE), tz: Math.floor(wz / TILE) }; }

function nearestEdge(wx, wz) {
  const tx = Math.floor(wx / TILE), tz = Math.floor(wz / TILE);
  const lx = wx - tx * TILE, lz = wz - tz * TILE;
  const dWest = lx, dEast = TILE - lx, dNorth = lz, dSouth = TILE - lz;
  const minDist = Math.min(dWest, dEast, dNorth, dSouth);
  let edgeTX, edgeTZ, dir, worldX, worldZ, ry;
  if (minDist === dNorth)  { edgeTX=tx;   edgeTZ=tz;   dir='NS'; worldX=(tx+0.5)*TILE; worldZ=tz*TILE;     ry=0; }
  else if (minDist===dSouth){ edgeTX=tx;  edgeTZ=tz+1; dir='NS'; worldX=(tx+0.5)*TILE; worldZ=(tz+1)*TILE; ry=0; }
  else if (minDist===dWest) { edgeTX=tx;  edgeTZ=tz;   dir='EW'; worldX=tx*TILE;       worldZ=(tz+0.5)*TILE; ry=Math.PI/2; }
  else                      { edgeTX=tx+1;edgeTZ=tz;   dir='EW'; worldX=(tx+1)*TILE;   worldZ=(tz+0.5)*TILE; ry=Math.PI/2; }
  return { tx:edgeTX, tz:edgeTZ, dir, wx:worldX, wz:worldZ, ry };
}

const VoxelSystem = {
  active: false,
  buildType: 'wood',
  previewMesh: null,
  previewValid: false,
  targetPos: new THREE.Vector3()
};

const BLOCK_SIZE = 1;
const blocks = new Map();
const blockMeshes = [];

function blockKey(x, y, z) {
  return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
}

function snapBlockCoord(v) {
  return Math.round(v / BLOCK_SIZE) * BLOCK_SIZE;
}

function isBlockNearPlayer(px, py, pz) {
  const dx = playerBody.position.x - px;
  const dy = (playerBody.position.y - PLAYER_H / 2) - py;
  const dz = playerBody.position.z - pz;
  const ex = BLOCK_SIZE / 2 + 0.3;
  const ez = BLOCK_SIZE / 2 + 0.3;
  const ey = BLOCK_SIZE / 2 + PLAYER_H / 2;
  return Math.abs(dx) < ex && Math.abs(dz) < ez && Math.abs(dy) < ey;
}

function evaluateBlockPlacement(px, py, pz) {
  const tx = snapBlockCoord(px);
  const ty = snapBlockCoord(py);
  const tz = snapBlockCoord(pz);
  const key = blockKey(tx, ty, tz);
  if (blocks.has(key)) return { valid: false, reason: 'BLOCKED: occupied', x: tx, y: ty, z: tz };
  if (isBlockNearPlayer(tx, ty, tz)) return { valid: false, reason: 'BLOCKED: too close to player', x: tx, y: ty, z: tz };

  // Blocks are stored/validated on integer Y centers in this project,
  // so terrain support must use the same grid to avoid false "needs support".
  const terrainTop = Math.floor(getTerrainHeight(tx, tz));
  const minAllowedY = terrainTop - 0.15;
  if (ty < minAllowedY) return { valid: false, reason: 'BLOCKED: inside terrain', x: tx, y: ty, z: tz };

  const supportedByTerrain = Math.abs(ty - terrainTop) < 0.25;
  const dirs = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0],
    [0, -1, 0], [0, 0, 1], [0, 0, -1]
  ];
  let supportedByBlock = false;
  for (const d of dirs) {
    if (blocks.has(blockKey(tx + d[0], ty + d[1], tz + d[2]))) {
      supportedByBlock = true;
      break;
    }
  }
  if (!supportedByTerrain && !supportedByBlock) {
    return { valid: false, reason: 'BLOCKED: needs support', x: tx, y: ty, z: tz };
  }

  const half = BLOCK_SIZE * 0.5;
  const hs = [
    getTerrainHeight(tx - half, tz - half),
    getTerrainHeight(tx + half, tz - half),
    getTerrainHeight(tx - half, tz + half),
    getTerrainHeight(tx + half, tz + half)
  ];
  const hMin = Math.min(...hs);
  const hMax = Math.max(...hs);
  if (!supportedByBlock && (hMax - hMin) > 1.3) {
    return { valid: false, reason: 'BLOCKED: slope too steep', x: tx, y: ty, z: tz };
  }

  return { valid: true, reason: 'VALID', x: tx, y: ty, z: tz };
}

function createPlankTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  
  // Base oak color
  ctx.fillStyle = '#9c7a4d';
  ctx.fillRect(0, 0, 16, 16);
  
  const colors = ['#8b6840', '#a88556', '#947248', '#805d38'];
  
  // 4 planks, each 4 pixels high
  for (let i = 0; i < 4; i++) {
    const y = i * 4;
    
    // Base noise
    for (let x = 0; x < 16; x++) {
      for (let py = 0; py < 4; py++) {
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.fillRect(x, y + py, 1, 1);
      }
    }
    
    // Top highlight (light)
    ctx.fillStyle = '#b69262';
    ctx.fillRect(0, y, 16, 1);
    
    // Bottom shadow (dark)
    ctx.fillStyle = '#5c4122';
    ctx.fillRect(0, y + 3, 16, 1);
    
    // Vertical seams (staggered)
    const seamX = (i % 2 === 0) ? 7 : 15;
    ctx.fillStyle = '#5c4122';
    ctx.fillRect(seamX, y, 1, 4);
    
    // Highlight next to seam
    ctx.fillStyle = '#b69262';
    ctx.fillRect(seamX - 1, y, 1, 3);
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}

function createStoneTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  
  // Base stone color
  ctx.fillStyle = '#7d7d7d';
  ctx.fillRect(0, 0, 16, 16);
  
  const colors = ['#7d7d7d', '#757575', '#6e6e6e', '#858585', '#8c8c8c', '#606060'];
  
  // Noise
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 16; y++) {
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  
  // Top-left highlight border
  ctx.fillStyle = '#9e9e9e';
  ctx.fillRect(0, 0, 16, 1);
  ctx.fillRect(0, 0, 1, 16);
  
  // Bottom-right shadow border
  ctx.fillStyle = '#545454';
  ctx.fillRect(0, 15, 16, 1);
  ctx.fillRect(15, 0, 1, 16);
  
  // Add some distinct stone cracks/patterns
  ctx.fillStyle = '#5a5a5a';
  ctx.fillRect(3, 3, 2, 1);
  ctx.fillRect(4, 4, 1, 2);
  ctx.fillRect(10, 10, 2, 1);
  ctx.fillRect(11, 11, 1, 2);
  ctx.fillRect(12, 5, 1, 1);
  ctx.fillRect(5, 12, 1, 1);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}

const blockMaterials = {
  wood: new THREE.MeshStandardMaterial({ map: createPlankTexture(), roughness: 1.0 }),
  stone: new THREE.MeshStandardMaterial({ map: createStoneTexture(), roughness: 1.0 })
};
blockMaterials.wood.userData.shared = true;
blockMaterials.stone.userData.shared = true;

const blockGeo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
blockGeo.userData.shared = true;

function createBlock(x, y, z, type) {
  const mesh = new THREE.Mesh(blockGeo, blockMaterials[type]);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const health = type === 'wood' ? 50 : 150;
  mesh.userData = { isBlock: true, type: type, health: health };
  scene.add(mesh);
  blockMeshes.push(mesh);
  blocks.set(blockKey(x, y, z), { type, mesh });
}

function removeBlock(x, y, z) {
  const key = blockKey(x, y, z);
  const block = blocks.get(key);
  if (block) {
    scene.remove(block.mesh);
    const idx = blockMeshes.indexOf(block.mesh);
    if (idx > -1) blockMeshes.splice(idx, 1);
    blocks.delete(key);
  }
}

function updateBuildPreview() {
  const buildBar = document.getElementById('buildBar');
  const crosshair = document.getElementById('crosshair');
  const buildStatusEl = document.getElementById('buildStatus');
  
  if (!VoxelSystem.active) {
    if (VoxelSystem.previewMesh) VoxelSystem.previewMesh.visible = false;
    if (buildBar) buildBar.style.display = 'none';
    if (crosshair) crosshair.style.display = 'block';
    const rotateHint = document.getElementById('buildRotateHint');
    if (rotateHint) rotateHint.style.display = 'none';
    return;
  }

  if (buildBar) {
    buildBar.style.display = 'block';
    document.querySelector('.build-title').textContent = `🔨 BUILD: ${VoxelSystem.buildType.toUpperCase()}`;
    const costEl = document.querySelector('#buildBar .build-cost');
    const cost = Math.max(1, Math.floor(2 * buildCostMult));
    const res = VoxelSystem.buildType === 'wood' ? wood : stone;
    if (costEl) {
      costEl.textContent = `🧱 ${cost} ${VoxelSystem.buildType} required (Have: ${res})`;
      costEl.style.color = res >= cost ? '#aaffaa' : '#ffaaaa';
    }
  }
  if (crosshair) crosshair.style.display = 'none';

  if (!VoxelSystem.previewMesh) {
    const geo = new THREE.BoxGeometry(BLOCK_SIZE + 0.02, BLOCK_SIZE + 0.02, BLOCK_SIZE + 0.02);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, transparent: true, opacity: 0.5 });
    VoxelSystem.previewMesh = new THREE.Mesh(geo, mat);
    scene.add(VoxelSystem.previewMesh);
  }

  VoxelSystem.previewMesh.visible = true;
  VoxelSystem.previewValid = false;

  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const targets = [...blockMeshes, terrain];
  const intersects = raycaster.intersectObjects(targets, false);

  if (intersects.length > 0 && intersects[0].distance < 10) {
    const hit = intersects[0];
    let px, py, pz;

    if (hit.object === terrain) {
      px = snapBlockCoord(hit.point.x);
      pz = snapBlockCoord(hit.point.z);
      py = Math.floor(getTerrainHeight(px, pz));
    } else {
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
      px = snapBlockCoord(hit.object.position.x + normal.x * BLOCK_SIZE);
      py = snapBlockCoord(hit.object.position.y + normal.y * BLOCK_SIZE);
      pz = snapBlockCoord(hit.object.position.z + normal.z * BLOCK_SIZE);
    }

    const placement = evaluateBlockPlacement(px, py, pz);
    VoxelSystem.targetPos.set(placement.x, placement.y, placement.z);
    VoxelSystem.previewMesh.position.copy(VoxelSystem.targetPos);
    
    // Check resources
    const cost = Math.max(1, Math.floor(2 * buildCostMult));
    const res = VoxelSystem.buildType === 'wood' ? wood : stone;
    const hasResources = res >= cost;

    const distLabel = `${hit.distance.toFixed(1)}m`;
    const posLabel = `[${placement.x}, ${placement.y}, ${placement.z}]`;
    if (placement.valid) {
      VoxelSystem.previewValid = true;
      VoxelSystem.previewMesh.material.color.setHex(hasResources ? 0x00ff00 : 0xff8800);
      VoxelSystem.previewMesh.material.opacity = hasResources ? 0.62 : 0.52;
      const pulse = 1 + Math.sin(clock.elapsedTime * 8) * 0.03;
      VoxelSystem.previewMesh.scale.setScalar(pulse);
      if (buildStatusEl) {
        buildStatusEl.textContent = `${VoxelSystem.buildType.toUpperCase()} — ${hasResources ? 'VALID' : 'LOW RESOURCES'} ${posLabel} @ ${distLabel}`;
        buildStatusEl.className = hasResources ? 'build-valid' : 'build-blocked';
      }
    } else {
      VoxelSystem.previewValid = false;
      VoxelSystem.previewMesh.material.color.setHex(0xff0000);
      VoxelSystem.previewMesh.material.opacity = 0.4;
      VoxelSystem.previewMesh.scale.setScalar(1);
      if (buildStatusEl) {
        buildStatusEl.textContent = `${VoxelSystem.buildType.toUpperCase()} — ${placement.reason} ${posLabel} @ ${distLabel}`;
        buildStatusEl.className = 'build-blocked';
      }
    }
  } else {
    VoxelSystem.previewMesh.visible = false;
    VoxelSystem.previewMesh.scale.setScalar(1);
    if (buildStatusEl) {
      buildStatusEl.textContent = `${VoxelSystem.buildType.toUpperCase()} — OUT OF RANGE / NO SURFACE`;
      buildStatusEl.className = 'build-blocked';
    }
  }
}

function resolveWallCollisions(pos, radius, isPlayer = true, height = PLAYER_H) {
  for (let iter = 0; iter < 3; iter++) {
    const feetY = isPlayer ? pos.y - height : pos.y;
    const centerY = isPlayer ? pos.y - height/2 : pos.y + height/2;
    const headY = isPlayer ? pos.y : pos.y + height;

    for (const w of walls) {
      const ud = w.userData;
      if (!ud) continue;
      if (ud.type === 'door' && ud.isOpen) continue; // Pass through open doors
      
      let topY = w.position.y + WALL_H/2;
      if (ud.type === 'roof') topY += 1.5;
      
      const dy = centerY - w.position.y;
      if (Math.abs(dy) > WALL_H / 2 + 1.5) continue;
      
      const dx=pos.x-w.position.x, dz=pos.z-w.position.z;
      const ex=ud.hw+radius, ez=ud.hd+radius;
      
      if (Math.abs(dx)<ex && Math.abs(dz)<ez) {
        if (ud.type === 'stairs' || ud.type === 'roof') {
          const cos = Math.cos(w.rotation.y);
          const sin = Math.sin(w.rotation.y);
          const lx = dx * cos - dz * sin;
          const lz = dx * sin + dz * cos;
          let normalizedZ = (lz + TILE/2) / TILE;
          normalizedZ = Math.max(0, Math.min(1, normalizedZ));
          let localH = w.position.y;
          if (ud.type === 'stairs') localH += -WALL_H/2 + normalizedZ * WALL_H;
          if (ud.type === 'roof') localH += normalizedZ * 1.5;
          
          if (feetY >= localH - 0.6) {
            continue;
          }
          if (ud.type === 'roof' && headY <= w.position.y + 0.5) {
            continue;
          }
        } else {
          if (feetY >= w.position.y + WALL_H/2 - 0.1) {
            continue;
          }
        }

        const ox=ex-Math.abs(dx), oz=ez-Math.abs(dz);
        if (ox<oz) pos.x+=dx>0?ox:-ox; else pos.z+=dz>0?oz:-oz;
      }
    }
    
    // Block collisions
    const minX = Math.floor(pos.x - radius - BLOCK_SIZE/2);
    const maxX = Math.floor(pos.x + radius + BLOCK_SIZE/2);
    const minY = Math.floor(feetY - BLOCK_SIZE/2);
    const maxY = Math.floor(headY + BLOCK_SIZE/2);
    const minZ = Math.floor(pos.z - radius - BLOCK_SIZE/2);
    const maxZ = Math.floor(pos.z + radius + BLOCK_SIZE/2);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const key = blockKey(x, y, z);
          const bData = blocks.get(key);
          if (bData) {
            const b = bData.mesh;
            const currentCenterY = isPlayer ? pos.y - height/2 : pos.y + height/2;
            const dx = pos.x - b.position.x;
            const dy = currentCenterY - b.position.y;
            const dz = pos.z - b.position.z;
            
            const ex = BLOCK_SIZE/2 + radius;
            const ez = BLOCK_SIZE/2 + radius;
            const ey = BLOCK_SIZE/2 + height/2;
            
            if (Math.abs(dx) < ex && Math.abs(dz) < ez && Math.abs(dy) < ey) {
              const ox = ex - Math.abs(dx);
              const oz = ez - Math.abs(dz);
              const oy = ey - Math.abs(dy);
              
              if (ox < oz && ox < oy) {
                pos.x += dx > 0 ? ox : -ox;
              } else if (oz < ox && oz < oy) {
                pos.z += dz > 0 ? oz : -oz;
              } else {
                pos.y += dy > 0 ? oy : -oy;
                if (isPlayer) {
                  if (dy > 0) {
                    playerVel.y = 0;
                    onGround = true;
                  } else if (playerVel.y > 0) {
                    playerVel.y = 0; // Hit head
                  }
                }
              }
            }
          }
        }
      }
    }
    
    // Tree collisions
    for (const t of trees) {
      const dx = pos.x - t.position.x, dz = pos.z - t.position.z;
      const distSq = dx*dx + dz*dz;
      const minDist = 0.4 + radius;
      if (distSq < minDist*minDist && feetY < t.position.y + 4) {
        const dist = Math.sqrt(distSq);
        if (dist === 0) continue;
        const overlap = minDist - dist;
        pos.x += (dx/dist) * overlap;
        pos.z += (dz/dist) * overlap;
      }
    }
    
    // Rock collisions
    for (const r of rocks) {
      const dx = pos.x - r.position.x, dz = pos.z - r.position.z;
      const distSq = dx*dx + dz*dz;
      const minDist = 0.8 + radius;
      if (distSq < minDist*minDist && feetY < r.position.y + 2) {
        const dist = Math.sqrt(distSq);
        if (dist === 0) continue;
        const overlap = minDist - dist;
        pos.x += (dx/dist) * overlap;
        pos.z += (dz/dist) * overlap;
      }
    }
  }
}

function tryPlaceStructure() {
  if (!VoxelSystem.previewValid) return;
  
  const cost = Math.max(1, Math.floor(2 * buildCostMult));
  const res = VoxelSystem.buildType === 'wood' ? wood : stone;
  if (res < cost) {
    showAlert(`Need ${cost} ${VoxelSystem.buildType}!`, true);
    return;
  }
  
  const placement = evaluateBlockPlacement(VoxelSystem.targetPos.x, VoxelSystem.targetPos.y, VoxelSystem.targetPos.z);
  if (!placement.valid) {
    showAlert(placement.reason, true);
    return;
  }
  if (VoxelSystem.buildType === 'wood') wood -= cost;
  else stone -= cost;
  updateResources();
  const p = new THREE.Vector3(placement.x, placement.y, placement.z);
  createBlock(p.x, p.y, p.z, VoxelSystem.buildType);
  
  // Play sound or effect
  for (let i=0; i<5; i++) {
    const pMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,0.1), blockMaterials[VoxelSystem.buildType]);
    pMesh.position.copy(p);
    pMesh.position.x += (Math.random()-0.5)*0.5;
    pMesh.position.y += (Math.random()-0.5)*0.5;
    pMesh.position.z += (Math.random()-0.5)*0.5;
    scene.add(pMesh);
    const vel = new THREE.Vector3((Math.random()-0.5)*5, Math.random()*5, (Math.random()-0.5)*5);
    const life = 0.5 + Math.random()*0.5;
    particles.push({mesh:pMesh, vel, life, maxLife:life});
  }
}

// ─── DEER ─────────────────────────────────────────────────────────────────────
const deerGeos = {
  body: new THREE.BoxGeometry(0.6, 0.5, 1.2),
  head: new THREE.BoxGeometry(0.3, 0.4, 0.4),
  leg: new THREE.BoxGeometry(0.15, 0.6, 0.15),
  antler: new THREE.BoxGeometry(0.05, 0.4, 0.05)
};
for (const k in deerGeos) deerGeos[k].userData = { shared: true };
const MATS_DEER = new THREE.MeshLambertMaterial({ color: 0x8b5a2b }); MATS_DEER.userData = { shared: true };
const MATS_ANTLER = new THREE.MeshLambertMaterial({ color: 0xddddcc }); MATS_ANTLER.userData = { shared: true };

function createDeer(x, z) {
  const h = getTerrainHeight(x, z);
  const group = new THREE.Group();
  group.position.set(x, h, z);
  
  const body = new THREE.Mesh(deerGeos.body, MATS_DEER);
  body.position.y = 0.8; body.castShadow = true; group.add(body);
  
  const head = new THREE.Mesh(deerGeos.head, MATS_DEER);
  head.position.set(0, 1.2, -0.7); head.castShadow = true; group.add(head);
  
  const antlerL = new THREE.Mesh(deerGeos.antler, MATS_ANTLER);
  antlerL.position.set(-0.15, 1.5, -0.7); antlerL.rotation.x = -0.2; antlerL.rotation.z = 0.2; group.add(antlerL);
  
  const antlerR = new THREE.Mesh(deerGeos.antler, MATS_ANTLER);
  antlerR.position.set(0.15, 1.5, -0.7); antlerR.rotation.x = -0.2; antlerR.rotation.z = -0.2; group.add(antlerR);
  
  const legs = [];
  for(let i=0; i<4; i++) {
    const leg = new THREE.Mesh(deerGeos.leg, MATS_DEER);
    leg.position.set(i%2===0?-0.2:0.2, 0.3, i<2?-0.4:0.4);
    leg.castShadow = true; group.add(leg);
    legs.push(leg);
  }
  
  group.userData = {
    type: 'deer', health: 40, maxHealth: 40, state: 'wander',
    wanderAngle: Math.random() * Math.PI * 2,
    speed: 2.5, walkCycle: 0, legs
  };
  scene.add(group);
  deers.push(group);
  return group;
}

function updateDeers(dt) {
  for (let i = deers.length - 1; i >= 0; i--) {
    const d = deers[i];
    const ud = d.userData;
    if (ud.health <= 0) continue;
    
    const distToPlayer = d.position.distanceTo(playerBody.position);
    
    if (distToPlayer < 15) ud.state = 'flee';
    else if (distToPlayer > 35) ud.state = 'wander';
    
    if (ud.state === 'wander') {
      ud.wanderAngle += (Math.random() - 0.5) * dt;
      const dir = new THREE.Vector3(Math.cos(ud.wanderAngle), 0, Math.sin(ud.wanderAngle));
      d.position.addScaledVector(dir, ud.speed * 0.4 * dt);
      d.rotation.y = Math.atan2(dir.x, dir.z);
    } else if (ud.state === 'flee') {
      const dir = new THREE.Vector3().subVectors(d.position, playerBody.position).normalize();
      dir.y = 0;
      d.position.addScaledVector(dir, ud.speed * 2.2 * dt);
      d.rotation.y = Math.atan2(dir.x, dir.z);
    }
    
    const speedMult = ud.state === 'flee' ? 2.2 : 0.4;
    ud.walkCycle += dt * 8 * speedMult;
    ud.legs[0].rotation.x = Math.sin(ud.walkCycle) * 0.5;
    ud.legs[1].rotation.x = -Math.sin(ud.walkCycle) * 0.5;
    ud.legs[2].rotation.x = -Math.sin(ud.walkCycle) * 0.5;
    ud.legs[3].rotation.x = Math.sin(ud.walkCycle) * 0.5;
    
    resolveWallCollisions(d.position, 0.4, false, 1.5);
    d.position.y = getTerrainHeight(d.position.x, d.position.z);
    
    if (d.position.x < -80 || d.position.x > 80 || d.position.z < -80 || d.position.z > 80) {
      ud.wanderAngle += Math.PI;
      d.position.x = Math.max(-80, Math.min(80, d.position.x));
      d.position.z = Math.max(-80, Math.min(80, d.position.z));
    }
  }
}

function damageDeer(d, dmg) {
  if (d.userData.isDead) return;
  d.userData.health -= dmg;
  d.userData.state = 'flee';
  spawnParticle(d.position, 0xcc4444);
  if (d.userData.health <= 0) {
    d.userData.isDead = true;
    new TWEEN_anim(d, { rotation: { x: -Math.PI / 2 } }, 500, () => {
      scene.remove(d); disposeObject(d); deers.splice(deers.indexOf(d), 1);
      spawnDrop('rawMeat', d.position, 1 + Math.floor(Math.random() * 2));
    });
  }
}

// ─── BANDIT BUILDER ───────────────────────────────────────────────────────────
const banditGeos = {
  body: new THREE.BoxGeometry(0.55,0.9,0.3),
  head: new THREE.BoxGeometry(0.38,0.38,0.38),
  arm:  new THREE.BoxGeometry(0.18,0.6,0.18),
  leg:  new THREE.BoxGeometry(0.2,0.6,0.2),
};
for (const key in banditGeos) banditGeos[key].userData = { shared: true };

// UPGRADE 2: Exclamation mark sprite geometry for alert state
const exclamGeo = new THREE.BoxGeometry(0.08, 0.35, 0.08); exclamGeo.userData = { shared: true };
const exclamMat = new THREE.MeshBasicMaterial({ color: 0xffdd00 }); exclamMat.userData = { shared: true };

function createBandit(x, z, isRaid = false) {
  const isBrute = (waveNumber > 2 || isRaid) && Math.random() < 0.25;
  const isGunman = !isBrute && Math.random() < 0.3;
  const scale = isBrute ? 1.5 : 1.0;

  const h = getTerrainHeight(x, z);
  const group = new THREE.Group();
  group.position.set(x, h, z);
  group.scale.set(scale, scale, scale);

  const banditMat = MATS.bandit.clone();
  banditMat.userData.shared = false;
  if (isGunman) banditMat.color.setHex(0x333333);
  
  const body = new THREE.Mesh(banditGeos.body, banditMat);
  body.position.y = 1.1; body.castShadow = true; group.add(body);
  const head = new THREE.Mesh(banditGeos.head, MATS.banditHead);
  head.position.y = 1.75; head.castShadow = true; group.add(head);
  const lArm = new THREE.Mesh(banditGeos.arm, banditMat);
  lArm.position.set(-0.37,1.1,0); group.add(lArm);
  const rArm = new THREE.Mesh(banditGeos.arm, banditMat);
  rArm.position.set(0.37,1.1,0); group.add(rArm);
  const lLeg = new THREE.Mesh(banditGeos.leg, banditMat);
  lLeg.position.set(-0.15,0.4,0); group.add(lLeg);
  const rLeg = new THREE.Mesh(banditGeos.leg, banditMat);
  rLeg.position.set(0.15,0.4,0); group.add(rLeg);

  // UPGRADE 2: Alert exclamation mark above head
  const exclaim = new THREE.Mesh(exclamGeo, exclamMat);
  exclaim.position.y = 2.5;
  exclaim.visible = false;
  exclaim.name = 'exclaim';
  group.add(exclaim);

  group.userData = {
    type:'bandit', health:(60 + daysSurvived*15) * (isBrute ? 3 : 1), maxHealth:(60 + daysSurvived*15) * (isBrute ? 3 : 1),
    state: isRaid ? 'chase' : 'patrol',   // patrol | alert | chase | attack
    alertTimer: 0,    // UPGRADE 2: time spent in alert
    target: null, speed:(1.6 + daysSurvived*0.1) * (isBrute ? 0.6 : 1),
    patrolAngle: Math.random()*Math.PI*2,
    patrolCenter: new THREE.Vector3(x,h,z),
    attackCooldown: 0,
    walkCycle: 0,
    lArm, rArm, lLeg, rLeg, body,
    hitFlash: 0,
    exclaim,
    isBrute: isBrute,
    isRanged: isGunman,
    damage: isBrute ? 40 : 15
  };
  
  if (group.userData.isRanged) {
    const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.2), new THREE.MeshStandardMaterial({color: 0x222222}));
    rifle.position.set(0.4, 0.2, 0.4);
    body.add(rifle);
    group.userData.damage = 25; // Ranged damage
  }
  
  scene.add(group);
  bandits.push(group);
  return group;
}

// ─── WORLD INIT ───────────────────────────────────────────────────────────────
function createBush(x, z) {
  const h = getTerrainHeight(x, z);
  const group = new THREE.Group();
  group.position.set(x, h, z);
  const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 1), new THREE.MeshStandardMaterial({color: 0x2a5a2a, roughness: 0.9}));
  leaves.position.y = 0.6; leaves.castShadow = true; leaves.receiveShadow = true; group.add(leaves);
  const isGolden = Math.random() < 0.1;
  const berryColor = isGolden ? 0xffd700 : 0xff4444;
  const berriesMesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 4, 4), new THREE.MeshBasicMaterial({color: berryColor}));
  berriesMesh.position.set(0.6, 0.8, 0); group.add(berriesMesh);
  const b2 = berriesMesh.clone(); b2.position.set(-0.4, 1.0, 0.5); group.add(b2);
  const b3 = berriesMesh.clone(); b3.position.set(0.2, 0.5, -0.6); group.add(b3);
  group.userData = { type: 'bush', health: 1, berries: 3, berryMeshes: [berriesMesh, b2, b3], isGolden };
  scene.add(group); bushes.push(group);
  return group;
}

const carts = [];
function createCart(x, z) {
  const h = getTerrainHeight(x, z);
  const group = new THREE.Group();
  group.position.set(x, h + 0.5, z);
  
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 2.2), MATS.wood);
  body.castShadow = true; body.receiveShadow = true; group.add(body);
  
  const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 8);
  wheelGeo.rotateZ(Math.PI/2);
  const w1 = new THREE.Mesh(wheelGeo, MATS.wMetalDk); w1.position.set(0.8, -0.2, 0.8); group.add(w1);
  const w2 = new THREE.Mesh(wheelGeo, MATS.wMetalDk); w2.position.set(-0.8, -0.2, 0.8); group.add(w2);
  const w3 = new THREE.Mesh(wheelGeo, MATS.wMetalDk); w3.position.set(0.8, -0.2, -0.8); group.add(w3);
  const w4 = new THREE.Mesh(wheelGeo, MATS.wMetalDk); w4.position.set(-0.8, -0.2, -0.8); group.add(w4);
  
  const tarp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 2.0), new THREE.MeshStandardMaterial({color: 0x555544, roughness: 0.9}));
  tarp.position.y = 0.4; group.add(tarp);

  group.rotation.y = Math.random() * Math.PI;
  group.userData = { type: 'cart', health: 1 };
  scene.add(group); carts.push(group);
  return group;
}

const turrets = [];
const workbenches = [];
function createTurret(x, z) {
  const h = getTerrainHeight(x, z);
  const group = new THREE.Group();
  group.position.set(x, h + 0.5, z);
  
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1, 8), MATS.wMetalDk);
  base.castShadow = true; base.receiveShadow = true; group.add(base);
  
  const head = new THREE.Group();
  head.position.y = 0.6;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), MATS.wMetal);
  head.add(dome);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 6), MATS.wMetalDk);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0, -0.4);
  head.add(barrel);
  group.add(head);
  
  group.userData = { type: 'turret', health: 200, maxHealth: 200, head: head, cooldown: 0 };
  scene.add(group); turrets.push(group);
  return group;
}

const barrels = [];
function createBarrel(x, z) {
  const h = getTerrainHeight(x, z);
  const group = new THREE.Group();
  group.position.set(x, h + 0.6, z);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 8), new THREE.MeshLambertMaterial({color: 0xaa2222}));
  mesh.castShadow = true;
  group.add(mesh);
  group.userData = { type: 'barrel', health: 1 };
  scene.add(group);
  barrels.push(group);
  return group;
}

function tryPlaceBarrel() {
  const wCost = Math.max(1, Math.floor(5 * buildCostMult));
  const scCost = Math.max(1, Math.floor(5 * buildCostMult));
  if (wood < wCost || scrap < scCost) { showAlert(`Need ${wCost} Wood and ${scCost} Scrap for a barrel!`, true); return; }
  wood -= wCost; scrap -= scCost; updateResources();
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  createBarrel(playerBody.position.x + fwd.x * 3, playerBody.position.z + fwd.z * 3);
  showAlert('Explosive Barrel placed!', false);
}

function explodeBarrel(barrel) {
  spawnParticle(barrel.position, 0xff5500, 50, 4);
  screenShake(0.5);
  for (const b of bandits) {
    if (b.userData.health <= 0) continue;
    if (b.position.distanceToSquared(barrel.position) < 100) damageBandit(b, 200);
  }
  if (playerBody.position.distanceToSquared(barrel.position) < 100) {
    playerHealth -= 50;
    if (playerHealth <= 0) triggerDeath();
    document.getElementById('damageFlash').style.boxShadow = 'inset 0 0 150px rgba(255,0,0,0.8)';
  }
  scene.remove(barrel); disposeObject(barrel);
  const idx = barrels.indexOf(barrel);
  if (idx > -1) barrels.splice(idx, 1);
}

function tryPlaceTurret() {
  const wCost = Math.max(1, Math.floor(10 * buildCostMult));
  const sCost = Math.max(1, Math.floor(10 * buildCostMult));
  const scCost = Math.max(1, Math.floor(5 * buildCostMult));
  if (wood < wCost || stone < sCost || scrap < scCost) { showAlert(`Need ${wCost} Wood, ${sCost} Stone, ${scCost} Scrap for a turret!`, true); return; }
  wood -= wCost; stone -= sCost; scrap -= scCost; updateResources();
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  createTurret(playerBody.position.x + fwd.x * 3, playerBody.position.z + fwd.z * 3);
  showAlert('Automated Turret placed!', false);
}

function updateTurrets(dt) {
  for (let i = turrets.length - 1; i >= 0; i--) {
    const t = turrets[i];
    if (t.userData.health <= 0) {
      scene.remove(t); disposeObject(t); turrets.splice(i, 1); continue;
    }
    if (t.userData.cooldown > 0) t.userData.cooldown -= dt;
    
    let nearest = null;
    let minDist = 400;
    for (const b of bandits) {
      if (b.userData.health <= 0) continue;
      const distSq = t.position.distanceToSquared(b.position);
      if (distSq < minDist) { minDist = distSq; nearest = b; }
    }
    
    if (nearest) {
      const targetPos = nearest.position.clone().add(new THREE.Vector3(0, 1, 0));
      t.userData.head.lookAt(targetPos);
      
      if (t.userData.cooldown <= 0) {
        t.userData.cooldown = 1.0;
        damageBandit(nearest, 25);
        spawnParticle(t.userData.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,0,-0.8).applyQuaternion(t.userData.head.quaternion)), 0xffee88);
        const material = new THREE.LineBasicMaterial({ color: 0xffaa00 });
        const geometry = new THREE.BufferGeometry().setFromPoints([t.userData.head.getWorldPosition(new THREE.Vector3()), targetPos]);
        const line = new THREE.Line(geometry, material);
        scene.add(line);
        setTimeout(() => { scene.remove(line); geometry.dispose(); material.dispose(); }, 50);
      }
    }
  }
}

// ─── WEATHER SYSTEM ───────────────────────────────────────────────────────────
const WEATHER = { CLEAR: 0, RAIN: 1, BLIZZARD: 2 };
let weatherState = WEATHER.CLEAR;
let rainTimer = 120;
let rainParticles = null;
let snowParticles = null;

function initRain() {
  // Rain
  const rainCount = 1500;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainPos[i*3] = (Math.random() - 0.5) * 100;
    rainPos[i*3+1] = Math.random() * 40;
    rainPos[i*3+2] = (Math.random() - 0.5) * 100;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.PointsMaterial({ color: 0xaaaaaa, size: 0.1, transparent: true, opacity: 0.6 });
  rainParticles = new THREE.Points(rainGeo, rainMat);
  rainParticles.visible = false;
  scene.add(rainParticles);
  
  // Snow
  const snowGeo = new THREE.BufferGeometry();
  const snowPos = new Float32Array(2000 * 3);
  for(let i=0;i<2000;i++){ snowPos[i*3]=(Math.random()-0.5)*100; snowPos[i*3+1]=Math.random()*40; snowPos[i*3+2]=(Math.random()-0.5)*100; }
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snowMat = new THREE.PointsMaterial({color: 0xffffff, size: 0.3, transparent: true, opacity: 0.8});
  snowParticles = new THREE.Points(snowGeo, snowMat);
  snowParticles.visible = false;
  scene.add(snowParticles);
}

function updateWeather(dt) {
  rainTimer -= dt;
  if (rainTimer <= 0) {
    const r = Math.random();
    if (r < 0.6) { weatherState = WEATHER.CLEAR; rainTimer = 120 + Math.random() * 60; }
    else if (r < 0.85) { weatherState = WEATHER.RAIN; rainTimer = 60 + Math.random() * 60; }
    else { weatherState = WEATHER.BLIZZARD; rainTimer = 45 + Math.random() * 30; }
    
    rainParticles.visible = weatherState === WEATHER.RAIN;
    snowParticles.visible = weatherState === WEATHER.BLIZZARD;
    
    let label = 'CLEAR';
    if (weatherState === WEATHER.RAIN) { label = 'RAIN'; showAlert('A rainstorm has started.', false); }
    else if (weatherState === WEATHER.BLIZZARD) { label = 'BLIZZARD'; showAlert('⚠ BLIZZARD APPROACHING! Seek shelter and warmth!', true); }
    else { showAlert('The weather has cleared.', false); }
    
    const weatherLabel = document.getElementById('weatherLabel');
    if (weatherLabel) weatherLabel.textContent = label;
  }
  
  if (weatherState === WEATHER.RAIN && rainParticles) {
    const pos = rainParticles.geometry.attributes.position.array;
    for (let i = 0; i < pos.length / 3; i++) {
      pos[i*3+1] -= dt * 15;
      if (pos[i*3+1] < 0) {
        pos[i*3+1] = 40;
        pos[i*3] = playerBody.position.x + (Math.random() - 0.5) * 80;
        pos[i*3+2] = playerBody.position.z + (Math.random() - 0.5) * 80;
      }
    }
    rainParticles.geometry.attributes.position.needsUpdate = true;
  } else if (weatherState === WEATHER.BLIZZARD && snowParticles) {
    const pos = snowParticles.geometry.attributes.position.array;
    for(let i=0;i<2000;i++){
      pos[i*3] += dt * 10; // Wind
      pos[i*3+1] -= dt * 8;
      if(pos[i*3+1] < 0 || pos[i*3] > playerBody.position.x + 50) { 
        pos[i*3+1] = 40; 
        pos[i*3] = playerBody.position.x - 50 + Math.random()*100; 
        pos[i*3+2] = playerBody.position.z + (Math.random()-0.5)*100; 
      }
    }
    snowParticles.geometry.attributes.position.needsUpdate = true;
  }
}

function createTrap(x, z) {
  const h = getTerrainHeight(x, z);
  const group = new THREE.Group();
  group.position.set(x, h + 0.1, z);
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 1.8), MATS.wWood);
  base.receiveShadow = true; group.add(base);
  for(let i=0; i<5; i++) {
    for(let j=0; j<5; j++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.6, 4), MATS.wMetal);
      spike.position.set(-0.72 + i*0.36, 0.3, -0.72 + j*0.36);
      spike.castShadow = true; group.add(spike);
    }
  }
  group.userData = { type: 'trap', health: 100, active: true };
  scene.add(group); traps.push(group);
  return group;
}

function initWorld() {
  for (let i=0; i<80; i++) {
    let x,z; do { x=(Math.random()-0.5)*180; z=(Math.random()-0.5)*180; } while(Math.sqrt(x*x+z*z)<12);
    createTree(x,z);
  }
  for (let i=0; i<50; i++) {
    let x,z; do { x=(Math.random()-0.5)*160; z=(Math.random()-0.5)*160; } while(Math.sqrt(x*x+z*z)<10);
    createRock(x,z);
  }
  for (let i=0; i<30; i++) {
    let x,z; do { x=(Math.random()-0.5)*180; z=(Math.random()-0.5)*180; } while(Math.sqrt(x*x+z*z)<12);
    createBush(x,z);
  }
  for (let i=0; i<12; i++) {
    let x,z; do { x=(Math.random()-0.5)*180; z=(Math.random()-0.5)*180; } while(Math.sqrt(x*x+z*z)<20);
    createCart(x,z);
  }
  for (let i=0; i<8; i++) {
    let x,z; do { x=(Math.random()-0.5)*160; z=(Math.random()-0.5)*160; } while(Math.sqrt(x*x+z*z)<20);
    createDeer(x,z);
  }
  createCampfire(3,3);
  for (let i=0; i<6; i++) {
    const angle=(i/6)*Math.PI*2, dist=30+Math.random()*30;
    createBandit(Math.cos(angle)*dist, Math.sin(angle)*dist);
  }
  for (let i=-15; i<15; i++) {
    const pb=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.05,1.2), MATS.path);
    pb.position.set(i*1.2, getTerrainHeight(i*1.2,0)+0.01, 0);
    pb.receiveShadow=true; scene.add(pb);
  }
  buildCabin(-25,15);
  initRain();
}

function buildCabin(ox,oz) {
  const startX = Math.floor(ox / BLOCK_SIZE) * BLOCK_SIZE;
  const startZ = Math.floor(oz / BLOCK_SIZE) * BLOCK_SIZE;
  const startY = Math.floor(getTerrainHeight(startX, startZ)) + BLOCK_SIZE / 2;
  
  for (let x = 0; x < 4; x++) {
    for (let z = 0; z < 4; z++) {
      for (let y = 0; y < 3; y++) {
        // Hollow inside, leave a door
        if (x > 0 && x < 3 && z > 0 && z < 3 && y < 2) continue;
        if (x === 1 && z === 0 && y < 2) continue; // Door
        
        createBlock(startX + x * BLOCK_SIZE, startY + y * BLOCK_SIZE, startZ + z * BLOCK_SIZE, 'wood');
      }
    }
  }
}

// ─── PLAYER CONTROLLER ────────────────────────────────────────────────────────
const playerBody = new THREE.Object3D();
playerBody.position.set(0,2,0);
scene.add(playerBody);
playerBody.add(camera);

const playerLantern = new THREE.PointLight(0xffaa55, 0, 15);
playerLantern.position.set(0.5, -0.2, 0.5);
camera.add(playerLantern);
let lanternActive = false;

function toggleLantern() {
  lanternActive = !lanternActive;
  playerLantern.intensity = lanternActive ? (window.lanternUpgraded ? 3.0 : 2.0) : 0;
  showAlert(lanternActive ? 'Lantern ON' : 'Lantern OFF', false);
}

const playerVel = new THREE.Vector3();
const GRAVITY     = -18;
let onGround      = false;
let isSprinting   = false;
let isJumping     = false;
const PLAYER_SPEED = 5;
const SPRINT_MULT  = 1.7;
const JUMP_FORCE   = 7;
let PLAYER_H       = 1.7;
let isCrouching    = false;

// ═══════════════════════════════════════════════════════════════════════════
// UPGRADE 1: DODGE ROLL STATE
// ═══════════════════════════════════════════════════════════════════════════
let isRolling      = false;
let rollTimer      = 0;
let rollCooldown   = 0;
let rollDir        = new THREE.Vector3();
let rollIframes    = false; // invincibility during roll
const ROLL_DURATION  = 0.38;  // seconds
const ROLL_COOLDOWN  = 1.2;   // seconds between rolls
const ROLL_SPEED     = 12;    // units/sec during roll
const ROLL_STAMP_COST = 30;   // stamina cost

function tryDodgeRoll() {
  if (isRolling || rollCooldown > 0 || !onGround) return;
  if (playerStamina < ROLL_STAMP_COST) { showAlert('Not enough stamina!', true); return; }

  // Get movement direction — if standing still, roll forward
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const rgt = new THREE.Vector3( Math.cos(yaw), 0, -Math.sin(yaw));
  const dir = new THREE.Vector3();
  if (keys['KeyW']) dir.addScaledVector(fwd,1);
  if (keys['KeyS']) dir.addScaledVector(fwd,-1);
  if (keys['KeyA']) dir.addScaledVector(rgt,-1);
  if (keys['KeyD']) dir.addScaledVector(rgt,1);
  if (dir.lengthSq() < 0.01) dir.copy(fwd); // default: forward
  dir.normalize();

  rollDir.copy(dir);
  isRolling  = true;
  rollTimer  = ROLL_DURATION;
  rollIframes = true;
  playerStamina = Math.max(0, playerStamina - ROLL_STAMP_COST);
  window.staminaRegenDelayTimer = 1.5;

  // Camera tilt during roll
  screenShake(0.04);
}

function updateRoll(dt) {
  if (!isRolling) return;
  rollTimer -= dt;

  // Push player in roll direction
  playerBody.position.x += rollDir.x * ROLL_SPEED * dt;
  playerBody.position.z += rollDir.z * ROLL_SPEED * dt;
  
  // Apply gravity during roll
  playerVel.y += GRAVITY * dt;
  playerBody.position.y += playerVel.y * dt;

  resolveWallCollisions(playerBody.position, 0.4);

  // Camera roll tilt (lean in roll direction)
  const tiltAmt = Math.sin((1 - rollTimer / ROLL_DURATION) * Math.PI) * 0.3;
  const cross = new THREE.Vector3(-rollDir.z, 0, rollDir.x); // left of roll dir
  camera.rotation.z = -tiltAmt * Math.sign(cross.x * rollDir.z - cross.z * rollDir.x);

  if (rollTimer <= 0) {
    isRolling   = false;
    rollIframes = false;
    rollCooldown = ROLL_COOLDOWN;
    camera.rotation.z = 0;
  }
}

let cameraYOffset = 0;

function updatePlayer(dt) {
  if (!gameActive) return;
  if (respawnGraceTimer > 0) respawnGraceTimer = Math.max(0, respawnGraceTimer - dt);

  // Hunger drain
  playerHunger -= dt * 0.2;
  if (playerHunger <= 0) {
    playerHunger = 0;
    playerHealth -= dt * 1.5; // Starvation damage
    if (playerHealth <= 0) triggerDeath();
    updateHUD(dt);
  }

  // Temperature & Cooking
  let isNearFire = false;
  for (const cf of campfires) {
    if (cf.userData.isLit && cf.position.distanceToSquared(playerBody.position) < 30) {
      isNearFire = true;
      break;
    }
  }

  if (isNearFire) {
    playerTemp = Math.min(playerMaxTemp, playerTemp + dt * 15);
    
    // Campfire healing mechanic
    if (playerHealth < playerMaxHealth && outOfCombatTimer > 3.0 && playerHunger > 20) {
      playerHealth = Math.min(playerMaxHealth, playerHealth + dt * 4.0);
      updateHUD(dt);
      
      // Visual indicator: green healing particles around player
      if (Math.random() < 0.1) {
        const pPos = playerBody.position.clone();
        pPos.x += (Math.random() - 0.5) * 1.5;
        pPos.y += Math.random() * 2;
        pPos.z += (Math.random() - 0.5) * 1.5;
        spawnParticle(pPos, 0x00ff00);
      }
    }

    if (rawMeat > 0) {
      cookTimer += dt;
      if (cookTimer >= 3.0) {
        rawMeat--; cookedMeat++; cookTimer = 0;
        showAlert('Cooked 1 Raw Meat!', false);
        updateResources();
      }
    } else { cookTimer = 0; }
  } else {
    let tempDrain = 0;
    if (isNight) tempDrain += 2.0;
    if (weatherState === WEATHER.RAIN) tempDrain += 3.0;
    if (weatherState === WEATHER.BLIZZARD) tempDrain += 15.0; // Extreme cold
    
    if (tempDrain > 0) {
      playerTemp -= tempDrain * dt;
      if (playerTemp <= 0) {
        playerTemp = 0;
        playerHealth -= dt * 2.0;
        if (playerHealth <= 0) triggerDeath();
      }
    } else {
      playerTemp = Math.min(playerMaxTemp, playerTemp + dt * 1.5);
    }
  }

  // Roll cooldown
  if (rollCooldown > 0) rollCooldown -= dt;

  // Camera rotation
  const sens = 0.0018;
  targetSwayX = mouseDX * 0.0015;
  targetSwayY = mouseDY * 0.0015;
  yaw   -= mouseDX * sens;
  pitch -= mouseDY * sens;
  
  if (recoilTimer > 0) {
    recoilTimer -= dt;
    if (recoilTimer < 0) recoilTimer = 0;
    const progress = 1 - (recoilTimer / recoilDuration);
    const newRecoilPitch = Math.sin(progress * Math.PI) * recoilMaxStrength;
    pitch -= (newRecoilPitch - currentRecoilPitch);
    currentRecoilPitch = newRecoilPitch;
  }
  
  pitch  = Math.max(-1.3, Math.min(1.3, pitch));
  mouseDX = mouseDY = 0;

  playerBody.rotation.y = yaw;
  camera.rotation.x = pitch;

  // Stamina
  if (typeof window.staminaRegenDelayTimer === 'undefined') window.staminaRegenDelayTimer = 0;
  if (playerStamina <= 0) { playerStamina = 0; isExhausted = true; }
  if (playerStamina > 25) { isExhausted = false; }
  isSprinting = keys['ShiftLeft'] && (keys['KeyW']||keys['KeyS']||keys['KeyA']||keys['KeyD']) && !isRolling && !isExhausted && !isWorkbenchOpen && !isChestOpen && !isSkillMenuOpen;
  
  let currentStaminaDrainMult = staminaDrainMult;
  if (playerTemp < 30) currentStaminaDrainMult *= 2.0;
  
  let currentStaminaRegenRate = 15;
  if (playerTemp > 80) currentStaminaRegenRate = 25;
  else if (playerTemp < 30) currentStaminaRegenRate = 5;

  if (isSprinting && playerStamina > 0) {
    playerStamina = Math.max(0, playerStamina - dt * 25 * currentStaminaDrainMult);
    window.staminaRegenDelayTimer = 1.5; // 1.5 second delay before regen starts
  } else if (!isSprinting && !isRolling) {
    if (window.staminaRegenDelayTimer > 0) {
      window.staminaRegenDelayTimer -= dt;
    } else {
      playerStamina = Math.min(playerMaxStamina, playerStamina + dt * currentStaminaRegenRate);
    }
  }
  if (playerStamina === 0) isSprinting = false;

  // Out of combat regen
  outOfCombatTimer += dt;
  if (outOfCombatTimer > 8.0 && playerHealth < playerMaxHealth * 0.5) {
    let regenRate = 2.5;
    if (playerTemp < 30) regenRate = 0.5;
    playerHealth = Math.min(playerMaxHealth * 0.5, playerHealth + dt * regenRate);
    updateHUD(dt);
  }

  if (isRolling) {
    updateRoll(dt);
  } else {
    // Crouch logic
    isCrouching = (keys['ControlLeft'] || keys['KeyZ']) && onGround && !isSprinting;
    const targetPlayerH = isCrouching ? 0.9 : 1.7;
    PLAYER_H += (targetPlayerH - PLAYER_H) * 10 * dt;

    // Normal movement
    let tempSpeedMult = 1.0;
    if (playerTemp < 30) tempSpeedMult = 0.7;
    let targetSpeed = PLAYER_SPEED * (isSprinting ? SPRINT_MULT : 1) * speedMultiplier * tempSpeedMult;
    if (isCrouching) targetSpeed *= 0.5;

    const dir = new THREE.Vector3();
    if (!isWorkbenchOpen && !isChestOpen && !isSkillMenuOpen) {
      const fwd = new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
      const rgt = new THREE.Vector3( Math.cos(yaw),0,-Math.sin(yaw));
      if (keys['KeyW']) dir.addScaledVector(fwd,1);
      if (keys['KeyS']) dir.addScaledVector(fwd,-1);
      if (keys['KeyA']) dir.addScaledVector(rgt,-1);
      if (keys['KeyD']) dir.addScaledVector(rgt,1);
      if (dir.lengthSq()>0) dir.normalize();
    }

    const targetVelX = dir.x * targetSpeed;
    const targetVelZ = dir.z * targetSpeed;
    
    if (onGround) {
      playerVel.x = targetVelX;
      playerVel.z = targetVelZ;
    } else {
      playerVel.x += (targetVelX - playerVel.x) * 2 * dt;
      playerVel.z += (targetVelZ - playerVel.z) * 2 * dt;
    }

    // Gravity + jump / dodge roll
    playerVel.y += GRAVITY * dt;
    if (keys['Space'] && onGround && !isJumping && !isWorkbenchOpen && !isChestOpen && !isSkillMenuOpen) {
      if (keys['ShiftLeft'] || keys['ShiftRight']) {
        // UPGRADE 1: Shift+Space = dodge roll
        keys['Space'] = false;
        tryDodgeRoll();
      } else {
        // Space alone = normal jump
        playerVel.y = JUMP_FORCE;
        isJumping = true;
      }
    }

    playerBody.position.addScaledVector(playerVel, dt);
    resolveWallCollisions(playerBody.position, 0.4);
  }

  // Gravity always applies (even during roll for slopes)
  if (!isRolling) {
    playerVel.y += 0; // gravity already added above
    
    let targetTilt = 0;
    if (!isWorkbenchOpen && !isChestOpen && !isSkillMenuOpen) {
      if (keys['KeyA']) targetTilt = 0.035;
      if (keys['KeyD']) targetTilt = -0.035;
    }
    camera.rotation.z += (targetTilt - camera.rotation.z) * 8 * dt;
    
    const targetFOV = isSprinting ? 88 : 75;
    if (Math.abs(camera.fov - targetFOV) > 0.1) {
      camera.fov += (targetFOV - camera.fov) * 8 * dt;
      camera.updateProjectionMatrix();
    }
  }

  // Ground detection
  let groundH = getTerrainHeight(playerBody.position.x, playerBody.position.z);
  
  // Check structures for ground
  const px = playerBody.position.x, pz = playerBody.position.z;
  for (const w of walls) {
    const ud = w.userData;
    if (!ud) continue;
    
    const dx = px - w.position.x;
    const dz = pz - w.position.z;
    
    // Rotate point back to AABB space
    const cos = Math.cos(w.rotation.y);
    const sin = Math.sin(w.rotation.y);
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    
    if (Math.abs(lx) <= ud.hw + 0.3 && Math.abs(lz) <= ud.hd + 0.3) {
      let structH = w.position.y; // Base height
      if (ud.type === 'stairs') {
        structH += -WALL_H/2;
        let normalizedZ = (lz + TILE/2) / TILE; // 0 to 1
        normalizedZ = Math.max(0, Math.min(1, normalizedZ));
        structH += normalizedZ * WALL_H;
      } else if (ud.type === 'roof') {
        let normalizedZ = (lz + TILE/2) / TILE;
        normalizedZ = Math.max(0, Math.min(1, normalizedZ));
        structH += normalizedZ * 1.5; // Roof height
      } else if (ud.type === 'wall' || ud.type === 'door') {
        structH += WALL_H/2;
      }
      
      if (structH > groundH && playerBody.position.y - PLAYER_H >= structH - 0.5) {
        groundH = structH;
      }
    }
  }

  // Check blocks for ground
  const minX = Math.floor(px - 0.3 - BLOCK_SIZE/2);
  const maxX = Math.floor(px + 0.3 + BLOCK_SIZE/2);
  const minZ = Math.floor(pz - 0.3 - BLOCK_SIZE/2);
  const maxZ = Math.floor(pz + 0.3 + BLOCK_SIZE/2);
  const feetY = playerBody.position.y - PLAYER_H;

  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      // Check column
      for (let y = Math.floor(feetY - 1.5); y <= Math.floor(feetY + 0.5); y++) {
        const key = blockKey(x, y, z);
        const bData = blocks.get(key);
        if (bData) {
          const b = bData.mesh;
          const dx = px - b.position.x;
          const dz = pz - b.position.z;
          if (Math.abs(dx) <= BLOCK_SIZE/2 + 0.3 && Math.abs(dz) <= BLOCK_SIZE/2 + 0.3) {
            const blockTop = b.position.y + BLOCK_SIZE/2;
            if (blockTop > groundH && feetY >= blockTop - 0.5) {
              groundH = blockTop;
            }
          }
        }
      }
    }
  }

  let oldY = playerBody.position.y;
  if (playerBody.position.y - PLAYER_H < groundH) {
    if (!onGround && playerVel.y < -15) {
      const fallDmg = Math.floor((Math.abs(playerVel.y) - 15) * 5);
      if (fallDmg > 0) {
        playerHealth -= fallDmg;
        showAlert(`Fall damage: -${fallDmg} HP`, true);
        screenShake(0.2);
        updateHUD(dt);
        if (playerHealth <= 0) triggerDeath();
      }
    }
    playerBody.position.y = groundH + PLAYER_H;
    const diff = playerBody.position.y - oldY;
    if (diff > 0 && diff < 1.0 && onGround) {
      cameraYOffset -= diff;
    }
    playerVel.y = 0;
    onGround = true;
    isJumping = false;
  } else {
    onGround = (playerBody.position.y - PLAYER_H < groundH + 0.05);
    if (!onGround) isJumping = true;
  }

  // Head bob
  const moving2 = (keys['KeyW']||keys['KeyS']||keys['KeyA']||keys['KeyD']) && onGround && !isRolling;
  if (moving2) {
    headBob += dt*(isSprinting?14:9);
    headBob %= Math.PI * 2;
    headBobAmt = Math.sin(headBob)*(isSprinting?0.06:0.035);
  } else { headBob=0; headBobAmt*=0.85; }
  
  cameraYOffset += (0 - cameraYOffset) * 15 * dt;
  if (!isRolling) camera.position.y = headBobAmt + cameraYOffset;

  // Boundary
  playerBody.position.x = Math.max(-85,Math.min(85,playerBody.position.x));
  playerBody.position.z = Math.max(-85,Math.min(85,playerBody.position.z));

  if (weaponCooldown>0) weaponCooldown-=dt;

  const w = weapons[activeWeapon];
  if (VoxelSystem.active && !isWorkbenchOpen && !isChestOpen && !isSkillMenuOpen && mouse.buttons&1 && weaponCooldown<=0) {
    tryPlaceStructure();
    weaponCooldown = 0.3;
  }
  if (!VoxelSystem.active && !isWorkbenchOpen && !isChestOpen && !isSkillMenuOpen && mouse.buttons&1 && w.type==='gun' && weaponCooldown<=0 && !isReloading) fireGun();
  checkInteractable();
  if (!VoxelSystem.active && !isWorkbenchOpen && !isChestOpen && !isSkillMenuOpen && mouse.buttons&1 && w.type==='melee' && weaponCooldown<=0) doMelee();

  // UPGRADE 1: Update roll indicator
  const rollEl = document.getElementById('rollIndicator');
  if (respawnGraceTimer > 0) {
    rollEl.textContent = `🛡 SAFE ${respawnGraceTimer.toFixed(1)}s`;
    rollEl.style.opacity = '1';
  } else if (isRolling) { rollEl.textContent='⚡ ROLLING...'; rollEl.style.opacity='1'; }
  else if (rollCooldown>0) { rollEl.textContent=`⚡ ROLL ${rollCooldown.toFixed(1)}s`; rollEl.style.opacity='0.5'; }
  else { rollEl.textContent='⚡ ROLL READY'; rollEl.style.opacity='1'; }

  // Single-action input for Campfire placement
  if (keys['KeyF'] && !prevKeys['KeyF']) {
    if (!isWorkbenchOpen && !isChestOpen && !isSkillMenuOpen) {
      VoxelSystem.active = false;
      tryPlaceCampfire();
    }
  }
}

// ─── INTERACTION ──────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
let interactTarget = null;
let currentChest = null;

function resolveRayRoot(obj) {
  let root = obj;
  while (root && root.parent && (!root.userData || !root.userData.type)) root = root.parent;
  return root;
}

function isUsableRayTarget(obj) {
  const ud = obj && obj.userData;
  if (!ud) return false;
  if (ud.type === 'wood' || ud.type === 'stone' || ud.type === 'campfire') return true;
  if (typeof ud.health === 'number') return ud.health > 0;
  return false;
}

function firstValidRayHit(hits, maxDist = Infinity) {
  for (const hit of hits) {
    if (hit.distance > maxDist) continue;
    const root = resolveRayRoot(hit.object);
    if (!root || !isUsableRayTarget(root)) continue;
    return { hit, root };
  }
  return null;
}

const corpses = [];
function createCorpseStash(x, z, w, s, b, rm, cm, sc=0) {
  if (w===0 && s===0 && b===0 && rm===0 && cm===0 && sc===0) return;
  const h = getTerrainHeight(x, z);
  const group = new THREE.Group();
  group.position.set(x, h, z);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.8), MATS.wWoodDk);
  box.position.y = 0.25; box.castShadow = true; group.add(box);
  group.userData = { type: 'corpse', health: 1, wood: w, stone: s, berries: b, rawMeat: rm, cookedMeat: cm, scrap: sc };
  scene.add(group); corpses.push(group);
}

function checkInteractable() {
  if (VoxelSystem.active || isWorkbenchOpen || isChestOpen || isSkillMenuOpen) { interactTarget=null; document.getElementById('interactPrompt').style.display='none'; return; }
  camera.updateMatrixWorld();
  raycaster.setFromCamera({x:0,y:0}, camera);
  const allObjs = [...bandits,...deers,...trees,...rocks,...bushes,...walls,...carts,...corpses,...turrets,...workbenches,...campfires,...barrels,...planters,...chests,...blockMeshes].filter(isUsableRayTarget);
  const hits = raycaster.intersectObjects(allObjs, true);
  const terrHits = raycaster.intersectObject(terrain);
  const prompt = document.getElementById('interactPrompt');
  interactTarget = null;
  if (hits.length>0 && (terrHits.length===0 || hits[0].distance < terrHits[0].distance)) {
    for (let i = 0; i < hits.length; i++) {
      let obj = resolveRayRoot(hits[i].object);
      let dist = hits[i].distance;
      if (!obj || !obj.userData) continue;
      
      if (obj.userData.type === 'tree' || obj.userData.type === 'rock') {
        const dx = playerBody.position.x - obj.position.x;
        const dz = playerBody.position.z - obj.position.z;
        dist = Math.sqrt(dx*dx + dz*dz);
      }
      
      if (typeof obj.userData.health === 'number' && obj.userData.health <= 0 && obj.userData.type !== 'campfire') continue;
      
      let valid = false;
      if (obj.userData.type==='tree'&&dist<4) { prompt.style.display='block'; prompt.textContent='[E] or [CLICK] Chop Tree'; interactTarget=obj; valid=true; }
      else if (obj.userData.type==='rock'&&dist<3.5) { prompt.style.display='block'; prompt.textContent='[E] or [CLICK] Mine Rock'; interactTarget=obj; valid=true; }
      else if (obj.userData.type==='bush'&&dist<3.5) { prompt.style.display='block'; prompt.textContent='[E] Forage Berries'; interactTarget=obj; valid=true; }
      else if (obj.userData.type==='cart'&&dist<4) { prompt.style.display='block'; prompt.textContent='[E] Loot Abandoned Cart'; interactTarget=obj; valid=true; }
      else if (obj.userData.type==='corpse'&&dist<4) { prompt.style.display='block'; prompt.textContent='[E] Retrieve Lost Items'; interactTarget=obj; valid=true; }
      else if (obj.userData.type==='workbench'&&dist<4) { prompt.style.display='block'; prompt.textContent='[E] Open Workbench'; interactTarget=obj; valid=true; }
      else if (obj.userData.type==='barrel'&&dist<4) { prompt.style.display='block'; prompt.textContent='[E] or [CLICK] Detonate Barrel'; interactTarget=obj; valid=true; }
      else if ((obj.userData.type==='wall' || obj.userData.type==='door' || obj.userData.type==='stairs' || obj.userData.type==='roof')&&dist<3.5&&obj.userData.health<(window.wallMaxHealth || 150)) { prompt.style.display='block'; prompt.textContent='[E] Repair (1 Wood)'; interactTarget=obj; valid=true; }
      else if (obj.userData.type==='door'&&dist<3.5) { prompt.style.display='block'; prompt.textContent=obj.userData.isOpen ? '[E] Close Door' : '[E] Open Door'; interactTarget=obj; valid=true; }
      else if (obj.userData.type==='planter'&&dist<3.5) { prompt.style.display='block'; prompt.textContent=obj.userData.ready ? '[E] Harvest Berries' : `Growing... (${Math.floor(obj.userData.growth)}%)`; interactTarget=obj; valid=true; }
      else if (obj.userData.type==='chest'&&dist<4) { prompt.style.display='block'; prompt.textContent='[E] Open Storage Chest'; interactTarget=obj; valid=true; }
      else if (obj.userData.type==='campfire'&&dist<3.5) { 
        prompt.style.display='block'; 
        if (!obj.userData.isLit) prompt.textContent='[E] Light Fire (1 Wood)';
        else prompt.textContent='[E] Add Fuel (1 Wood) | Auto-cooks meat';
        interactTarget=obj; 
        valid=true;
      }
      
      if (valid) {
        // Target Info (Health Bar)
        const targetInfo = document.getElementById('targetInfo');
        const ch = document.getElementById('crosshair');
        if (obj.userData.health !== undefined && obj.userData.maxHealth !== undefined && dist < 30) {
          targetInfo.style.display = 'block';
          document.getElementById('targetName').textContent = obj.userData.type.toUpperCase() + (obj.userData.health <= 0 ? ' (DEAD)' : '');
          document.getElementById('targetHealthFill').style.width = Math.max(0, (obj.userData.health / obj.userData.maxHealth) * 100) + '%';
          
          if ((obj.userData.type === 'bandit' || obj.userData.type === 'deer') && obj.userData.health > 0) {
            ch.classList.add('enemy-target');
          } else {
            ch.classList.remove('enemy-target');
          }
        } else {
          targetInfo.style.display = 'none';
          ch.classList.remove('enemy-target');
        }
        return; // Found a valid target, stop checking
      }
    }
    
    // If we get here, no valid target was found in range
    prompt.style.display='none';
    document.getElementById('targetInfo').style.display = 'none';
    document.getElementById('crosshair').classList.remove('enemy-target');
  } else {
    prompt.style.display='none';
    document.getElementById('targetInfo').style.display = 'none';
    document.getElementById('crosshair').classList.remove('enemy-target');
  }
}

function doInteract() {
  if (!interactTarget) return;
  const target = interactTarget;
  const t=target.userData;
  const w=weapons[activeWeapon];
  const wDamage = Math.floor(w.damage * combatDamageMult);
  if (t.type==='tree'&&activeWeapon===0) {
    if (t.isDead) return;
    const isCrit = Math.random() < 0.15;
    const dmg = wDamage * (isCrit ? 2 : 1);
    t.health-=dmg; weaponCooldown=WINDUP_DUR+STRIKE_DUR+RECOVER_DUR;
    const yieldAmt = isCrit ? 2 : 1;
    if (t.wood > 0) { spawnDrop('wood', target.position, yieldAmt); t.wood -= yieldAmt; }
    spawnParticle(target.position, isCrit ? 0xffdd00 : 0x5a3a1a); swingEffect(); triggerVMSwing(); screenShake(isCrit ? 0.1 : 0.05);
    spawnFloatingText(target.position.clone().add(new THREE.Vector3(0, 2, 0)), isCrit ? `CRIT! -${dmg}` : `-${dmg}`, isCrit ? '#ffff00' : '#ffaa00');
    triggerHitMarker(false);
    
    // Visual progress indicator on object
    showHarvestProgress(target);
    
    new TWEEN_anim(target, { scale: { x: 0.85, y: 0.85, z: 0.85 } }, 80, () => {
      if (target.userData.health > 0) new TWEEN_anim(target, { scale: { x: 1, y: 1, z: 1 } }, 120);
    });

    if (t.health<=0) {
      t.isDead = true;
      addXP(10);
      for(let i=0; i<t.wood; i++) spawnDrop('wood', target.position, 1);
      new TWEEN_anim(target,{rotation:{z:Math.PI/2}},800,()=>{scene.remove(target);disposeObject(target);trees.splice(trees.indexOf(target),1);});
    }
  } else if (t.type==='rock'&&activeWeapon===1) {
    if (t.isDead) return;
    const isCrit = Math.random() < 0.15;
    const dmg = wDamage * (isCrit ? 2 : 1);
    t.health-=dmg; weaponCooldown=WINDUP_DUR+STRIKE_DUR+RECOVER_DUR;
    const yieldAmt = isCrit ? 2 : 1;
    if (t.stone > 0) { spawnDrop('stone', target.position, yieldAmt); t.stone -= yieldAmt; }
    spawnParticle(target.position, isCrit ? 0xffdd00 : 0x7a7a6a); swingEffect(); triggerVMSwing(); screenShake(isCrit ? 0.1 : 0.05);
    spawnFloatingText(target.position.clone().add(new THREE.Vector3(0, 1, 0)), isCrit ? `CRIT! -${dmg}` : `-${dmg}`, isCrit ? '#ffff00' : '#aaaaaa');
    triggerHitMarker(false);
    
    // Visual progress indicator on object
    showHarvestProgress(target);
    
    new TWEEN_anim(target, { scale: { x: 0.85, y: 0.85, z: 0.85 } }, 80, () => {
      if (target.userData.health > 0) new TWEEN_anim(target, { scale: { x: 1, y: 1, z: 1 } }, 120);
    });

    if (t.health<=0) {
      t.isDead = true;
      for(let i=0; i<t.stone; i++) spawnDrop('stone', target.position, 1);
      scene.remove(target); disposeObject(target); rocks.splice(rocks.indexOf(target),1);
    }
  } else if (t.type==='door' && t.health >= (window.wallMaxHealth || 150)) {
     // If door is full health, E opens/closes it
     t.isOpen = !t.isOpen;
     const pivot = target.getObjectByName('doorPivot');
     if (pivot) {
       new TWEEN_anim(pivot, { rotation: { y: t.isOpen ? Math.PI/2 : 0 } }, 300);
     }
  } else if ((t.type==='wall' || t.type==='door' || t.type==='stairs' || t.type==='roof') && t.health < (window.wallMaxHealth || 150)) {
    if (wood >= 1) {
      wood--; updateResources();
      t.health = Math.min((window.wallMaxHealth || 150), t.health + 50);
      // Feature 2: Re-evaluate critical flash after repair
      t.criticalFlash = (t.health / (window.wallMaxHealth || 150) < 0.3);
      spawnParticle(target.position, 0x44ff44);
      showAlert('Structure repaired!', false);
      swingEffect(); triggerVMSwing(); screenShake(0.05);

    } else {
      showAlert('Need 1 Wood to repair!', true);
    }
  } else if (t.type==='door' && t.health < (window.wallMaxHealth || 150)) {
     // If door is damaged, E repairs it (handled above). To open a damaged door, we need a separate check or just let them repair first.
     // For simplicity, if it's damaged, E repairs. If they want to open it, they must repair it fully first.
  } else if (t.type==='bush') {
    if (t.berries > 0) {
      t.berries--;
      if (t.isGolden) {
        playerMaxHealth += 20;
        playerHealth = playerMaxHealth;
        playerMaxStamina += 20;
        playerStamina = playerMaxStamina;
        spawnFloatingText(target.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 'MAX HP/STAMINA UP!', '#ffd700');
        showAlert('Ate a Golden Berry! Max Health and Stamina increased.', false);
      } else {
        const amt = berryGatherMult;
        berries += amt;
        spawnFloatingText(target.position.clone().add(new THREE.Vector3(0, 1.5, 0)), `+${amt} Berry`, '#ff4444');
      }
      updateResources(); updateHUD(0.016);
      if (t.berryMeshes[t.berries]) t.berryMeshes[t.berries].visible = false;
      if (t.berries <= 0) {
        t.health = 0;
        new TWEEN_anim(target, { scale: { x: 0.1, y: 0.1, z: 0.1 } }, 500, () => {
          scene.remove(target); disposeObject(target); bushes.splice(bushes.indexOf(target),1);
        });
      }
    }
  } else if (t.type==='cart') {
    wood += 15 + Math.floor(Math.random()*10);
    stone += 10 + Math.floor(Math.random()*10);
    weapons[2].reserveAmmo += 12;
    weapons[3].reserveAmmo += 5;
    updateResources(); updateHUD(0.016);
    spawnFloatingText(target.position.clone().add(new THREE.Vector3(0, 2, 0)), 'Loot Found!', '#ffaa00');
    scene.remove(target);
    disposeObject(target);
    const idx = carts.indexOf(target);
    if (idx > -1) carts.splice(idx, 1);
    interactTarget = null;
    document.getElementById('interactPrompt').style.display = 'none';
  } else if (t.type==='workbench') {
    isWorkbenchOpen = true;
    document.getElementById('workbenchUI').style.display = 'flex';
    updateWorkbenchUI();
    document.exitPointerLock();
    if (document.body.classList.contains('ui-active')) return;
    document.getElementById('customCursor').style.display = 'block';
    interactTarget = null;
    document.getElementById('interactPrompt').style.display = 'none';
  } else if (t.type==='chest') {
    isChestOpen = true;
    currentChest = target;
    document.getElementById('chestUI').style.display = 'flex';
    updateChestUI();
    document.exitPointerLock();
    if (document.body.classList.contains('ui-active')) return;
    document.getElementById('customCursor').style.display = 'block';
    interactTarget = null;
    document.getElementById('interactPrompt').style.display = 'none';
  } else if (t.type==='planter') {
    if (t.ready) {
      const yieldAmt = 3 + Math.floor(Math.random()*3);
      berries += yieldAmt;
      t.growth = 0;
      t.ready = false;
      const bush = target.getObjectByName('berryBush');
      if (bush) {
        target.remove(bush);
        if (bush.geometry) bush.geometry.dispose();
      }
      updateResources();
      spawnFloatingText(target.position.clone().add(new THREE.Vector3(0, 1.5, 0)), `+${yieldAmt} Berries`, '#ff44aa');
    }
  } else if (t.type==='corpse') {
    wood += t.wood; stone += t.stone; berries += t.berries;
    if (t.rawMeat) rawMeat += t.rawMeat;
    if (t.cookedMeat) cookedMeat += t.cookedMeat;
    if (t.scrap) scrap += t.scrap;
    updateResources(); updateHUD(0.016);
    spawnFloatingText(target.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 'Recovered Items!', '#44ff44');
    scene.remove(target);
    disposeObject(target);
    const idx = corpses.indexOf(target);
    if (idx > -1) corpses.splice(idx, 1);
    interactTarget = null;
    document.getElementById('interactPrompt').style.display = 'none';
  } else if (t.type==='campfire') {
    if (!t.isLit) {
      if (wood >= 1) {
        wood--; t.isLit = true; t.fuel = 180;
        t.light.intensity = 2.5;
        const flame = target.getObjectByName('flame');
        if (flame) flame.visible = true;
        showAlert('Campfire lit!', false);
        updateResources();
      } else showAlert('Need 1 Wood to light!', true);
    } else {
      if (wood >= 1) {
        wood--; t.fuel = Math.min(300, t.fuel + 120);
        showAlert('Added fuel to campfire.', false);
        updateResources();
      } else showAlert('Need 1 Wood for fuel!', true);
    }
  } else if (t.type==='barrel') {
    explodeBarrel(target);
  } else {
    if (t.type==='tree') showAlert('Need Axe to chop!',true);
    if (t.type==='rock') showAlert('Need Pickaxe to mine!',true);
  }
}

// ─── VIEWMODEL ────────────────────────────────────────────────────────────────
const viewmodelRoot = new THREE.Group();
viewmodelRoot.position.set(0.22,-0.22,-0.38);
camera.add(viewmodelRoot);
let vmBob = 0;
const SWING_WINDUP=0, SWING_STRIKE=1, SWING_RECOVER=2;
let vmSwingPhase=-1, vmSwingT=0;
const WINDUP_DUR=0.45, STRIKE_DUR=0.28, RECOVER_DUR=0.55;
let vmRecoilT=0, vmRecoilActive=false;
const RECOIL_DUR=0.22;
function lerp(a,b,t){return a+(b-a)*t;}
function easeOut(t){return 1-(1-t)*(1-t);}
function easeIn(t){return t*t;}

function buildAxeModel() {
  const g=new THREE.Group();
  g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.026,0.034,1.1,6),MATS.wWood)));
  const eye=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,0.08),MATS.wMetalDk); eye.position.set(0,0.48,0); g.add(eye);
  const headBody=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.34,0.11),MATS.wMetal); headBody.position.set(0.04,0.48,0); g.add(headBody);
  const blade=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.30,0.038),MATS.wBlade); blade.position.set(0.16,0.48,0); g.add(blade);
  const bT=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.04,0.036),MATS.wBlade); bT.position.set(0.13,0.62,0); bT.rotation.z=-0.38; g.add(bT);
  const bB=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.04,0.036),MATS.wBlade); bB.position.set(0.13,0.34,0); bB.rotation.z=0.38; g.add(bB);
  const poll=new THREE.Mesh(new THREE.BoxGeometry(0.055,0.13,0.09),MATS.wMetalDk); poll.position.set(-0.035,0.48,0); g.add(poll);
  g.rotation.set(-0.9,0.35,-0.45); g.scale.setScalar(0.88); return g;
}

function buildPickaxeModel() {
  const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.024,0.032,1.1,6),MATS.wWood));
  const eye=new THREE.Mesh(new THREE.BoxGeometry(0.085,0.095,0.095),MATS.wMetalDk); eye.position.set(0,0.5,0); g.add(eye);
  const hBar=new THREE.Mesh(new THREE.BoxGeometry(0.058,0.075,0.5),MATS.wMetal); hBar.position.set(0,0.5,0); g.add(hBar);
  const spike=new THREE.Mesh(new THREE.CylinderGeometry(0.011,0.032,0.3,5),MATS.wBlade); spike.rotation.x=Math.PI/2; spike.position.set(0,0.5,-0.33); g.add(spike);
  const tip=new THREE.Mesh(new THREE.CylinderGeometry(0.001,0.011,0.1,5),MATS.wBlade); tip.rotation.x=Math.PI/2; tip.position.set(0,0.5,-0.5); g.add(tip);
  const chisel=new THREE.Mesh(new THREE.BoxGeometry(0.052,0.088,0.22),MATS.wMetal); chisel.position.set(0,0.5,0.27); g.add(chisel);
  const cEdge=new THREE.Mesh(new THREE.BoxGeometry(0.038,0.088,0.038),MATS.wBlade); cEdge.position.set(0,0.5,0.39); g.add(cEdge);
  g.rotation.set(-0.85,0.28,-0.4); g.scale.setScalar(0.86); return g;
}

function buildRevolverModel() {
  const g=new THREE.Group();
  const grip=new THREE.Mesh(new THREE.BoxGeometry(0.062,0.19,0.052),MATS.wWoodDk); grip.rotation.x=0.22; grip.position.set(0,-0.11,0.04); g.add(grip);
  const bs=new THREE.Mesh(new THREE.BoxGeometry(0.016,0.19,0.018),MATS.wMetal); bs.rotation.x=0.22; bs.position.set(0,-0.11,0.065); g.add(bs);
  const frame=new THREE.Mesh(new THREE.BoxGeometry(0.058,0.082,0.1),MATS.wMetal); g.add(frame);
  const cyl=new THREE.Mesh(new THREE.CylinderGeometry(0.052,0.052,0.072,6),MATS.wMetalDk); cyl.rotation.x=Math.PI/2; g.add(cyl);
  for(let i=0;i<6;i++){const f=new THREE.Mesh(new THREE.CylinderGeometry(0.011,0.011,0.075,5),MATS.wMetalDk);f.rotation.x=Math.PI/2;const a=(i/6)*Math.PI*2;f.position.set(Math.cos(a)*0.03,Math.sin(a)*0.03,0);g.add(f);}
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.017,0.019,0.46,8),MATS.wMetal); barrel.rotation.x=Math.PI/2; barrel.position.set(0,0.01,-0.28); g.add(barrel);
  const tr=new THREE.Mesh(new THREE.BoxGeometry(0.009,0.009,0.44),MATS.wMetalDk); tr.position.set(0,0.022,-0.27); g.add(tr);
  const fs=new THREE.Mesh(new THREE.BoxGeometry(0.007,0.015,0.007),MATS.wMetalDk); fs.position.set(0,0.032,-0.49); g.add(fs);
  const rs=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.013,0.009),MATS.wMetalDk); rs.position.set(0,0.048,0.052); g.add(rs);
  const hm=new THREE.Mesh(new THREE.BoxGeometry(0.016,0.042,0.028),MATS.wMetalDk); hm.position.set(0,0.058,0.062); hm.rotation.x=-0.28; g.add(hm);
  const tgT=new THREE.Mesh(new THREE.BoxGeometry(0.009,0.009,0.065),MATS.wMetal); tgT.position.set(0,-0.042,0.01); g.add(tgT);
  const tgF=new THREE.Mesh(new THREE.BoxGeometry(0.009,0.055,0.009),MATS.wMetal); tgF.position.set(0,-0.068,-0.023); g.add(tgF);
  const tgB=new THREE.Mesh(new THREE.BoxGeometry(0.009,0.009,0.055),MATS.wMetal); tgB.position.set(0,-0.096,0.005); g.add(tgB);
  const trig=new THREE.Mesh(new THREE.BoxGeometry(0.007,0.028,0.007),MATS.wMetalDk); trig.position.set(0,-0.048,-0.005); trig.rotation.x=0.2; g.add(trig);
  const mz=new THREE.Mesh(new THREE.CylinderGeometry(0.021,0.017,0.013,8),MATS.wMetalDk); mz.rotation.x=Math.PI/2; mz.position.set(0,0.01,-0.507); g.add(mz);
  g.rotation.set(0,-0.08,0.06); g.scale.setScalar(1.08); return g;
}

function buildRifleModel() {
  const g=new THREE.Group();
  const stock=new THREE.Mesh(new THREE.BoxGeometry(0.052,0.072,0.84),MATS.wWood); stock.position.set(0,-0.01,0.5); g.add(stock);
  const ck=new THREE.Mesh(new THREE.BoxGeometry(0.048,0.032,0.28),MATS.wWood); ck.position.set(0,0.038,0.38); g.add(ck);
  const bt=new THREE.Mesh(new THREE.BoxGeometry(0.058,0.098,0.016),MATS.wMetal); bt.position.set(0,-0.006,0.92); g.add(bt);
  const wr=new THREE.Mesh(new THREE.BoxGeometry(0.055,0.068,0.19),MATS.wWoodDk); wr.position.set(0,-0.006,0.19); g.add(wr);
  const rec=new THREE.Mesh(new THREE.BoxGeometry(0.062,0.09,0.24),MATS.wMetal); rec.position.set(0,0.004,0.02); g.add(rec);
  const blt=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.016,0.17),MATS.wMetalDk); blt.position.set(0,0.054,0.02); g.add(blt);
  const pt=new THREE.Mesh(new THREE.BoxGeometry(0.065,0.025,0.095),MATS.wMetalDk); pt.position.set(0,-0.033,0.065); g.add(pt);
  const lvT=new THREE.Mesh(new THREE.BoxGeometry(0.011,0.011,0.13),MATS.wMetal); lvT.position.set(0,-0.048,0.065); g.add(lvT);
  const lvL=new THREE.Mesh(new THREE.BoxGeometry(0.011,0.07,0.011),MATS.wMetal); lvL.position.set(-0.042,-0.083,0.065); g.add(lvL);
  const lvR=new THREE.Mesh(new THREE.BoxGeometry(0.011,0.07,0.011),MATS.wMetal); lvR.position.set(0.042,-0.083,0.065); g.add(lvR);
  const lvB=new THREE.Mesh(new THREE.BoxGeometry(0.095,0.011,0.011),MATS.wMetal); lvB.position.set(0,-0.119,0.065); g.add(lvB);
  const trig=new THREE.Mesh(new THREE.BoxGeometry(0.008,0.038,0.008),MATS.wMetalDk); trig.position.set(0,-0.062,0.03); trig.rotation.x=0.15; g.add(trig);
  const brl=new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.017,1.24,8),MATS.wMetal); brl.rotation.x=Math.PI/2; brl.position.set(0,0.015,-0.62); g.add(brl);
  const mg=new THREE.Mesh(new THREE.CylinderGeometry(0.011,0.011,1.12,6),MATS.wMetalDk); mg.rotation.x=Math.PI/2; mg.position.set(0,-0.014,-0.56); g.add(mg);
  for(let i=0;i<2;i++){const bd=new THREE.Mesh(new THREE.CylinderGeometry(0.021,0.021,0.016,8),MATS.wMetalDk);bd.rotation.x=Math.PI/2;bd.position.set(0,0.002,-0.3-i*0.36);g.add(bd);}
  const fS=new THREE.Mesh(new THREE.BoxGeometry(0.006,0.017,0.006),MATS.wMetalDk); fS.position.set(0,0.034,-1.22); g.add(fS);
  const rS=new THREE.Mesh(new THREE.BoxGeometry(0.024,0.02,0.016),MATS.wMetalDk); rS.position.set(0,0.042,-0.18); g.add(rS);
  g.rotation.set(0,-0.06,0.04); g.scale.setScalar(0.85); return g;
}

const weaponModels = [buildAxeModel(),buildPickaxeModel(),buildRevolverModel(),buildRifleModel()];
const VM_OFFSETS = [[0.18,-0.30,-0.45],[0.16,-0.28,-0.45],[0.20,-0.22,-0.42],[0.10,-0.20,-0.40]];
weaponModels.forEach((m,i)=>{ m.visible=(i===0); viewmodelRoot.add(m); });

const muzzleFlashMat = new THREE.MeshLambertMaterial({color:0xffee88,emissive:0xffcc00,transparent:true,opacity:0});
const muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.028,5,5), muzzleFlashMat);
camera.add(muzzleFlash);

function positionMuzzleFlash() {
  if(activeWeapon===2) muzzleFlash.position.set(0.20,-0.20,-0.95);
  if(activeWeapon===3) muzzleFlash.position.set(0.10,-0.18,-1.50);
}

function updateViewmodel(dt) {
  if (!gameActive) return;
  const moving = (keys['KeyW']||keys['KeyS']||keys['KeyA']||keys['KeyD']) && onGround && !isRolling;
  const sprintMul = isSprinting ? 1.6 : 1.0;
  const t = clock.elapsedTime;
  const [rx,ry,rz] = VM_OFFSETS[activeWeapon];

  if (moving) {
    vmBob += dt*(isSprinting?11:7);
    const bobX=Math.sin(vmBob)*0.010*sprintMul, bobY=Math.abs(Math.sin(vmBob))*-0.007*sprintMul;
    viewmodelRoot.position.x += (rx+bobX-viewmodelRoot.position.x)*0.2;
    viewmodelRoot.position.y += (ry+bobY+weaponSwitch.offset-viewmodelRoot.position.y)*0.2;
  } else {
    viewmodelRoot.position.x += (rx-viewmodelRoot.position.x)*0.14;
    viewmodelRoot.position.y += (ry+weaponSwitch.offset-viewmodelRoot.position.y)*0.14;
  }
  viewmodelRoot.position.z += (rz-viewmodelRoot.position.z)*0.14;
  viewmodelRoot.position.y += Math.sin(t*1.3)*0.0018;
  viewmodelRoot.position.x += Math.cos(t*0.85)*0.0008;

  currentSwayX += (targetSwayX - currentSwayX) * 10 * dt;
  currentSwayY += (targetSwayY - currentSwayY) * 10 * dt;
  viewmodelRoot.rotation.y = -currentSwayX;
  viewmodelRoot.rotation.x = -currentSwayY;

  const m=weaponModels[activeWeapon];
  if (activeWeapon<=1) {
    const restX=activeWeapon===0?-0.9:-0.85, restY=activeWeapon===0?0.35:0.28, restZ=activeWeapon===0?-0.45:-0.40;
    if (vmSwingPhase===SWING_WINDUP) {
      vmSwingT+=dt/WINDUP_DUR; const p=Math.min(vmSwingT,1),e=easeOut(p);
      m.rotation.x=lerp(restX,restX-0.55,e); m.rotation.y=lerp(restY,restY+0.18,e); m.rotation.z=lerp(restZ,restZ-0.12,e);
      if(vmSwingT>=1){vmSwingPhase=SWING_STRIKE;vmSwingT=0;}
    } else if (vmSwingPhase===SWING_STRIKE) {
      vmSwingT+=dt/STRIKE_DUR; const p=Math.min(vmSwingT,1),e=easeIn(p);
      const wX=restX-0.55,wY=restY+0.18,wZ=restZ-0.12;
      m.rotation.x=lerp(wX,restX+1.1,e); m.rotation.y=lerp(wY,restY-0.25,e); m.rotation.z=lerp(wZ,restZ+0.30,e);
      if(vmSwingT>=1){vmSwingPhase=SWING_RECOVER;vmSwingT=0;}
    } else if (vmSwingPhase===SWING_RECOVER) {
      vmSwingT+=dt/RECOVER_DUR; const p=Math.min(vmSwingT,1),e=easeOut(p);
      const sX=restX+1.1,sY=restY-0.25,sZ=restZ+0.30;
      m.rotation.x=lerp(sX,restX,e); m.rotation.y=lerp(sY,restY,e); m.rotation.z=lerp(sZ,restZ,e);
      if(vmSwingT>=1){vmSwingPhase=-1;vmSwingT=0;}
    } else { m.rotation.x=restX; m.rotation.y=restY; m.rotation.z=restZ; }
  } else {
    if (vmRecoilActive) {
      vmRecoilT+=dt/RECOIL_DUR; const p=Math.min(vmRecoilT,1), kick=Math.sin(p*Math.PI), strength=activeWeapon===3?0.22:0.14;
      m.rotation.x=kick*strength; viewmodelRoot.position.z=rz+kick*0.05;
      if(vmRecoilT>=1){vmRecoilActive=false;vmRecoilT=0;}
    } else { m.rotation.x+=(0-m.rotation.x)*0.2; viewmodelRoot.position.z+=(rz-viewmodelRoot.position.z)*0.2; }
  }
}

function triggerVMSwing() {
  if(activeWeapon<=1){if(vmSwingPhase===-1||vmSwingPhase===SWING_RECOVER){vmSwingPhase=SWING_WINDUP;vmSwingT=0;}}
  else{vmRecoilActive=true;vmRecoilT=0;}
}

function selectWeaponModel(idx) {
  weaponModels.forEach((m,i)=>{m.visible=(i===idx);});
  vmSwingPhase=-1;vmSwingT=0;vmRecoilActive=false;vmRecoilT=0;
  positionMuzzleFlash();
}

// ─── COMBAT ───────────────────────────────────────────────────────────────────
function doMelee() {
  weaponCooldown=WINDUP_DUR+STRIKE_DUR+RECOVER_DUR; swingEffect(); triggerVMSwing();
  camera.updateMatrixWorld();
  raycaster.setFromCamera({x:0,y:0},camera);
  const aliveBandits = bandits.filter(b => b.userData.health > 0);
  const allTargets = [...aliveBandits, ...deers, ...walls, ...trees, ...rocks, ...barrels, ...blockMeshes].filter(isUsableRayTarget);
  const hits=raycaster.intersectObjects(allTargets,true);
  const wDamage = Math.floor(weapons[activeWeapon].damage * combatDamageMult);
  const chosen = firstValidRayHit(hits, weapons[activeWeapon].range);
  if(chosen){
    let b=chosen.root;
    if(b.userData.type==='bandit') damageBandit(b,wDamage);
    else if(b.userData.type==='deer') damageDeer(b,wDamage);
    else if(b.userData.type==='barrel') explodeBarrel(b);
  }
}

function fireGun() {
  const w=weapons[activeWeapon];
  if(w.ammo<=0){
    if(!isReloading) reload();
    return;
  }
  w.ammo--; weaponCooldown=1/w.rate; updateHUD(); crosshairBloom = 30;
  muzzleFlashMat.opacity=1; setTimeout(()=>muzzleFlashMat.opacity=0,55);
  recoilAnim(); triggerVMSwing();
  camera.updateMatrixWorld();
  raycaster.setFromCamera({x:0,y:0},camera);
  const allTargets=[...bandits, ...deers, ...trees, ...rocks, ...walls, ...carts, ...turrets, ...barrels, ...blockMeshes].filter(isUsableRayTarget);
  const hits=raycaster.intersectObjects(allTargets,true);
  const terrHits=raycaster.intersectObject(terrain);
  let hitBandit = false;
  const chosen = firstValidRayHit(hits, w.range);
  if(chosen){
    if(terrHits.length===0 || chosen.hit.distance < terrHits[0].distance){
      let b=chosen.root;
      if(b.userData.type==='bandit'){
        const isHead = chosen.hit.object.geometry === banditGeos.head;
        const baseDmg = Math.floor(w.damage * combatDamageMult);
        const dmg = isHead ? Math.floor(baseDmg * headshotBonus) : baseDmg;
        damageBandit(b, dmg, isHead);
        spawnParticle(chosen.hit.point,0xcc4444);
        hitBandit=true;
      } else if (b.userData.type==='deer') {
        const baseDmg = Math.floor(w.damage * combatDamageMult);
        damageDeer(b, baseDmg);
        hitBandit=true;
      } else if (b.userData.type==='barrel') {
        explodeBarrel(b);
        hitBandit=true;
      } else {
        spawnParticle(chosen.hit.point, 0xaaaaaa);
        hitBandit=true; // Prevents terrain particle
      }
    }
  }
  if(!hitBandit && terrHits.length>0&&terrHits[0].distance<w.range) spawnParticle(terrHits[0].point,0x6a5a3a);
}

let recoilTimer = 0;
let recoilDuration = 0;
let recoilMaxStrength = 0;
let currentRecoilPitch = 0;

function recoilAnim() {
  if (recoilTimer > 0) {
    pitch += currentRecoilPitch;
    currentRecoilPitch = 0;
  }
  recoilDuration = 0.32;
  recoilTimer = recoilDuration;
  recoilMaxStrength = activeWeapon === 3 ? 0.08 : 0.04;
}
function swingEffect() {
  if (recoilTimer > 0) {
    pitch += currentRecoilPitch;
    currentRecoilPitch = 0;
  }
  recoilDuration = 0.2;
  recoilTimer = recoilDuration;
  recoilMaxStrength = 0.12;
}

function damageBandit(b, dmg, isHeadshot = false) {
  // UPGRADE 1: If player is rolling (i-frames active), bandits can still be hit — player just can't take damage
  const d=b.userData;
  if (d.isDead) return;
  d.health-=dmg; d.hitFlash=0.25;
  d.attackCooldown = Math.max(d.attackCooldown, 0.8); // Stagger effect
  d.state = 'alert';
  d.alertTimer = 0.4;
  spawnFloatingText(b.position.clone().add(new THREE.Vector3(0, 1.5, 0)), isHeadshot ? `CRIT -${dmg}` : `-${dmg}`, isHeadshot ? '#ffcc00' : '#ff4444');
  const knockDir=new THREE.Vector3().subVectors(b.position,playerBody.position).normalize();
  b.position.addScaledVector(knockDir,0.3);
  if(d.health<=0) { d.isDead = true; killBandit(b); triggerHitMarker(true); }
  else { d.target=playerBody; d.exclaim&&(d.exclaim.visible=false); triggerHitMarker(false); }
}

function killBandit(b) {
  kills++;
  if(Math.random()>0.4){
    const ai=Math.random()<0.6?2:3;
    spawnDrop(ai===2?'ammo2':'ammo3', b.position, ai===2?6:4);
  }
  if(Math.random()>0.5){
    const amt = Math.floor(Math.random()*3)+1;
    spawnDrop('scrap', b.position, amt);
  }
  if(Math.random()>0.7){
    spawnDrop('wood', b.position, Math.floor(Math.random()*5)+2);
  }
  addXP(50);
  new TWEEN_anim(b,{rotation:{x:-Math.PI/2}},500,()=>{
    scene.remove(b); disposeObject(b);
    const idx = bandits.indexOf(b);
    if (idx > -1) bandits.splice(idx, 1);
    addKillFeed(); updateResources();
    setTimeout(()=>{
      if(!gameActive)return;
      if (bandits.filter(b=>b.userData.health>0).length < Math.min(18, 6 + daysSurvived)) {
        const spawn = findBanditSpawnNearPlayer(34, 58, 18);
        if (spawn) createBandit(spawn.x, spawn.z);
      }
    },12000+Math.random()*8000);
  });
  document.getElementById('killCount').textContent=kills; updateHUD(0.016);
}

function reload() {
  const w=weapons[activeWeapon]; if(w.type!=='gun' || isReloading || w.ammo===w.maxAmmo || w.reserveAmmo<=0)return;
  isReloading = true;
  showAlert('Reloading...', false);
  setTimeout(() => {
    const needed = w.maxAmmo - w.ammo;
    const toLoad = Math.min(needed, w.reserveAmmo);
    w.ammo += toLoad;
    w.reserveAmmo -= toLoad;
    showAlert('Reloaded!',false); updateHUD(0.016);
    isReloading = false;
  }, 1500 * reloadSpeedMult);
}

const activeTweens = [];
function TWEEN_anim(obj,targets,dur,onDone) {
  const initial={};
  for(const key in targets){
    if(typeof targets[key]==='object'){
      initial[key]={};
      for(const prop in targets[key]) initial[key][prop]=obj[key][prop];
    } else {
      initial[key]=obj[key];
    }
  }
  activeTweens.push({obj, targets, dur, onDone, initial, elapsed: 0});
}

function updateTweens(dt) {
  for (let i = activeTweens.length - 1; i >= 0; i--) {
    const tw = activeTweens[i];
    tw.elapsed += dt * 1000;
    const t = Math.min(1, tw.elapsed / tw.dur);
    for(const key in tw.targets){
      if(typeof tw.targets[key]==='object'){
        for(const prop in tw.targets[key]) tw.obj[key][prop]=tw.initial[key][prop]+(tw.targets[key][prop]-tw.initial[key][prop])*t;
      } else {
        tw.obj[key]=tw.initial[key]+(tw.targets[key]-tw.initial[key])*t;
      }
    }
    if (t >= 1) {
      if (tw.onDone) tw.onDone();
      activeTweens.splice(i, 1);
    }
  }
}

function checkLineOfSight(start, end) {
  const dir = new THREE.Vector3().subVectors(end, start);
  const dist = dir.length();
  dir.normalize();
  const ray = new THREE.Raycaster(start, dir, 0, dist);
  const intersects = ray.intersectObjects([...walls, ...trees, ...rocks, ...blockMeshes], true);
  for (const hit of intersects) {
    // Ignore open doors
    let obj = hit.object;
    while (obj.parent && obj.parent.type !== 'Scene') {
      if (obj.userData && obj.userData.type === 'door' && obj.userData.isOpen) break;
      obj = obj.parent;
    }
    if (obj.userData && obj.userData.type === 'door' && obj.userData.isOpen) continue;
    return false; // Blocked
  }
  // Check terrain
  const steps = 10;
  for (let i = 1; i < steps; i++) {
    const p = new THREE.Vector3().copy(start).lerp(end, i/steps);
    if (p.y < getTerrainHeight(p.x, p.z)) return false;
  }
  return true;
}

// ─── AI UPDATE ────────────────────────────────────────────────────────────────
// UPGRADE 2: Alert system — bandits now patrol → alert → chase
// UPGRADE 3: Night makes bandits faster & more aggressive
const pv3=new THREE.Vector3();

// UPGRADE 2: HUD flash for when a bandit spots you
let alertFlashTimer = 0;
function triggerAlertFlash() {
  alertFlashTimer = 0.5;
  document.getElementById('alertFlash').style.background='rgba(255,60,0,0.18)';
}

function updateAI(dt) {
  const pp=playerBody.position;
  // Night multipliers (UPGRADE 3)
  const nightSpeedMult  = isNight ? 1.45 : 1.0;
  const nightSightRange = isNight ? 35  : 25;  // bandits see further at night
  const nightDmg        = (isNight ? 18  : 12) + daysSurvived * 2;

  // Update alert flash
  if (alertFlashTimer > 0) {
    alertFlashTimer -= dt;
    if (alertFlashTimer <= 0) document.getElementById('alertFlash').style.background='rgba(255,60,0,0)';
  }

  for (const b of bandits) {
    const d=b.userData; if(d.health<=0)continue;
    if (d.attackCooldown > 0) d.attackCooldown -= dt;

    const toPlayer=pv3.set(pp.x-b.position.x,0,pp.z-b.position.z);
    const dist=toPlayer.length();

    // Hit flash
    if(d.hitFlash>0){
      d.hitFlash-=dt;
      b.children.forEach(c=>{if(c.isMesh&&c!==d.exclaim){
        if(c.material&&c!==d.exclaim&&c.material.color){
          const isHead=c.geometry===banditGeos.head;
          if(!isHead) c.material.color.set(d.hitFlash>0?0xff4444:(isNight?0x5a1a10:0x8b3a2a));
        }
      }});
    }

    // UPGRADE 2: 3-state awareness machine
    // patrol → if player within sight range: enter ALERT
    // alert  → look at player for 1.2s, raise arm, flash HUD once → then CHASE
    // chase  → pursue. if dist > 40: back to patrol
    if (d.state === 'patrol') {
      const currentSightRange = isCrouching ? nightSightRange * 0.4 : nightSightRange;
      if (dist < currentSightRange) {
        const hasLOS = checkLineOfSight(b.position.clone().add(new THREE.Vector3(0, 1.5, 0)), playerBody.position.clone().add(new THREE.Vector3(0, PLAYER_H - 0.2, 0)));
        if (hasLOS) {
          d.state = 'alert';
          d.alertTimer = 0.5; // Faster reaction time (was 1.2)
          d.exclaim && (d.exclaim.visible = true);
          triggerAlertFlash();
          showAlert('⚠ Bandit spotted you!', true);
        }
      }
    } else if (d.state === 'alert') {
      d.alertTimer -= dt;
      // Stand still, face player, raise right arm
      b.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
      if (d.rArm) d.rArm.rotation.x = -Math.PI * 0.6; // raised arm
      // Bob exclamation mark
      if (d.exclaim) d.exclaim.position.y = 2.5 + Math.sin(clock.elapsedTime * 8) * 0.1;
      if (d.alertTimer <= 0) {
        d.state = 'chase';
        d.exclaim && (d.exclaim.visible = false);
        if (d.rArm) d.rArm.rotation.x = 0;
      }
    } else if (d.state === 'chase') {
      if (dist > 40) { d.state='patrol'; }
      
      // Ranged combat logic
      if (d.isRanged) {
        const hasLOS = checkLineOfSight(b.position.clone().add(new THREE.Vector3(0, 1.5, 0)), playerBody.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
        if (hasLOS && dist < 25) {
          // Stop moving and shoot
          b.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
          if (d.attackCooldown <= 0) {
            d.attackCooldown = 1.0 + Math.random();
            // Shoot
            spawnParticle(b.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 0xffaa00); // Muzzle flash
            
            // Tracer
            const tracerGeo = new THREE.BufferGeometry().setFromPoints([
              b.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
              playerBody.position.clone().add(new THREE.Vector3(0, 1.5, 0))
            ]);
            const tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({color: 0xffddaa, transparent: true, opacity: 0.8}));
            scene.add(tracer);
            new TWEEN_anim(tracer.material, {opacity: 0}, 100, () => { scene.remove(tracer); tracer.geometry.dispose(); tracer.material.dispose(); });
            
            if (!rollIframes && respawnGraceTimer <= 0) {
              playerHealth -= d.damage * (isNight ? 1.5 : 1); playerHealth = Math.max(0, playerHealth);
              outOfCombatTimer = 0;
              document.getElementById('damageFlash').style.boxShadow = 'inset 0 0 100px rgba(255,0,0,0.8)';
              setTimeout(() => document.getElementById('damageFlash').style.boxShadow = 'inset 0 0 0 rgba(255,0,0,0)', 200);
              screenShake(0.1);
              if (playerHealth <= 0) triggerDeath();
            }
          }
          continue; // Skip movement and melee checks
        }
      }
    }

    // Movement
    if (d.state==='patrol') {
      d.patrolAngle+=dt*0.4;
      const tx=d.patrolCenter.x+Math.cos(d.patrolAngle)*8, tz=d.patrolCenter.z+Math.sin(d.patrolAngle)*8;
      const dir2d=new THREE.Vector3(tx-b.position.x,0,tz-b.position.z).normalize();
      b.position.x+=dir2d.x*d.speed*0.4*dt; b.position.z+=dir2d.z*d.speed*0.4*dt;
      b.rotation.y=Math.atan2(dir2d.x,dir2d.z);
      resolveWallCollisions(b.position, 0.35, false, 1.8);
    }
    if (d.state !== 'break_block' && d.targetBlock) {
      if (d.targetBlock.material) d.targetBlock.scale.setScalar(1.0);
      d.targetBlock = null;
    }

    if (d.state === 'break_block') {
      if (!d.targetBlock || d.targetBlock.userData.health <= 0 || !blockMeshes.includes(d.targetBlock)) {
        if (d.targetBlock) d.targetBlock.scale.setScalar(1.0);
        d.state = 'chase';
        d.targetBlock = null;
      } else {
        // Face the block
        const dx = d.targetBlock.position.x - b.position.x;
        const dz = d.targetBlock.position.z - b.position.z;
        b.rotation.y = Math.atan2(dx, dz);
        
        // Continuous damage
        const dps = d.isBrute ? 30 : 10;
        d.targetBlock.userData.health -= dps * dt;
        
        // Animation
        const time = clock.elapsedTime;
        d.targetBlock.scale.setScalar(1 + Math.sin(time * 20) * 0.05);
        
        if (Math.random() < 0.1) {
          spawnParticle(d.targetBlock.position, d.targetBlock.userData.type === 'wood' ? 0x8B5A2B : 0x888888);
        }

        if (d.targetBlock.userData.health <= 0) {
          removeBlock(d.targetBlock.position.x, d.targetBlock.position.y, d.targetBlock.position.z);
          d.state = 'chase';
          d.targetBlock = null;
        } else if (dist > 40) {
          d.state = 'patrol';
        }
      }
    } else if (d.state==='chase' && dist>1.5) {
      // Check for blocking blocks
      let blockingBlock = null;
      for (let i = blockMeshes.length - 1; i >= 0; i--) {
        const bMesh = blockMeshes[i];
        const dx = b.position.x - bMesh.position.x;
        const dz = b.position.z - bMesh.position.z;
        const dy = (b.position.y + 0.9) - bMesh.position.y;
        if (Math.abs(dx) < BLOCK_SIZE/2 + 0.8 && Math.abs(dz) < BLOCK_SIZE/2 + 0.8 && Math.abs(dy) < BLOCK_SIZE/2 + 0.9) {
          blockingBlock = bMesh;
          break;
        }
      }
      
      if (blockingBlock) {
        d.state = 'break_block';
        d.targetBlock = blockingBlock;
      } else {
        const dir2d=toPlayer.clone().normalize();
        b.position.x+=dir2d.x*d.speed*nightSpeedMult*dt;
        b.position.z+=dir2d.z*d.speed*nightSpeedMult*dt;
        b.rotation.y=Math.atan2(dir2d.x,dir2d.z);
        
        let didAttack = false;

        // Turret attack
        if (!didAttack && d.attackCooldown <= 0) {
          for (let i = turrets.length - 1; i >= 0; i--) {
            const t = turrets[i];
            const dx = b.position.x - t.position.x;
            const dz = b.position.z - t.position.z;
            if (dx*dx + dz*dz < 2.0) {
              t.userData.health -= nightDmg * (d.isBrute ? 2 : 1);
              d.attackCooldown = d.isBrute ? 2.5 : 1.5;
              spawnParticle(t.position, 0x3a3a3a);
              didAttack = true;
              break;
            }
          }
        }

        // Wall/Door attack (only if turret was not hit this tick)
        if (!didAttack && d.attackCooldown <= 0) {
          for (let i = walls.length - 1; i >= 0; i--) {
            const w = walls[i];
            if (!w.userData || (w.userData.type !== 'wall' && w.userData.type !== 'door' && w.userData.type !== 'stairs' && w.userData.type !== 'roof')) continue;
            if (w.userData.type === 'door' && w.userData.isOpen) continue;
            const dx = b.position.x - w.position.x;
            const dz = b.position.z - w.position.z;
            if (Math.abs(dx) < w.userData.hw + 0.6 && Math.abs(dz) < w.userData.hd + 0.6) {
              w.userData.health -= nightDmg * (d.isBrute ? 3 : 1);
              d.attackCooldown = d.isBrute ? 2.5 : 1.5;
              spawnParticle(w.position, 0x8a6a3a);
              didAttack = true;
              // Feature 2: mark wall critically damaged for red flash
              const maxWH = window.wallMaxHealth || 150;
              w.userData.criticalFlash = (w.userData.health > 0 && w.userData.health / maxWH < 0.3);
              if (w.userData.health <= 0) {
                w.userData.criticalFlash = false;
                scene.remove(w); disposeObject(w); walls.splice(i, 1);
              }
              break;
            }
          }
        }

        // Bandit separation
        for (const other of bandits) {
          if (other === b || other.userData.health <= 0) continue;
          const sepX = b.position.x - other.position.x;
          const sepZ = b.position.z - other.position.z;
          const sepDistSq = sepX*sepX + sepZ*sepZ;
          if (sepDistSq < 1.0 && sepDistSq > 0.001) {
            const sepDist = Math.sqrt(sepDistSq);
            b.position.x += (sepX / sepDist) * 2.0 * dt;
            b.position.z += (sepZ / sepDist) * 2.0 * dt;
          }
        }
        resolveWallCollisions(b.position, 0.35, false, 1.8);
        
        // Trap collision
        for (let i = traps.length - 1; i >= 0; i--) {
          const trap = traps[i];
          if (!trap.userData.active) continue;
          const dx = b.position.x - trap.position.x;
          const dz = b.position.z - trap.position.z;
          if (dx*dx + dz*dz < 1.5) {
            damageBandit(b, 30);
            trap.userData.health -= 25;
            spawnParticle(trap.position, 0xcc4444);
            if (trap.userData.health <= 0) {
              trap.userData.active = false;
              scene.remove(trap); disposeObject(trap); traps.splice(i, 1);
            }
          }
        }
      }
    }

    // Player melee attack
    if (dist<2.0) {
      if(d.attackCooldown<=0){
        d.attackCooldown=d.isBrute ? 2.5 : 1.5 + Math.random() * 0.8;
        if (!rollIframes && respawnGraceTimer <= 0) {
          playerHealth-=nightDmg * (d.isBrute ? 1.5 : 1); playerHealth=Math.max(0,playerHealth);
          outOfCombatTimer = 0;
          updateHUD(dt); screenShake(0.15);
          document.getElementById('damageFlash').style.boxShadow = 'inset 0 0 150px rgba(255,0,0,0.8)';
          setTimeout(() => { 
            const hpRatio = playerHealth / playerMaxHealth;
            const targetAlpha = hpRatio < 0.3 ? 0.6 - hpRatio * 2 : 0;
            document.getElementById('damageFlash').style.boxShadow = `inset 0 0 150px rgba(255,0,0,${targetAlpha})`;
          }, 200);
          if(playerHealth<=0)triggerDeath();
        } else {
          showAlert('Rolled through the attack!', false);
        }
      }
    }

    // Walk animation (skip during alert stand-still)
    if (d.state !== 'alert') {
      d.walkCycle+=dt*5;
      if(d.lArm)d.lArm.rotation.x=Math.sin(d.walkCycle)*0.5;
      if(d.rArm)d.rArm.rotation.x=-Math.sin(d.walkCycle)*0.5;
      if(d.lLeg)d.lLeg.rotation.x=-Math.sin(d.walkCycle)*0.5;
      if(d.rLeg)d.rLeg.rotation.x=Math.sin(d.walkCycle)*0.5;
    }

    // Ground
    b.position.y=getTerrainHeight(b.position.x,b.position.z);
  }
}

// ─── RESOURCE DROPS ───────────────────────────────────────────────────────────
const drops = [];
const dropGeoWood = new THREE.BoxGeometry(0.2, 0.2, 0.6); dropGeoWood.userData = { shared: true };
const dropGeoStone = new THREE.DodecahedronGeometry(0.2, 0); dropGeoStone.userData = { shared: true };
const dropGeoMeat = new THREE.BoxGeometry(0.3, 0.15, 0.3); dropGeoMeat.userData = { shared: true };
const dropGeoAmmo = new THREE.BoxGeometry(0.15, 0.15, 0.3); dropGeoAmmo.userData = { shared: true };
const dropGeoScrap = new THREE.BoxGeometry(0.2, 0.2, 0.2); dropGeoScrap.userData = { shared: true };
const MATS_MEAT = new THREE.MeshLambertMaterial({ color: 0xcc4444 }); MATS_MEAT.userData = { shared: true };
const MATS_AMMO = new THREE.MeshLambertMaterial({ color: 0xaaaaaa }); MATS_AMMO.userData = { shared: true };
const MATS_SCRAP = new THREE.MeshLambertMaterial({ color: 0x666666 }); MATS_SCRAP.userData = { shared: true };

function spawnDrop(type, pos, amount) {
  let geo, mat;
  if (type === 'wood') { geo = dropGeoWood; mat = MATS.wWood; }
  else if (type === 'stone') { geo = dropGeoStone; mat = MATS.rock; }
  else if (type === 'rawMeat') { geo = dropGeoMeat; mat = MATS_MEAT; }
  else if (type === 'ammo2') { geo = dropGeoAmmo; mat = MATS_AMMO; }
  else if (type === 'ammo3') { geo = dropGeoAmmo; mat = MATS_AMMO; }
  else if (type === 'scrap') { geo = dropGeoScrap; mat = MATS_SCRAP; }
  
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  mesh.position.y += 1.5;
  mesh.velocity = new THREE.Vector3((Math.random()-0.5)*5, Math.random()*4+3, (Math.random()-0.5)*5);
  mesh.userData = { type, amount, life: 30 };
  mesh.castShadow = true;
  scene.add(mesh);
  drops.push(mesh);
}
function updateDrops(dt) {
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.userData.life -= dt;
    if (d.userData.life <= 0) { scene.remove(d); disposeObject(d); drops.splice(i, 1); continue; }
    
    const distSq = d.position.distanceToSquared(playerBody.position);
    if (distSq < 25.0) {
      const dir = new THREE.Vector3().subVectors(playerBody.position, d.position).normalize();
      d.velocity.addScaledVector(dir, 30 * dt);
    } else {
      d.velocity.y -= 18 * dt;
    }

    d.position.addScaledVector(d.velocity, dt);
    const terrH = getTerrainHeight(d.position.x, d.position.z);
    
    if (d.position.y < terrH + 0.1 && distSq >= 25.0) {
      d.position.y = terrH + 0.1;
      d.velocity.set(0, 0, 0);
    } else {
      d.rotation.x += dt * 3; d.rotation.y += dt * 3;
    }
    
    if (distSq < 3.5) {
      if (d.userData.type === 'wood') wood += d.userData.amount;
      if (d.userData.type === 'stone') stone += d.userData.amount;
      if (d.userData.type === 'rawMeat') rawMeat += d.userData.amount;
      if (d.userData.type === 'ammo2') weapons[2].reserveAmmo += d.userData.amount;
      if (d.userData.type === 'ammo3') weapons[3].reserveAmmo += d.userData.amount;
      if (d.userData.type === 'scrap') scrap += d.userData.amount;
      let name = d.userData.type;
      if (name === 'wood') name = 'Wood';
      if (name === 'stone') name = 'Stone';
      if (name === 'rawMeat') name = 'Raw Meat';
      if (name === 'ammo2') name = 'Revolver Ammo';
      if (name === 'ammo3') name = 'Rifle Ammo';
      if (name === 'scrap') name = 'Scrap';
      showAlert(`+${d.userData.amount} ${name}`, false);
      updateResources();
      updateHUD(0.016);
      scene.remove(d); disposeObject(d); drops.splice(i, 1);
    }
  }
}

// ─── PARTICLES ────────────────────────────────────────────────────────────────
const particlePool=[];
const partGeo=new THREE.SphereGeometry(0.05,4,4); partGeo.userData = { shared: true };
function spawnParticle(pos,color){
  for(let i=0;i<5;i++){
    let p=particlePool.find(x=>!x.active);
    if(!p){const mesh=new THREE.Mesh(partGeo,new THREE.MeshLambertMaterial({color, transparent: true}));mesh.active=false;mesh.life=0;scene.add(mesh);p=mesh;particlePool.push(p);}
    p.material.color.setHex(color);p.position.copy(pos).addScalar(0.2*(Math.random()-0.5));p.active=true;p.life=0.6;
    p.velocity=new THREE.Vector3((Math.random()-0.5)*4,Math.random()*4+1,(Math.random()-0.5)*4);
  }
}
function updateParticles(dt){
  for(const p of particlePool){if(!p.active)continue;p.life-=dt;if(p.life<=0){p.active=false;p.position.set(0,-100,0);continue;}p.velocity.y-=9.8*dt;p.position.addScaledVector(p.velocity,dt);p.material.opacity=p.life/0.6;}
  
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      disposeObject(p.mesh);
      particles.splice(i, 1);
    } else {
      p.vel.y -= 9.8 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 2;
      p.mesh.rotation.y += dt * 2;
      
      // Fade out
      if (p.mesh.material && !p.mesh.material.userData.shared) {
        p.mesh.material.transparent = true;
        p.mesh.material.opacity = p.life / p.maxLife;
      }
    }
  }
}

const floaters = [];
const harvestProgressByTarget = new WeakMap();
function triggerHitMarker(isKill) {
  const hm = document.getElementById('hitMarker');
  hm.style.opacity = '1';
  hm.style.transform = `translate(-50%,-50%) rotate(45deg) scale(${isKill ? 1.5 : 1})`;
  const lines = hm.querySelectorAll('.hm-line');
  lines.forEach(l => l.style.background = isKill ? '#ff3333' : '#ffffff');
  hitMarkerTimer = 0.15;
}

function spawnFloatingText(pos, text, color) {
  const el = document.createElement('div');
  el.className = 'float-text';
  el.textContent = text;
  el.style.color = color;
  document.body.appendChild(el);
  floaters.push({ el, pos: pos.clone(), life: 1.0, maxLife: 1.0, isProgress: false });
}

function showHarvestProgress(target) {
  const percent = Math.max(0, Math.min(100, 100 - (target.userData.health / target.userData.maxHealth) * 100));
  const existing = harvestProgressByTarget.get(target);
  if (existing && existing.el && existing.el.isConnected) {
    existing.life = 1.5;
    existing.fill.style.width = `${percent}%`;
    existing.fill.style.backgroundColor = percent > 65 ? '#ff6633' : percent > 35 ? '#ffcc33' : '#55ff66';
    existing.pos.copy(target.position).add(new THREE.Vector3(0, 1.5, 0));
    return;
  }

  const el = document.createElement('div');
  el.className = 'harvest-progress';
  el.style.width = '60px';
  el.style.height = '8px';
  el.style.backgroundColor = 'rgba(0,0,0,0.5)';
  el.style.border = '1px solid #fff';
  el.style.borderRadius = '4px';
  el.style.position = 'absolute';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '100';
  
  const fill = document.createElement('div');
  fill.style.width = `${percent}%`;
  fill.style.height = '100%';
  fill.style.backgroundColor = percent > 65 ? '#ff6633' : percent > 35 ? '#ffcc33' : '#55ff66';
  fill.style.borderRadius = '3px';
  el.appendChild(fill);
  
  document.body.appendChild(el);
  const floater = { el, fill, targetRef: target, pos: target.position.clone().add(new THREE.Vector3(0, 1.5, 0)), life: 1.5, maxLife: 1.5, isProgress: true };
  floaters.push(floater);
  harvestProgressByTarget.set(target, floater);
}

function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.life -= dt;
    if (f.life <= 0) {
      if (f.isProgress && f.targetRef) harvestProgressByTarget.delete(f.targetRef);
      f.el.remove();
      floaters.splice(i, 1);
      continue;
    }
    if (!f.isProgress) {
      f.pos.y += dt * 1.5;
    } else if (f.targetRef && f.targetRef.parent) {
      f.pos.copy(f.targetRef.position).add(new THREE.Vector3(0, 1.5, 0));
    } else {
      if (f.targetRef) harvestProgressByTarget.delete(f.targetRef);
      f.el.remove();
      floaters.splice(i, 1);
      continue;
    }
    const screenPos = f.pos.clone().project(camera);
    if (screenPos.z > 1) { f.el.style.display = 'none'; }
    else {
      f.el.style.display = 'block';
      f.el.style.left = ((screenPos.x * 0.5 + 0.5) * window.innerWidth) + 'px';
      f.el.style.top = (-(screenPos.y * 0.5 - 0.5) * window.innerHeight) + 'px';
      f.el.style.opacity = f.life / (f.maxLife || 1.0);
    }
  }
}

// ─── CAMPFIRE ANIMATION ───────────────────────────────────────────────────────
function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.position.addScaledVector(p.userData.velocity, dt);
    p.userData.life -= dt;
    
    let hit = false;
    if (p.position.distanceToSquared(playerBody.position) < 2.0) {
      if (respawnGraceTimer <= 0) {
        playerHealth -= p.userData.damage;
        showAlert(`Hit by projectile! -${p.userData.damage} HP`, true);
        screenShake(0.2);
        updateHUD(dt);
        if (playerHealth <= 0) triggerDeath();
      }
      hit = true;
    } else if (p.position.y < getTerrainHeight(p.position.x, p.position.z)) {
      hit = true;
    } else {
      for (const w of walls) {
        if (p.position.distanceToSquared(w.position) < 4.0) {
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (const b of blockMeshes) {
          if (p.position.distanceToSquared(b.position) < 4.0) {
            hit = true;
            break;
          }
        }
      }
    }
    
    if (hit || p.userData.life <= 0) {
      scene.remove(p);
      disposeObject(p);
      projectiles.splice(i, 1);
    }
  }
}

function updatePlanters(dt) {
  for (const p of planters) {
    if (p.userData.health <= 0) continue;
    if (!p.userData.ready) {
      p.userData.growth += dt * 1.5; // ~66 seconds to grow
      if (p.userData.growth >= 100) {
        p.userData.ready = true;
        const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4), MATS.bush);
        bush.position.y = 0.6;
        bush.name = 'berryBush';
        p.add(bush);
      }
    }
  }
}

function updateCampfires(dt){
  const t=clock.elapsedTime;
  for(const cf of campfires){
    if (!cf.userData.isLit) continue;
    
    cf.userData.fuel -= dt;
    if (cf.userData.fuel <= 0) {
      cf.userData.isLit = false;
      cf.userData.light.intensity = 0;
      const flame = cf.getObjectByName('flame');
      if (flame) flame.visible = false;
      continue;
    }
    
    const flame=cf.getObjectByName('flame');
    if(flame){flame.scale.y=0.8+Math.sin(t*6+cf.position.x)*0.3;flame.scale.x=0.8+Math.cos(t*7)*0.2;flame.position.y=0.3+Math.sin(t*5)*0.04;}
    if(cf.userData.light){
      // UPGRADE 3: Campfires are more important at night — brighter
      const baseIntensity = isNight ? 4.5 : 2.5;
      cf.userData.light.intensity=baseIntensity+Math.sin(t*8)*0.6+Math.cos(t*5)*0.4;
      cf.userData.light.distance  = isNight ? 14 : 8;
    }
    
    // Campfire Healing Radius
    const distSq = (cf.position.x - playerBody.position.x)**2 + (cf.position.z - playerBody.position.z)**2;
    if (distSq < 16 && playerHealth < playerMaxHealth) {
      playerHealth = Math.min(playerMaxHealth, playerHealth + dt * 3);
      if (Math.random() < 0.05) spawnFloatingText(playerBody.position.clone().add(new THREE.Vector3((Math.random()-0.5)*2, 1.5, (Math.random()-0.5)*2)), '+', '#44ff44');
      updateHUD(dt);
    }
  }
}

// ─── SCREEN SHAKE ─────────────────────────────────────────────────────────────
let shakeAmt=0;
function screenShake(amount){shakeAmt=Math.max(shakeAmt,amount);}
function applyShake(){
  if(shakeAmt>0){camera.position.x+=(Math.random()-0.5)*shakeAmt;camera.position.y+=headBobAmt+(Math.random()-0.5)*shakeAmt;shakeAmt*=0.7;if(shakeAmt<0.001)shakeAmt=0;}
}

// ─── FEATURE 2: CRITICAL WALL FLASH ──────────────────────────────────────────
function updateWalls(dt) {
  const t = clock.elapsedTime;
  const maxWH = window.wallMaxHealth || 150;
  for (const w of walls) {
    if (!w.userData || (w.userData.type !== 'wall' && w.userData.type !== 'door' && w.userData.type !== 'stairs' && w.userData.type !== 'roof')) continue;
    const isCritical = w.userData.criticalFlash;
    // Pulse: oscillate between red and dark using sine wave at 4 Hz
    const pulse = isCritical ? Math.max(0, Math.sin(t * 25)) * 0.6 : 0;
    w.traverse(child => {
      if (child.isMesh && child.material && !child.material.userData.shared) {
        if (!child.material.emissive) return; // MeshLambertMaterial has emissive
        child.material.emissive.setRGB(pulse, 0, 0);
      }
    });
  }
}


// ─── BUILDING ─────────────────────────────────────────────────────────────────
function eatFood() {
  if (cookedMeat > 0) {
    if (playerHunger >= playerMaxHunger && playerHealth >= playerMaxHealth) { showAlert('Already full!', false); return; }
    cookedMeat--;
    playerHunger = Math.min(playerMaxHunger, playerHunger + 50);
    playerHealth = Math.min(playerMaxHealth, playerHealth + 40);
    updateHUD(0.016); updateResources();
    showAlert('Ate Cooked Meat! +50 Hunger, +40 Health.', false);
  } else if (berries > 0) {
    if (playerHunger >= playerMaxHunger && playerHealth >= playerMaxHealth) { showAlert('Already full!', false); return; }
    berries--;
    playerHunger = Math.min(playerMaxHunger, playerHunger + 20);
    playerHealth = Math.min(playerMaxHealth, playerHealth + 10);
    updateHUD(0.016); updateResources();
    showAlert('Ate a berry. +20 Hunger, +10 Health.', false);
  } else {
    showAlert('No food in inventory!', true);
  }
}

function tryPlaceTrap() {
  const wCost = Math.max(1, Math.floor(5 * buildCostMult));
  const sCost = Math.max(1, Math.floor(5 * buildCostMult));
  if (wood < wCost || stone < sCost) { showAlert(`Need ${wCost} Wood and ${sCost} Stone for a trap!`, true); return; }
  wood -= wCost; stone -= sCost; updateResources();
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  createTrap(playerBody.position.x + fwd.x * 2.5, playerBody.position.z + fwd.z * 2.5);
  showAlert('Spike Trap placed!', false);
}


function tryPlaceWorkbench() {
  const wCost = Math.max(1, Math.floor(15 * buildCostMult));
  const sCost = Math.max(1, Math.floor(10 * buildCostMult));
  if (wood < wCost || stone < sCost) { showAlert(`Need ${wCost} Wood, ${sCost} Stone for Workbench!`, true); return; }
  wood -= wCost; stone -= sCost; updateResources();
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  createWorkbench(playerBody.position.x + fwd.x * 2.5, playerBody.position.z + fwd.z * 2.5);
  showAlert('Workbench placed!', false);
}

function createWorkbench(x, z) {
  const h = getTerrainHeight(x, z);
  const group = new THREE.Group();
  group.position.set(x, h, z);
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 1.0), MATS.wWoodDk);
  table.position.y = 0.4; table.castShadow = true; group.add(table);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 1.1), MATS.wWood);
  top.position.y = 0.85; top.castShadow = true; group.add(top);
  group.userData = { type: 'workbench', health: 100 };
  scene.add(group); workbenches.push(group);
}

window.upgradeWeapon = function(idx, wCost, sCost, scCost = 0) {
  if (wood < wCost || stone < sCost || scrap < scCost) { showAlert('Not enough resources!', true); return; }
  if (weapons[idx].level >= 3) { showAlert('Max level reached!', true); return; }
  wood -= wCost; stone -= sCost; scrap -= scCost; updateResources();
  weapons[idx].level = (weapons[idx].level || 1) + 1;
  weapons[idx].damage = Math.floor(weapons[idx].damage * 1.5);
  weapons[idx].name = weapons[idx].name.replace(/ Lv\d+$/, '') + ' Lv' + weapons[idx].level;
  if (weapons[idx].maxAmmo) {
    weapons[idx].maxAmmo += (idx === 2 ? 2 : 1);
    weapons[idx].ammo = weapons[idx].maxAmmo;
  }
  showAlert(weapons[idx].name + ' Upgraded to Lv' + weapons[idx].level + '!', false);
  updateHUD(0);
  updateWorkbenchUI();
};

window.upgradeDefense = function() {
  if (wood < 30 || stone < 20) { showAlert('Not enough resources!', true); return; }
  if (window.wallMaxHealth >= 350) { showAlert('Defense maxed out!', true); return; }
  wood -= 30; stone -= 20; updateResources();
  window.wallMaxHealth = (window.wallMaxHealth || 150) + 100;
  for (const w of walls) {
    if (w.userData && (w.userData.type === 'wall' || w.userData.type === 'door')) {
      w.userData.health += 100;
    }
  }
  showAlert('Defenses Reinforced! +100 HP', false);
  updateWorkbenchUI();
};

window.upgradeLantern = function() {
  if (wood < 10 || stone < 10) { showAlert('Not enough resources!', true); return; }
  if (window.lanternUpgraded) { showAlert('Lantern already upgraded!', true); return; }
  wood -= 10; stone -= 10; updateResources();
  window.lanternUpgraded = true;
  playerLantern.distance = 25;
  if (lanternActive) playerLantern.intensity = 3.0;
  showAlert('Lantern Upgraded!', false);
  updateWorkbenchUI();
};

window.upgradeStamina = function() {
  if (berries < 20) { showAlert('Need 20 Berries!', true); return; }
  if (playerMaxStamina >= 200) { showAlert('Stamina maxed out!', true); return; }
  berries -= 20; updateResources();
  playerMaxStamina += 50;
  playerStamina = playerMaxStamina;
  updateHUD(0);
  showAlert('Max Stamina +50!', false);
  updateWorkbenchUI();
};

function updateWorkbenchUI() {
  document.getElementById('wbWood').textContent = wood;
  document.getElementById('wbStone').textContent = stone;
  document.getElementById('wbBerries').textContent = berries;
  document.getElementById('wbScrap').textContent = scrap;
}

window.craftAmmo = function(weaponIndex, costW, costS, costScrap, amount) {
  if (wood < costW || stone < costS || scrap < costScrap) {
    showAlert('Not enough resources!', true);
    return;
  }
  wood -= costW; stone -= costS; scrap -= costScrap;
  weapons[weaponIndex].reserveAmmo += amount;
  updateResources();
  updateWorkbenchUI();
  updateHUD();
  showAlert(`Crafted ${amount} ${weapons[weaponIndex].name} Ammo!`, false);
};

window.closeWorkbench = function() {
  isWorkbenchOpen = false;
  document.getElementById('workbenchUI').style.display = 'none';
  document.body.classList.remove('ui-active');
  document.getElementById('customCursor').style.display = 'none';
  if (!isSkillMenuOpen && gameStarted && document.getElementById('deathScreen').style.display !== 'flex') {
    renderer.domElement.requestPointerLock();
  }
};

window.closeSkillMenu = function() {
  isSkillMenuOpen = false;
  document.getElementById('skillMenu').style.display = 'none';
  document.body.classList.remove('ui-active');
  document.getElementById('customCursor').style.display = 'none';
  if (!isWorkbenchOpen && !isChestOpen && gameStarted && document.getElementById('deathScreen').style.display !== 'flex') {
    renderer.domElement.requestPointerLock();
  }
};

window.updateChestUI = function() {
  if (!currentChest) return;
  document.getElementById('invWood').textContent = wood;
  document.getElementById('invStone').textContent = stone;
  document.getElementById('invScrap').textContent = scrap;
  document.getElementById('invBerries').textContent = berries;
  document.getElementById('invRawMeat').textContent = rawMeat;
  document.getElementById('invCookedMeat').textContent = cookedMeat;

  document.getElementById('chestWood').textContent = currentChest.userData.inventory.wood;
  document.getElementById('chestStone').textContent = currentChest.userData.inventory.stone;
  document.getElementById('chestScrap').textContent = currentChest.userData.inventory.scrap;
  document.getElementById('chestBerries').textContent = currentChest.userData.inventory.berries;
  document.getElementById('chestRawMeat').textContent = currentChest.userData.inventory.rawMeat;
  document.getElementById('chestCookedMeat').textContent = currentChest.userData.inventory.cookedMeat;
};

window.chestTransfer = function(item, amount, take) {
  if (!currentChest) return;
  if (take) {
    const available = currentChest.userData.inventory[item];
    const toTransfer = amount === 999 ? available : Math.min(amount, available);
    if (toTransfer > 0) {
      currentChest.userData.inventory[item] -= toTransfer;
      if (item === 'wood') wood += toTransfer;
      else if (item === 'stone') stone += toTransfer;
      else if (item === 'scrap') scrap += toTransfer;
      else if (item === 'berries') berries += toTransfer;
      else if (item === 'rawMeat') rawMeat += toTransfer;
      else if (item === 'cookedMeat') cookedMeat += toTransfer;
    }
  } else {
    let playerHas = 0;
    if (item === 'wood') playerHas = wood;
    else if (item === 'stone') playerHas = stone;
    else if (item === 'scrap') playerHas = scrap;
    else if (item === 'berries') playerHas = berries;
    else if (item === 'rawMeat') playerHas = rawMeat;
    else if (item === 'cookedMeat') playerHas = cookedMeat;

    const toTransfer = amount === 999 ? playerHas : Math.min(amount, playerHas);
    if (toTransfer > 0) {
      if (item === 'wood') wood -= toTransfer;
      else if (item === 'stone') stone -= toTransfer;
      else if (item === 'scrap') scrap -= toTransfer;
      else if (item === 'berries') berries -= toTransfer;
      else if (item === 'rawMeat') rawMeat -= toTransfer;
      else if (item === 'cookedMeat') cookedMeat -= toTransfer;
      currentChest.userData.inventory[item] += toTransfer;
    }
  }
  updateResources();
  updateChestUI();
};


function closeChest() {
  isChestOpen = false;
  currentChest = null;

  document.getElementById('chestUI').style.display = 'none';
  document.body.classList.remove('ui-active');
  document.getElementById('customCursor').style.display = 'none';

  if (!isWorkbenchOpen && !isSkillMenuOpen && gameStarted && document.getElementById('deathScreen').style.display !== 'flex') {
    renderer.domElement.requestPointerLock();
  }
}

window.closeChest = closeChest;

function tryPlacePlanter() {
  const costW = Math.max(1, Math.floor(10 * buildCostMult));
  const costS = Math.max(1, Math.floor(5 * buildCostMult));
  if(wood<costW || stone<costS){showAlert(`Need ${costW} Wood, ${costS} Stone for Planter!`,true);return;}
  wood-=costW; stone-=costS; updateResources();
  const fwd=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  createPlanter(playerBody.position.x+fwd.x*2.5, playerBody.position.z+fwd.z*2.5);
  showAlert('Planter Box placed! Berries will grow over time.',false);
}

function tryPlaceChest() {
  const cost = Math.max(1, Math.floor(20 * buildCostMult));
  if(wood<cost){showAlert(`Need ${cost} Wood for Storage Chest!`,true);return;}
  wood-=cost; updateResources();
  const fwd=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  createChest(playerBody.position.x+fwd.x*2.5, playerBody.position.z+fwd.z*2.5);
  showAlert('Storage Chest placed!',false);
}

let lastPlaceTime = 0;
const PLACE_DELAY = 200; // ms

function tryPlaceCampfire() {
  const now = performance.now();
  if (now - lastPlaceTime < PLACE_DELAY) return;
  
  const cost = Math.max(1, Math.floor(2 * buildCostMult));
  if(wood<cost){showAlert(`Need ${cost} Wood for campfire!`,true);return;}
  
  lastPlaceTime = now;
  wood-=cost;updateResources();
  const fwd=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  createCampfire(playerBody.position.x+fwd.x*2.5, playerBody.position.z+fwd.z*2.5);
  showAlert('Campfire lit! Brighter at night.',false);
}

// ─── MINIMAP ──────────────────────────────────────────────────────────────────
function updateMinimap() {
  minimapController.render({
    isNight,
    yaw,
    playerX: playerBody.position.x,
    playerZ: playerBody.position.z,
    trees,
    bushes,
    rocks,
    walls,
    bandits,
  });
}

// ─── HUD UPDATE ───────────────────────────────────────────────────────────────
let currentSpread = 20;

function updateHUD(dt = 0.016){
  if (crosshairBloom > 0) crosshairBloom = Math.max(0, crosshairBloom - dt * 120);
  if (lastHUD.health !== playerHealth || lastHUD.temp !== playerTemp) { 
    document.getElementById('healthFill').style.width=(playerHealth/playerMaxHealth*100)+'%'; 
    lastHUD.health = playerHealth; 
    
    // Low health vignette
    const hpRatio = playerHealth / playerMaxHealth;
    const targetAlpha = hpRatio < 0.3 ? 0.6 - hpRatio * 2 : 0;
    
    if (playerTemp <= 0) {
      document.getElementById('damageFlash').style.boxShadow = `inset 0 0 150px rgba(0,100,255,0.6)`;
    } else if (playerTemp < 30) {
      const frostAlpha = (30 - playerTemp) / 30 * 0.4;
      document.getElementById('damageFlash').style.boxShadow = `inset 0 0 150px rgba(100,200,255,${frostAlpha})`;
    } else {
      document.getElementById('damageFlash').style.boxShadow = `inset 0 0 150px rgba(255,0,0,${targetAlpha})`;
    }
  }
  if (lastHUD.stamina !== playerStamina) { 
    const fill = document.getElementById('staminaFill');
    fill.style.width=(playerStamina/playerMaxStamina*100)+'%'; 
    if (isExhausted) {
      fill.style.background = 'linear-gradient(90deg, #ff4444, #ff0000)';
      fill.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.5)';
    } else {
      fill.style.background = 'linear-gradient(90deg, #11998e, #38ef7d)';
      fill.style.boxShadow = '0 0 10px rgba(56, 239, 125, 0.5)';
    }
    lastHUD.stamina = playerStamina; 
  }
  if (lastHUD.hunger !== playerHunger) { document.getElementById('hungerFill').style.width=(playerHunger/playerMaxHunger*100)+'%'; lastHUD.hunger = playerHunger; }
  if (lastHUD.temp !== playerTemp) { document.getElementById('tempFill').style.width=(playerTemp/playerMaxTemp*100)+'%'; lastHUD.temp = playerTemp; }
  const w=weapons[activeWeapon];
  if (lastHUD.weapon !== w.name) { document.getElementById('weaponName').textContent=w.name; lastHUD.weapon = w.name; }
  const ammoStr = w.type==='gun'?`${w.ammo} / ${w.maxAmmo} (${w.reserveAmmo})`:'';
  if (lastHUD.ammo !== ammoStr) { document.getElementById('ammoCount').textContent=ammoStr; lastHUD.ammo = ammoStr; }
  const dirs=['N','NE','E','SE','S','SW','W','NW','N'];
  const deg=((yaw*180/Math.PI)%360+360)%360;
  const compStr = dirs[Math.round(deg/45)%8];
  if (lastHUD.compass !== compStr) { document.getElementById('compass').textContent=compStr; lastHUD.compass = compStr; }
  
  let targetSpread = 20;
  if (isSprinting) targetSpread = 36;
  else if (keys['KeyW']||keys['KeyS']||keys['KeyA']||keys['KeyD']) targetSpread = 28;
  
  currentSpread += (targetSpread - currentSpread) * 15 * dt;
  const spread = currentSpread + crosshairBloom;
  
  const ch = document.getElementById('crosshair');
  ch.style.width = spread + 'px'; ch.style.height = spread + 'px';

  if (lastHUD.activeWeapon !== activeWeapon) {
    for(let i=0;i<4;i++)document.getElementById('slot'+(i+1)).classList.toggle('active',i===activeWeapon);
    lastHUD.activeWeapon = activeWeapon;
  }
  
  for(let i=2; i<=3; i++) {
    const w = weapons[i];
    const slot = document.getElementById('slot'+(i+1));
    let ammoSpan = slot.querySelector('.slot-ammo');
    if (!ammoSpan) {
      ammoSpan = document.createElement('span');
      ammoSpan.className = 'slot-ammo';
      slot.appendChild(ammoSpan);
      slot.style.position = 'relative';
    }
    ammoSpan.textContent = `${w.ammo}|${w.reserveAmmo}`;
  }
}

function updateResources(){
  if (lastHUD.wood !== wood) { document.getElementById('woodCount').textContent=wood; lastHUD.wood = wood; }
  if (lastHUD.stone !== stone) { document.getElementById('stoneCount').textContent=stone; lastHUD.stone = stone; }
  if (lastHUD.berries !== berries) { document.getElementById('resBerries').textContent=berries; lastHUD.berries = berries; }
  if (lastHUD.rawMeat !== rawMeat) { document.getElementById('resRawMeat').textContent=rawMeat; lastHUD.rawMeat = rawMeat; }
  if (lastHUD.cookedMeat !== cookedMeat) { document.getElementById('resCookedMeat').textContent=cookedMeat; lastHUD.cookedMeat = cookedMeat; }
  if (lastHUD.scrap !== scrap) { document.getElementById('scrapCount').textContent=scrap; lastHUD.scrap = scrap; }
}

let isSwitchingWeapon = false;
const weaponSwitch = { offset: 0 };

function selectWeapon(idx){
  if (idx < 0 || idx >= weapons.length) return;
  if (activeWeapon === idx || isSwitchingWeapon) return;
  if (recoilTimer > 0) {
    pitch += currentRecoilPitch;
    currentRecoilPitch = 0;
    recoilTimer = 0;
  }
  previousWeapon = activeWeapon;
  isSwitchingWeapon = true;
  new TWEEN_anim(weaponSwitch, {offset: -1.0}, 150, () => {
    activeWeapon = idx;
    selectWeaponModel(idx);
    updateHUD(0.016);
    new TWEEN_anim(weaponSwitch, {offset: 0}, 150, () => {
      isSwitchingWeapon = false;
    });
  });
}

function showAlert(msg, isRed) {
  notificationCenter.showAlert(msg, isRed);
}

function addKillFeed() {
  notificationCenter.addKillFeed(kills);
}

function clearTransientRuntime() {
  for (const p of particles) {
    if (p.mesh) {
      scene.remove(p.mesh);
      disposeObject(p.mesh);
    }
  }
  particles.length = 0;

  for (const p of particlePool) {
    scene.remove(p);
    disposeObject(p);
  }
  particlePool.length = 0;

  for (const f of floaters) {
    if (f.el && f.el.remove) f.el.remove();
  }
  floaters.length = 0;

  activeTweens.length = 0;
  interactTarget = null;
  currentChest = null;
  hitMarkerTimer = 0;
  document.getElementById('hitMarker').style.opacity = '0';

  notificationCenter.clear();
}

// ─── DEATH ────────────────────────────────────────────────────────────────────
function triggerDeath(){
  gameActive=false;
  respawnGraceTimer = 0;
  if (isWorkbenchOpen) {
    isWorkbenchOpen = false;
    document.getElementById('workbenchUI').style.display = 'none';
  }
  if (isChestOpen) {
    isChestOpen = false;
    document.getElementById('chestUI').style.display = 'none';
  }
  if (isSkillMenuOpen) {
    isSkillMenuOpen = false;
    document.getElementById('skillMenu').style.display = 'none';
  }
  document.body.classList.remove('ui-active');
  document.getElementById('customCursor').style.display = 'none';
  deathMarker = { x: playerBody.position.x, z: playerBody.position.z };
  createCorpseStash(playerBody.position.x, playerBody.position.z, wood, stone, berries, rawMeat, cookedMeat, scrap);
  document.getElementById('deathScreen').style.display='flex';
  document.exitPointerLock();
}

function respawn(){
  clearTransientRuntime();
  playerHealth=playerMaxHealth; playerStamina=playerMaxStamina;
  playerHunger=playerMaxHunger; playerTemp=playerMaxTemp;
  playerBody.position.set(0,2,0); playerVel.set(0,0,0);
  wood = 0; stone = 0; berries = 0; rawMeat = 0; cookedMeat = 0;
  weapons[2].ammo=weapons[2].maxAmmo; weapons[3].ammo=weapons[3].maxAmmo;
  weapons[2].reserveAmmo=24; weapons[3].reserveAmmo=15;
  isRolling=false; rollCooldown=0; rollIframes=false;
  respawnGraceTimer = RESPAWN_GRACE_DURATION;
  
  worldTime = 0;
  isNight = false;
  for (let i = bandits.length - 1; i >= 0; i--) {
    const b = bandits[i];
    if (b.position.distanceToSquared(playerBody.position) < 900) {
      scene.remove(b); disposeObject(b); bandits.splice(i, 1);
    }
  }
  
  document.getElementById('deathScreen').style.display='none';
  document.getElementById('overlay').style.display='none';
  renderer.domElement.requestPointerLock();
  showAlert(`Respawn protection: ${RESPAWN_GRACE_DURATION.toFixed(0)}s`, false);
  updateHUD(0.016);
}

// ─── WAVE SPAWNER ─────────────────────────────────────────────────────────────
let waveTimer=90, waveTimerMax=90, waveNumber=0;
function updateWaves(dt){
  waveTimer-=dt;
  
  const waveBar = document.getElementById('waveBar');
  if(waveBar) waveBar.style.width = Math.max(0, (waveTimer / waveTimerMax) * 100) + '%';
  const waveTitle = document.getElementById('waveTitle');
  if(waveTitle) waveTitle.textContent = waveTimer <= 5 ? 'INCOMING!' : `Wave ${waveNumber+1}`;

  if(waveTimer<=0){
    waveNumber++;
    waveTimerMax = Math.max(30, 80+waveNumber*10 - daysSurvived*15);
    waveTimer = waveTimerMax;
    const nightMult = isNight ? 2 : 1;
    const count = (3 + waveNumber + daysSurvived) * nightMult;
    const aliveCount = bandits.filter(b=>b.userData.health>0).length;
    const hardCap = (MAX_BANDITS_BASE + daysSurvived * 3) * nightMult;
    const spawnCount = Math.max(0, Math.min(count, hardCap - aliveCount));
    for(let i=0;i<spawnCount;i++){
      const spawn = findBanditSpawnNearPlayer(36, 60, 24);
      if (!spawn) continue;
      createBandit(spawn.x, spawn.z, true);
    }
    if (spawnCount > 0) showAlert(`⚠ Bandit raid! Wave ${waveNumber}${isNight?' (NIGHT RAID!)':''}`,true);
  }
}

// ─── GAME LOOP ────────────────────────────────────────────────────────────────
function gameLoop(){
  const dt=Math.min(clock.getDelta(),0.05);
  if (hitMarkerTimer > 0) {
    hitMarkerTimer -= dt;
    if (hitMarkerTimer <= 0) document.getElementById('hitMarker').style.opacity = '0';
  }
  
  const isPaused = !gameActive || currentUIState !== UI_STATE.GAME;
  
  if(!isPaused){
    updateDayNight(dt);

    // UPGRADE 3
    updateWeather(dt);
    updateTurrets(dt);
    updatePlayer(dt);
    updateDeers(dt);
    updateAI(dt);
    updateProjectiles(dt);
    updateParticles(dt);
    updateFloaters(dt);
    updateCampfires(dt);
    updateWalls(dt);     // Feature 2: critical wall flash

    updatePlanters(dt);
    updateWaves(dt);
    updateDrops(dt);
    updateTweens(dt);
    updateViewmodel(dt);
    updateBuildPreview();
    applyShake();
    updateHUD(dt);
    updateMinimap();
    autoSaveTimer += dt;
    if (autoSaveTimer >= 20) {
      saveProgress(false);
      autoSaveTimer = 0;
    }
    
    if (document.getElementById('debugMenu').style.display === 'block') {
      document.getElementById('debugMenu').innerHTML = `
        FPS: ${Math.round(1/dt)}<br>
        POS: ${playerBody.position.x.toFixed(1)}, ${playerBody.position.z.toFixed(1)}<br>
        TIME: ${(worldTime/DAY_DURATION*24).toFixed(1)}h<br>
        BANDITS: ${bandits.filter(b=>b.userData.health>0).length}<br>
        ENTITIES: ${trees.length+rocks.length+bushes.length+walls.length+carts.length+turrets.length}
      `;
    }
  }

  // Update previous key states for the next frame
  prevKeys = { ...keys };

}

// ─── PAUSE / POINTER LOCK ─────────────────────────────────────────────────────
let gameStarted=false;

const UI_STATE = { GAME: 'GAME', SKILL_MENU: 'SKILL_MENU', ESC_MENU: 'ESC_MENU', WORKBENCH: 'WORKBENCH', CHEST: 'CHEST' };
let currentUIState = UI_STATE.ESC_MENU;

Object.defineProperty(window, 'isWorkbenchOpen', {
  get: () => currentUIState === UI_STATE.WORKBENCH,
  set: (val) => { if (val) currentUIState = UI_STATE.WORKBENCH; else if (currentUIState === UI_STATE.WORKBENCH) currentUIState = UI_STATE.GAME; }
});
Object.defineProperty(window, 'isChestOpen', {
  get: () => currentUIState === UI_STATE.CHEST,
  set: (val) => { if (val) currentUIState = UI_STATE.CHEST; else if (currentUIState === UI_STATE.CHEST) currentUIState = UI_STATE.GAME; }
});
Object.defineProperty(window, 'isSkillMenuOpen', {
  get: () => currentUIState === UI_STATE.SKILL_MENU,
  set: (val) => { if (val) currentUIState = UI_STATE.SKILL_MENU; else if (currentUIState === UI_STATE.SKILL_MENU) currentUIState = UI_STATE.GAME; }
});

function showOverlay(isPause){
  gameActive=false;
  currentUIState = UI_STATE.ESC_MENU;
  const overlay=document.getElementById('overlay'), btn=document.getElementById('startBtn'), rst=document.getElementById('resetBtn');
  overlay.style.display='flex';
  if(isPause){btn.textContent='Resume Game';rst.style.display='block';}
  else{btn.textContent='Enter the Frontier';rst.style.display='none';}
}
function hideOverlayAndLock(){
  document.getElementById('overlay').style.display='none';
  document.getElementById('hud').style.display='block';
  renderer.domElement.requestPointerLock();
}


document.getElementById('startBtn').addEventListener('click',()=>{
  if(!gameStarted){
    gameStarted=true;
    selectWeaponModel(0);
    positionMuzzleFlash();
    updateHUD(0.016);
    updateResources();
    const loaded = loadProgress();
    if (loaded) showAlert('Progress restored from local save.', false);
    else setTimeout(()=>showAlert('Welcome to Frontier Outpost. Night falls every 3 minutes!',false),800);
  }
  hideOverlayAndLock();
});

function resetWorld() {
  clearTransientRuntime();
  autoSaveTimer = 0;
  respawnGraceTimer = 0;
  try { localStorage.removeItem(SAVE_KEY); } catch (err) {}
  // Clear arrays and scene
  [...trees, ...rocks, ...bushes, ...bandits, ...deers, ...walls, ...campfires, ...traps, ...carts, ...turrets, ...barrels, ...corpses, ...drops].forEach(obj => {
    scene.remove(obj);
    disposeObject(obj);
  });
  trees.length = 0; rocks.length = 0; bushes.length = 0; bandits.length = 0; deers.length = 0;
  walls.length = 0; campfires.length = 0; traps.length = 0; carts.length = 0; turrets.length = 0;
  barrels.length = 0; corpses.length = 0; drops.length = 0;
  blocks.clear();
  for (const b of blockMeshes) { scene.remove(b); disposeObject(b); }
  blockMeshes.length = 0;
  
  // Reset stats
  playerHealth = 100; playerMaxHealth = 100;
  playerStamina = 100; playerMaxStamina = 100;
  playerHunger = 100; playerMaxHunger = 100;
  playerTemp = 100; playerMaxTemp = 100;
  wood = 0; stone = 0; berries = 0; scrap = 0; rawMeat = 0; cookedMeat = 0; kills = 0;
  playerLevel = 1; playerXP = 0; playerNextXP = 100; skillPoints = 0;
  speedMultiplier = 1.0; combatDamageMult = 1.0; reloadSpeedMult = 1.0; headshotBonus = 2.0;
  berryGatherMult = 1; staminaDrainMult = 1.0; buildCostMult = 1.0;
  window.wallMaxHealth = 150; window.lanternUpgraded = false;
  
  // Reset skills
  for (const id in SKILLS) SKILLS[id].level = 0;
  
  // Reset weapons
  weapons[0].damage = 35; weapons[0].level = 1; weapons[0].name = 'Axe';
  weapons[1].damage = 20; weapons[1].level = 1; weapons[1].name = 'Pickaxe';
  weapons[2].damage = 45; weapons[2].level = 1; weapons[2].name = 'Revolver'; weapons[2].maxAmmo = 6; weapons[2].ammo = 6; weapons[2].reserveAmmo = 24;
  weapons[3].damage = 70; weapons[3].level = 1; weapons[3].name = 'Rifle'; weapons[3].maxAmmo = 5; weapons[3].ammo = 5; weapons[3].reserveAmmo = 15;
  
  // Reset time and waves
  worldTime = 0; isNight = false; daysSurvived = 0;
  waveTimer = 90; waveTimerMax = 90; waveNumber = 0;
  
  // Reset player position
  playerBody.position.set(0, 2, 0);
  playerVel.set(0, 0, 0);
  yaw = 0; pitch = 0;
  
  // Re-init world
  initWorld();
  
  // Update UI
  document.getElementById('lvlText').textContent = playerLevel;
  document.getElementById('xpText').textContent = playerXP + '/' + playerNextXP;
  document.getElementById('xpFill').style.width = '0%';
  document.getElementById('spCount').textContent = skillPoints;
  document.getElementById('spHint').style.display = 'none';
  document.getElementById('dayCounter').textContent = 'Day 1';
  document.getElementById('killCount').textContent = '0';
  
  updateHUD(0.016);
  updateResources();
  renderSkillMenu();
  
  hideOverlayAndLock();
}

document.getElementById('resetBtn').addEventListener('click', resetWorld);

document.addEventListener('pointerlockchange',()=>{
  pointerLocked = document.pointerLockElement === renderer.domElement;
  if(pointerLocked){
    gameActive=true;
    currentUIState = UI_STATE.GAME;
    document.getElementById('overlay').style.display='none';
  }
  else{
    if(VoxelSystem.active)VoxelSystem.active = false;
    if(document.getElementById('deathScreen').style.display!=='flex' && !isWorkbenchOpen && !isChestOpen && !isSkillMenuOpen) {
      currentUIState = UI_STATE.ESC_MENU;
      showOverlay(gameStarted);
    }
  }
});

renderer.domElement.addEventListener('click', () => {

  // Do NOT lock pointer if any UI is open
  if (
    isWorkbenchOpen ||
    isChestOpen ||
    isSkillMenuOpen ||
    (document.body.classList.contains('ui-active'))
  ) {
    return;
  }

  if (
    !pointerLocked &&
    gameStarted &&
    document.getElementById('overlay').style.display === 'none' &&
    document.getElementById('deathScreen').style.display !== 'flex'
  ) {
    renderer.domElement.requestPointerLock();
  }

});

function bindGlobalListeners() {
  document.getElementById('respawnBtn').addEventListener('click', respawn);
  window.addEventListener('beforeunload', () => { saveProgress(false); });
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });
}

const runFrame = createGameLoop(
  () => gameLoop(),
  () => renderer.render(scene, camera)
);

let bootstrapped = false;
export function startGame() {
  if (bootstrapped) return;
  bootstrapped = true;
  bindGlobalListeners();
  initWorld();
  runFrame();
}

