import { startGame } from './systems/game.js';
import { createPlayerSystem } from './systems/player.js';
import { createBuildingSystem } from './systems/building.js';
import { createSurvivalSystem } from './systems/survival.js';
import { createInventorySystem } from './systems/inventory.js';
import { createAISystem } from './systems/ai.js';
import { createTerrainSystem } from './world/terrain.js';
import { createEnvironmentSystem } from './world/environment.js';
import { createResourceSystem } from './world/resources.js';
import { createHudController } from './ui/hud.js';
import { createMenuController } from './ui/menus.js';

import { createUpdateManager } from './managers/updateManager.js';
import { createLifecycleManager } from './managers/lifecycleManager.js';
import { createEventBus } from './managers/eventBus.js';
import { createPersistenceManager } from './managers/persistence.js';
import { createSpawner } from './systems/spawner.js';

const appContext = {};

// Managers (lightweight, opt-in)
const updateManager = createUpdateManager();
const lifecycleManager = createLifecycleManager();
const eventBus = createEventBus();
const persistence = createPersistenceManager();

appContext.updateManager = updateManager;
appContext.lifecycle = lifecycleManager;
appContext.eventBus = eventBus;
appContext.persistence = persistence;

// Create systems and register with lifecycle/persistence if supported
const player = createPlayerSystem(appContext);
if (player) { lifecycleManager.register(player); if (player.snapshot) persistence.register('player', player); }
const building = createBuildingSystem(appContext);
if (building) { lifecycleManager.register(building); if (building.snapshot) persistence.register('building', building); }
const survival = createSurvivalSystem(appContext);
if (survival) { lifecycleManager.register(survival); if (survival.snapshot) persistence.register('survival', survival); }
const inventory = createInventorySystem(appContext);
if (inventory) { lifecycleManager.register(inventory); if (inventory.snapshot) persistence.register('inventory', inventory); }
const ai = createAISystem(appContext);
if (ai) { lifecycleManager.register(ai); if (ai.snapshot) persistence.register('ai', ai); }
const terrain = createTerrainSystem(appContext);
if (terrain) { lifecycleManager.register(terrain); if (terrain.snapshot) persistence.register('terrain', terrain); }
const environment = createEnvironmentSystem(appContext);
if (environment) { lifecycleManager.register(environment); if (environment.snapshot) persistence.register('environment', environment); }
const resources = createResourceSystem(appContext);
if (resources) { lifecycleManager.register(resources); if (resources.snapshot) persistence.register('resources', resources); }
const hud = createHudController(appContext);
if (hud) { lifecycleManager.register(hud); }
const menu = createMenuController(appContext);
if (menu) { lifecycleManager.register(menu); }

// Spawner (uses eventBus to request entity creation)
const spawner = createSpawner(appContext);
if (spawner) { lifecycleManager.register(spawner); }

startGame();

