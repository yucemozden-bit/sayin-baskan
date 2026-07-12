// src/core/rng.js — rastgelelik kaynağı.
// Varsayılan: Math.random (üretim). setSeed(n) ile deterministik (mulberry32) —
// tekrarlanabilir testler/dengeleme için. resetSeed() Math.random'a döner.

let _state = null;

export function setSeed(n) { _state = (n >>> 0) || 1; }
export function resetSeed() { _state = null; }

function next() {
  if (_state === null) return Math.random();
  _state = (_state + 0x6D2B79F5) >>> 0;
  let t = _state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function rand(min, max) {
  return next() * (max - min) + min;
}

export function randint(min, max) {
  return Math.floor(rand(min, max + 1));
}
