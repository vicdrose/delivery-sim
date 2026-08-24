export const RHYTHM_MODE_ID = 'rhythm';

/**
 * Reserved seam for the future rhythm-game mode.
 *
 * The delivery loop feeds Progression; a rhythm mode will be registered here
 * the same way DeliveryMode is registered in Game.modes, activated via
 * game.setMode('rhythm', { songId, difficulty }).
 *
 * Intended flow:
 *   DELIVERY MODE -> PROGRESSION -> RHYTHM BOSS -> UNLOCK CONTENT
 *
 * A rhythm level will own the render loop output for its duration (its own
 * scene or an overlay scene), use Tone.Transport for chart timing, and return
 * a result object { cleared, score, accuracy } that Progression translates
 * into unlocks via progression.grantUnlock(...).
 */
export function registerRhythmModes(registry, ctx) {
  void registry;
  void ctx;
}
