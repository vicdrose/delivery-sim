import { ui } from '../ui/store.js';

const TRIGGER_DEADZONE = 0.12;

export class InputManager {
  constructor(target = window) {
    this.target = target;
    this._actionPrev = false;
    this._pausePrev = false;
    this._repairPrev = false;
    this._keys = new Set();
    this._edges = new Set();
    this._padPrev = new Array(24).fill(false);
    this._padProfiles = new Map();
    this._padIndex = null;
    this.padConnected = false;
    this.padName = '';
    this.enabled = true;

    this._onKeyDown = (e) => {
      if (e.repeat) return;
      if (this._isCapturedKey(e.code)) e.preventDefault();
      this._keys.add(e.code);
      this._edges.add(e.code);
    };
    this._onKeyUp = (e) => this._keys.delete(e.code);
    this._onBlur = () => this._keys.clear();
    this._onPadConnect = (e) => {
      this.padConnected = true;
      if (e && e.gamepad) this._padProfiles.delete(e.gamepad.index);
    };
    this._onPadDisconnect = (e) => {
      this.padConnected = false;
      if (e && e.gamepad) this._padProfiles.delete(e.gamepad.index);
      this._padPrev.fill(false);
    };

    target.addEventListener('keydown', this._onKeyDown);
    target.addEventListener('keyup', this._onKeyUp);
    target.addEventListener('blur', this._onBlur);
    window.addEventListener('gamepadconnected', this._onPadConnect);
    window.addEventListener('gamepaddisconnected', this._onPadDisconnect);
  }

  _isCapturedKey(code) {
    return (
      code.startsWith('Arrow') ||
      code === 'Space' ||
      code === 'Tab'
    );
  }

  _down(...codes) {
    for (const c of codes) if (this._keys.has(c)) return true;
    return false;
  }

  _edge(...codes) {
    for (const c of codes) if (this._edges.has(c)) return true;
    return false;
  }

  _mergeTouch(state, ui) {
    const mx = Math.abs(ui.moveX) > 0.08 ? ui.moveX : 0;
    const my = Math.abs(ui.moveY) > 0.08 ? ui.moveY : 0;
    if (mx !== 0) state.steer = mx;
    if (my !== 0) {
      if (my > 0) {
        state.throttle = Math.max(state.throttle, my);
        state.moveForward = Math.max(state.moveForward, my);
      } else {
        state.brake = Math.max(state.brake, -my);
        state.moveForward = Math.min(state.moveForward, my);
      }
    }
    state.handbrake = state.handbrake || ui.handbrakePressed;
    state.sprint = state.sprint || ui.sprintPressed;
    state.voiceHeld = state.voiceHeld || ui.voiceHeld;

    const actionEdge = ui.actionPressed && !this._actionPrev;
    state.actionPressed = state.actionPressed || actionEdge;
    state.interactPressed = state.interactPressed || actionEdge;
    state.acceptPressed = state.acceptPressed || actionEdge;
    state.enterExitPressed = state.enterExitPressed || actionEdge;
    state.pausePressed = state.pausePressed || (ui.pausePressed && !this._pausePrev);
    state.repairPressed = state.repairPressed || (ui.repairPressed && !this._repairPrev);

    this._actionPrev = !!ui.actionPressed;
    this._pausePrev = !!ui.pausePressed;
    this._repairPrev = !!ui.repairPressed;
  }

  _padButton(pad, index) {
    const b = pad.buttons ? pad.buttons[index] : null;
    if (!b) return 0;
    const value = Number.isFinite(b.value) ? b.value : 0;
    if (value > 0) return value;
    return b.pressed ? 1 : 0;
  }

  _padActivity(pad) {
    let score = 0;
    const buttons = pad.buttons || [];
    const axes = pad.axes || [];
    for (let i = 0; i < buttons.length; i++) {
      const b = buttons[i];
      if (b && (b.pressed || (b.value || 0) > 0.25)) score += 1;
    }
    for (let i = 0; i < axes.length; i++) {
      if (Math.abs(axes[i] || 0) > 0.3) score += 1;
    }
    return score;
  }

