export class InputManager {
  constructor(target = window) {
    this.target = target;
    this._keys = new Set();
    this._edges = new Set();
    this._padPrev = new Array(20).fill(false);
    this.padConnected = false;
    this.enabled = true;

    this._onKeyDown = (e) => {
      if (e.repeat) return;
      if (this._isCapturedKey(e.code)) e.preventDefault();
      this._keys.add(e.code);
      this._edges.add(e.code);
    };
    this._onKeyUp = (e) => this._keys.delete(e.code);
    this._onBlur = () => this._keys.clear();
    this._onPadConnect = () => { this.padConnected = true; };
    this._onPadDisconnect = () => { this.padConnected = false; };

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

  _pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) {
      if (p && p.connected) { pad = p; break; }
    }
    if (!pad) return null;
    const dz = (v) => (Math.abs(v) < 0.12 ? 0 : v);
    const btn = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
    const val = (i) => (pad.buttons[i] ? pad.buttons[i].value : 0);
    return {
      steer: dz(pad.axes[0] || 0),
      throttle: val(7),
      brake: val(6),
      moveForward: dz(-(pad.axes[1] || 0)),
      interact: btn(0),
      decline: btn(1),
      horn: btn(2),
      enterExit: btn(3),
      handbrake: btn(5),
      radio: btn(4),
      pause: btn(9),
      sprint: btn(10),
      sprintRT: val(7) > 0.5,
      shiftHeld: btn(1)
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
      pausePressed: false,
      acceptPressed: false,
      declinePressed: false,
      mutePressed: false,
      radioHeld: false,
      radioPressed: false,
      shiftHeld: false,
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

    state.interactPressed = this._edge('KeyE');
    state.enterExitPressed = this._edge('KeyF');
    state.pausePressed = this._edge('Escape');
    state.acceptPressed = this._edge('Enter', 'NumpadEnter');
    state.declinePressed = this._edge('KeyN');
    state.mutePressed = this._edge('KeyM');
    state.radioHeld = this._down('KeyR');
    state.radioPressed = this._edge('KeyR');

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
      state.interactPressed = state.interactPressed || (pad.horn && !this._padPrev[2]) || (pad.interact && !this._padPrev[0]);
      state.acceptPressed = state.acceptPressed || (pad.interact && !this._padPrev[0]) || (pad.horn && !this._padPrev[2]);
      state.declinePressed = state.declinePressed || (pad.decline && !this._padPrev[1]);
      state.enterExitPressed = state.enterExitPressed || (pad.enterExit && !this._padPrev[3]);
      state.pausePressed = state.pausePressed || (pad.pause && !this._padPrev[9]);
      if (pad.radio) state.radioHeld = true;
      if (pad.radio && !this._padPrev[4]) state.radioPressed = true;
      this._padPrev[0] = pad.interact;
      this._padPrev[1] = pad.decline;
      this._padPrev[2] = pad.horn;
      this._padPrev[3] = pad.enterExit;
      this._padPrev[4] = pad.radio;
      this._padPrev[9] = pad.pause;
    }

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
