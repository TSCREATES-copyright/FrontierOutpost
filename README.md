# 🌄 Frontier Outpost

**Frontier Outpost** is a browser-based 3D survival builder game built with Three.js.  
Gather resources, build structures, survive enemy attacks, and explore a procedurally generated world — all running entirely in the browser.

---

## 🎮 Features

### 🌍 World
- Procedural terrain generation (heightmap-based)
- Dynamic environment and lighting
- 3-minute day/night cycle

### 🧍 Player
- First-person controls (Pointer Lock)
- Health and stamina systems
- Sprinting and dodge mechanics

### ⛏️ Survival & Resources
- Harvest trees (wood) and rocks (stone)
- Raycast-based interaction system
- Inventory and resource tracking

### 🏗️ Building System
- Grid-based building (TILE snapping)
- Wall edge snapping
- Ghost preview placement
- Resource-based construction

### ⚔️ Combat
- Melee and ranged weapons (revolver, rifle)
- Bandit enemy AI
- Kill tracking

### 🧠 UI / HUD
- Hotbar (slots 1–4)
- Resource counters
- Kill counter
- Minimap (Canvas-based)
- Notifications / alerts

---

## 📁 Project Structure
/frontier-outpost/
│
├── index.html
├── /css/
│ └── styles.css
│
├── /js/
│ ├── main.js
│ │
│ ├── core/
│ ├── systems/
│ ├── world/
│ ├── ui/
│ └── utils/
│
└── /assets/
├── textures/
├── models/
└── audio/

---

## Run the Game

You can run the game directly in your browser:

Open index.html
OR
Use a simple local server (recommended for ES modules)

Example using Python:

python -m http.server

Then open:

http://localhost:8000

---

## 🖥️ Requirements
Modern browser (Chrome, Edge, Firefox recommended)
WebGL support
ES6 module support

---

## 🎯 Controls

| Action       | Input              |
| ------------ | ------------------ |
| Move         | WASD               |
| Look         | Mouse              |
| Sprint       | Shift              |
| Interact     | Left Click         |
| Build Select | 1–4                |
| Aim / Shoot  | Right / Left Click |

(Controls may evolve as development continues)

---

## 🧱 Development Philosophy

Fully client-side (no backend)
Modular architecture (ES6 modules)
No frameworks or build tools
Lightweight and scalable
Designed for iterative expansion

---

## 🛠️ Tech Stack

HTML5
CSS3
Vanilla JavaScript (ES Modules)
Three.js
Canvas API (minimap)

---

## 📌 Roadmap (Planned Features)

Crafting system
Base defense mechanics
Expanded AI behaviors
Save/load system improvements
UI/UX overhaul
More weapons and tools

---

## 🤝 Contributing

See CONTRIBUTING.md

---

## 🧱 Architecture Docs

See docs/architecture.md

---

## 🐞 Issues & Bugs

Use GitHub Issues to report bugs or request features.

---

## 📄 License

This project is licensed under the MIT License.
See the LICENSE file for details.

---

## 💡 Notes

This is an active development project
Expect frequent changes and improvements
Feedback and ideas are highly appreciated

---

## Author

®TSCREATES ๋࣭ ⭑⚝💜✮⋆˙# FrontierOutpost
