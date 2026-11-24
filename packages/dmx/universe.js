// @openav/dmx · universe — 512 slots of 0..255, addressed 1..512 the way a fixture's display and a patch sheet number them.
// A wrong address is an error, not a clamp: a light patched one channel off still lights, just not the one you meant.

export const SLOTS = 512;

function checkAddress(address) {
  if (!Number.isInteger(address) || address < 1 || address > SLOTS) throw new RangeError(`DMX address must be an integer 1–512 (got ${address})`);
}
function checkByte(value) {
  if (!Number.isInteger(value) || value < 0 || value > 255) throw new RangeError(`DMX value must be an integer 0–255 (got ${value})`);
}
function checkId(id) {
  if (!Number.isInteger(id) || id < 0 || id > 63999) throw new RangeError(`universe must be an integer 0–63999 (got ${id})`);
}

/** One DMX universe: 512 bytes in `data`, read and written by 1-based address. */
export class Universe {
  constructor(id = 1) {
    checkId(id);
    this.id = id;
    this.data = new Uint8Array(SLOTS);
  }

  /** The value at a 1-based address. */
  get(address) {
    checkAddress(address);
    return this.data[address - 1];
  }

  /** Write one value (0..255) at a 1-based address. */
  set(address, value) {
    checkAddress(address);
    checkByte(value);
    this.data[address - 1] = value;
    return this;
  }

  /** Write consecutive values starting at a 1-based address; the run must end at 512 or before. */
  write(address, values) {
    checkAddress(address);
    const n = values.length;
    if (address - 1 + n > SLOTS) throw new RangeError(`${n} values from address ${address} run past 512`);
    for (let i = 0; i < n; i++) checkByte(values[i]);
    for (let i = 0; i < n; i++) this.data[address - 1 + i] = values[i];
    return this;
  }

  /** Every slot to one value (0 by default). */
  fill(value = 0) {
    checkByte(value);
    this.data.fill(value);
    return this;
  }

  /** A copy that shares nothing with this one. */
  copy() {
    const u = new Universe(this.id);
    u.data.set(this.data);
    return u;
  }
}

/** Several universes by number, each made on first use. */
export class Universes {
  #map = new Map();

  /** The universe with this number, created (all zeros) if it does not exist yet. */
  get(id = 1) {
    checkId(id);
    let u = this.#map.get(id);
    if (!u) { u = new Universe(id); this.#map.set(id, u); }
    return u;
  }

  /** True when this universe has been made. */
  has(id) {
    return this.#map.has(id);
  }

  /** The numbers of the universes made so far, lowest first. */
  ids() {
    return [...this.#map.keys()].sort((a, b) => a - b);
  }

  /** The 512 bytes of one universe (zeros for one that was never made); a copy. */
  bytes(id = 1) {
    const u = this.#map.get(id);
    return u ? u.data.slice() : new Uint8Array(SLOTS);
  }

  /** Every universe as [id, Universe], lowest number first. */
  entries() {
    return this.ids().map((id) => [id, this.#map.get(id)]);
  }
}
