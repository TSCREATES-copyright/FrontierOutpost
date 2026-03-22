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

const appContext = {};

createPlayerSystem(appContext);
createBuildingSystem(appContext);
createSurvivalSystem(appContext);
createInventorySystem(appContext);
createAISystem(appContext);
createTerrainSystem(appContext);
createEnvironmentSystem(appContext);
createResourceSystem(appContext);
createHudController(appContext);
createMenuController(appContext);

startGame();

