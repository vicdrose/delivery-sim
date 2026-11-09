export class LocalStationProvider {
  constructor(music, group) {
    this.music = music;
    this.group = group;
  }

  get id() {
    return this.group === 'ep' ? 'ep' : 'default';
  }

  get available() {
    return this.music.localHasTracks(this.group);
  }

  get playing() {
    return this.music.isLocalPlaying(this.group);
  }

  activate(resume = true) {
    this.music.playLocalStation(this.group, resume);
  }

  deactivate() {
    this.music.pauseLocalStations();
  }

  next() {
    this.music.nextLocal(this.group);
  }

  previous() {
    this.music.previousLocal(this.group);
  }

  snapshot() {
    return {
      track: this.available ? this.music.currentLocalName(this.group) : null,
      artist: null,
      playing: this.playing,
      detail: ''
    };
  }
}