  _selectPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let chosen = null;
    let best = -1;
    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      if (!pad || !pad.connected) continue;
      const score = this._padActivity(pad);
      if (score > best) {
        best = score;
        chosen = pad;
      }
    }
    if (!chosen) {
      this._padIndex = null;
      return null;
    }
    if (best === 0 && this._padIndex !== null) {
      for (let i = 0; i < pads.length; i++) {
        const pad = pads[i];
        if (pad && pad.connected && pad.index === this._padIndex) return pad;
      }
    }
    return chosen;
  }

  _padProfile(pad) {
    const axes = pad.axes || [];
    const buttons = pad.buttons || [];
    const sig = `${pad.id}|${pad.mapping}|${axes.length}|${buttons.length}`;
    let profile = this._padProfiles.get(pad.index);
    if (!profile || profile.sig !== sig) {
      profile = {
        sig,
        standard: pad.mapping === 'standard',
        rest: Array.from(axes, (v) => (Number.isFinite(v) ? v : 0))
      };
      profile.triggers = this._detectTriggers(pad, profile);
      this._padProfiles.set(pad.index, profile);
    }
    return profile;
  }

  _calibratePad(pad, profile) {
    const axes = pad.axes || [];
    const buttons = pad.buttons || [];
    for (let i = 0; i < buttons.length; i++) {
      const b = buttons[i];
      if (b && (b.pressed || (b.value || 0) > 0.3)) return;
    }
    for (let i = 0; i < axes.length && i < profile.rest.length; i++) {
      if (profile.triggers.indices.has(i)) continue;
      const v = axes[i] || 0;
      if (Math.abs(v - profile.rest[i]) < 0.35) profile.rest[i] += (v - profile.rest[i]) * 0.1;
    }
  }

  _axisTravel(value, rest) {
    const magnitude = Math.abs(rest);
    if (magnitude >= 0.6) {
      const travel = rest > 0 ? rest - value : value - rest;
      return Math.min(1, Math.max(0, travel / magnitude));
    }
    return Math.min(1, Math.max(0, Math.abs(value - rest)));
  }

  _detectTriggers(pad, profile) {
    const axes = pad.axes || [];
    const found = {
      brake: null,
      throttle: null,
      combined: null,
      separate: [],
      indices: new Set()
    };
    const scanFrom = profile.standard ? 4 : 2;
    const combinedFrom = axes.length <= 3 ? 2 : 4;
    const zeroRest = [];
    for (let i = scanFrom; i < axes.length; i++) {
      const rest = profile.rest[i] || 0;
      if (Math.abs(rest) >= 0.6) {
        const entry = { index: i, rest };
        if (!found.brake) found.brake = entry;
        else if (!found.throttle) found.throttle = entry;
        found.indices.add(i);
      } else if (i >= combinedFrom && Math.abs(rest) < 0.2) {
        zeroRest.push({ index: i, rest });
      }
    }
    if (!found.brake || !found.throttle) {
      if (zeroRest.length > 1) found.separate = zeroRest.slice(0, 2);
      else if (zeroRest.length === 1) found.combined = zeroRest[0];
      for (const entry of found.separate) found.indices.add(entry.index);
      if (found.combined) found.indices.add(found.combined.index);
    }
    return found;
  }

  _pollPad() {
    const pad = this._selectPad();
    if (!pad) {
      this.padConnected = false;
      this.padName = '';
      return null;
    }
    this.padConnected = true;
    this.padName = pad.id || '';
    if (this._padIndex !== pad.index) {
      this._padPrev.fill(false);
      this._padIndex = pad.index;
    }
    const profile = this._padProfile(pad);
    this._calibratePad(pad, profile);
    const axes = pad.axes || [];
    const buttons = pad.buttons || [];
    const dz = (v) => (Math.abs(v) < 0.12 ? 0 : v);
    const btn = (i) => !!(buttons[i] && buttons[i].pressed);
    const val = (i) => this._padButton(pad, i);

    let steer = dz(axes[0] || 0);
    let moveForward = dz(-(axes[1] || 0));
    let throttle = val(7);
    let brake = val(6);

    const triggers = profile.triggers;
    if (triggers.combined) {
      const v = axes[triggers.combined.index] || 0;
      throttle = Math.max(throttle, Math.min(1, Math.max(0, v)));
      brake = Math.max(brake, Math.min(1, Math.max(0, -v)));
    }
    if (triggers.separate.length) {
      const [brakeAxis, throttleAxis] = triggers.separate;
      brake = Math.max(brake, this._axisTravel(axes[brakeAxis.index] || 0, brakeAxis.rest));
      throttle = Math.max(throttle, this._axisTravel(axes[throttleAxis.index] || 0, throttleAxis.rest));
    }
    if (triggers.throttle) {
      throttle = Math.max(throttle, this._axisTravel(axes[triggers.throttle.index] || 0, triggers.throttle.rest));
    }
    if (triggers.brake) {
      brake = Math.max(brake, this._axisTravel(axes[triggers.brake.index] || 0, triggers.brake.rest));
    }
    if (throttle < TRIGGER_DEADZONE) throttle = 0;
    if (brake < TRIGGER_DEADZONE) brake = 0;

    const up = btn(12);
    const down = btn(13);
    const left = btn(14);
    const right = btn(15);
    if (steer === 0) {
      if (left) steer = -1;
      else if (right) steer = 1;
    }
    if (moveForward === 0) {
      if (up) moveForward = 1;
      else if (down) moveForward = -1;
    }
    if (throttle < 0.05 && brake < 0.05) {
      if (up) throttle = 1;
      else if (down) brake = 1;
    }

    return {
      steer,
      throttle,
      brake,
      moveForward,
      interact: btn(0),
      decline: btn(1),
      horn: btn(2),
      enterExit: btn(3),
      handbrake: btn(5),
      radio: btn(4),
      pause: btn(9),
      sprint: btn(10),
      voice: btn(8),
      sprintRT: throttle > 0.5,
      shiftHeld: btn(1),
      musicVolume: btn(11),
      dpadUp: up,
      dpadDown: down,
      dpadLeft: left,
      dpadRight: right,
      rightStickX: dz(axes[2] || 0),
      rightStickY: dz(axes[3] || 0)
    };
  }

  getState() {
    const state = {
      steer: 0,
      throttle: 0,
      brake: 0,
      handbrake: false,
      sprint: false,
      sprintRT: false,
      horn: false,
      interactPressed: false,
      enterExitPressed: false,
      actionPressed: false,
      repairPressed: false,
      pausePressed: false,
      acceptPressed: false,
      declinePressed: false,
      menuUpPressed: false,
      menuDownPressed: false,
      menuLeftPressed: false,
      menuRightPressed: false,
      menuAcceptPressed: false,
      menuBackPressed: false,
      mutePressed: false,
      radioHeld: false,
      radioPressed: false,
      radioUpPressed: false,
      radioDownPressed: false,
      radioLeftPressed: false,
      radioRightPressed: false,
      radioPowerPressed: false,
      radioShufflePressed: false,
      autoBeatsPressed: false,
      astroBeatsPressed: false,
      shiftHeld: false,
      musicVolumePressed: false,
      voiceHeld: false,
      rightStickX: 0,
      rightStickY: 0,
      moveForward: 0,
      anyInput: false,
      usingGamepad: false
    };

    if (!this.enabled) {
      this._edges.clear();
      return state;
    }

    if (this._down('KeyA', 'ArrowLeft')) state.steer -= 1;
    if (this._down('KeyD', 'ArrowRight')) state.steer += 1;
    if (this._down('KeyW', 'ArrowUp')) state.throttle = 1;
    if (this._down('KeyS', 'ArrowDown')) state.brake = 1;
    if (this._down('KeyW', 'ArrowUp')) state.moveForward = 1;
    if (this._down('KeyS', 'ArrowDown')) state.moveForward = -1;
    state.handbrake = this._down('Space');
    state.sprint = this._down('ShiftLeft', 'ShiftRight');
    state.horn = this._down('KeyH');
    state.shiftHeld = this._down('KeyN');
    state.voiceHeld = this._down('KeyV');

    state.interactPressed = this._edge('KeyE');
    state.enterExitPressed = this._edge('KeyF');
    state.pausePressed = this._edge('Escape');
    state.acceptPressed = this._edge('Enter', 'NumpadEnter');
    state.declinePressed = this._edge('KeyN');
    state.repairPressed = this._edge('KeyG');
    state.mutePressed = this._edge('KeyM');
    state.radioHeld = this._down('KeyR');
    state.radioPressed = this._edge('KeyR');
    state.radioPowerPressed = this._edge('KeyP');
    state.radioShufflePressed = this._edge('KeyH');
    state.autoBeatsPressed = state.radioHeld && this._edge('KeyB');
    state.astroBeatsPressed = state.radioHeld && this._edge('KeyE');

    const pad = this._pollPad();
    if (pad) {
      state.usingGamepad = true;
      if (Math.abs(pad.steer) > Math.abs(state.steer)) state.steer = pad.steer;
      state.throttle = Math.max(state.throttle, pad.throttle);
      state.brake = Math.max(state.brake, pad.brake);
      if (Math.abs(pad.moveForward) > Math.abs(state.moveForward)) state.moveForward = pad.moveForward;
      state.handbrake = state.handbrake || pad.handbrake;
      state.sprint = state.sprint || pad.sprint;
      state.sprintRT = pad.sprintRT;
      state.horn = state.horn || pad.horn;
      state.shiftHeld = state.shiftHeld || pad.shiftHeld;
      state.voiceHeld = state.voiceHeld || pad.voice;
      if (pad.radio) state.radioHeld = true;
      state.interactPressed = state.interactPressed || (pad.horn && !this._padPrev[2]) || (pad.interact && !this._padPrev[0]);
      state.acceptPressed = state.acceptPressed || (pad.interact && !this._padPrev[0]) || (pad.horn && !this._padPrev[2]);
      if (!state.radioHeld) state.declinePressed = state.declinePressed || (pad.decline && !this._padPrev[1]);
      state.enterExitPressed = state.enterExitPressed || (pad.enterExit && !this._padPrev[3]);
      state.pausePressed = state.pausePressed || (pad.pause && !this._padPrev[9]);
      if (pad.radio && !this._padPrev[4]) state.radioPressed = true;
      if (pad.radio && pad.decline && !this._padPrev[1]) state.autoBeatsPressed = true;
      if (pad.radio && pad.interact && !this._padPrev[0]) state.astroBeatsPressed = true;
      state.radioUpPressed = state.radioUpPressed || (pad.dpadUp && !this._padPrev[12]);
      state.radioDownPressed = state.radioDownPressed || (pad.dpadDown && !this._padPrev[13]);
      state.radioLeftPressed = state.radioLeftPressed || (pad.dpadLeft && !this._padPrev[14]);
      state.radioRightPressed = state.radioRightPressed || (pad.dpadRight && !this._padPrev[15]);
      state.radioPowerPressed = state.radioPowerPressed || (pad.enterExit && !this._padPrev[3]);
      state.radioShufflePressed = state.radioShufflePressed || (pad.horn && !this._padPrev[2]);
      state.musicVolumePressed = state.musicVolumePressed || (pad.musicVolume && !this._padPrev[11]);
      state.rightStickX = pad.rightStickX;
      state.rightStickY = pad.rightStickY;
      this._padPrev[0] = pad.interact;
      this._padPrev[1] = pad.decline;
      this._padPrev[2] = pad.horn;
      this._padPrev[3] = pad.enterExit;
      this._padPrev[4] = pad.radio;
      this._padPrev[9] = pad.pause;
      this._padPrev[11] = pad.musicVolume;
      this._padPrev[12] = pad.dpadUp;
      this._padPrev[13] = pad.dpadDown;
      this._padPrev[14] = pad.dpadLeft;
      this._padPrev[15] = pad.dpadRight;
    }

    this._mergeTouch(state, ui);

    if (state.radioHeld) {
      state.radioUpPressed = state.radioUpPressed || this._edge('ArrowUp');
      state.radioDownPressed = state.radioDownPressed || this._edge('ArrowDown');
      state.radioLeftPressed = state.radioLeftPressed || this._edge('ArrowLeft');
      state.radioRightPressed = state.radioRightPressed || this._edge('ArrowRight');
      state.enterExitPressed = false;
      state.interactPressed = false;
      state.acceptPressed = false;
      state.horn = false;
      state.steer = 0;
      state.throttle = 0;
      state.brake = 0;
      state.moveForward = 0;
      state.handbrake = false;
      state.sprint = false;
      state.sprintRT = false;
    }

    if (state.radioHeld) {
      state.interactPressed = false;
      state.acceptPressed = false;
    }

    state.menuUpPressed = state.radioUpPressed || this._edge('ArrowUp');
    state.menuDownPressed = state.radioDownPressed || this._edge('ArrowDown');
    state.menuLeftPressed = state.radioLeftPressed || this._edge('ArrowLeft');
    state.menuRightPressed = state.radioRightPressed || this._edge('ArrowRight');
    state.menuAcceptPressed = state.acceptPressed || state.interactPressed;
    state.menuBackPressed = state.declinePressed || this._edge('Backspace');

    state.anyInput =
      state.steer !== 0 ||
      state.throttle > 0 ||
      state.brake > 0 ||
      state.handbrake ||
      state.interactPressed ||
      state.enterExitPressed ||
      state.pausePressed;

    this._edges.clear();
    return state;
  }

  dispose() {
    this.target.removeEventListener('keydown', this._onKeyDown);
    this.target.removeEventListener('keyup', this._onKeyUp);
    this.target.removeEventListener('blur', this._onBlur);
    window.removeEventListener('gamepadconnected', this._onPadConnect);
    window.removeEventListener('gamepaddisconnected', this._onPadDisconnect);
  }
}
