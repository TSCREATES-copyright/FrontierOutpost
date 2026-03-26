# System Interface (Frontier Outpost)

This document describes the lightweight system interface used by Frontier Outpost. Systems should remain small and opt-in to the lifecycle and persistence managers.

Implement new surface for a system module:

- init(context) — optional. Called once with shared context. Use to read managers and register callbacks.
- update(delta) — optional. Called every frame (registered via Update Manager). Prefer phase-based registration.
- dispose() — optional. Clean up Three.js objects, timers, and event listeners.
- snapshot() — optional. Return a JSON-serialisable object representing the minimal state necessary to persist.
- restore(snapshot) — optional. Restore state from snapshot.

Notes:
- Prefer registering update callbacks with updateManager instead of exporting an update function directly.
- All methods should be defensive: check objects exist and wrap external calls in try/catch.
- Keep snapshots minimal: player position, inventory counts, and building grid occupancy are sufficient for early persistence.
