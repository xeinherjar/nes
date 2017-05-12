import * as mmu from './mmu';

// REGISTERS
// Program Counter is 16 bits wide
let pc = (mmu.read(0xFFFC) << 8) | mmu.read(0xFFFD);

/* Stack Pointer
 * Least significant byte of address starting at offset 0x100
 * [0x100 - 0x1FF]
 * Grows down in space, pushing decrements, popping increments
 * */
let sp = 0xFD;
let accumulator = 0;
let regX = 0;
let regY = 0;

/* Status Register | Flags
 * Bit 7  6  5  4  3  2  1  0
 *     s  v     b  d  i  z  c
 *     c:carry, z:zero, i:interupts, d:decimal
 *     b:break,       , v:overflow,  s:sign
 *
 *     Check if bit set
 *     (byte>>bit)&1
 *     233:11101001 : (233>>2)&1 = 0
 * */
let flags = 0;
const C = 0, Z = 1, I = 2, D = 3,
      B = 4,        V = 6, S = 7;

let interrupt = { requested: false, type: '' };

/* COUNTERS */
let cycles = 0;

/* HELPERS */
const toSignedInt = (n) => {
  const halfN = 127;
  const num = halfN * 2;
  return (n + halfN) % num - halfN;
};

const getCurrentByte = () => {
  return mmu.read(pc);
};

const getNextByte = () => {
  return mmu.read(pc + 1);
};

const getNextWord = () => {
  var low  = mmu.read(pc + 1);
  var high = mmu.read(pc + 2);
  var word = (high << 8) | low;
  return word;
};

/* HELPERS Stack */
const push = (value) => {
  mmu.write((0x100 + sp), value);
  sp--;
};

const pull = () => {
  sp++;
  return mmu.read(0x100 + sp);
};

/* HELPERS Flags */
const getFlag = (mask) => {
  return (flags >> mask) & 1;
};

const clearFlagBit = (mask) => {
  mask = 1 << mask;
  flags &= ~mask;
};

const setFlagBit = (mask) => {
  mask = 1 << mask;
  flags |= mask;
};

const testAndSetCarry = (value) => {
  if (value > 255 || value <= 0) {
    setFlagBit(C);
  } else {
    clearFlagBit(C);
  }
};

const testAndSetZero = (value) => {
  if ((value & 0xFF) === 0) {
    setFlagBit(Z);
  } else {
    clearFlagBit(Z);
  }
};

const testAndSetOverflow = (left, right, value) => {
  const v1 = (left  >> 7) & 1;
  const v2 = (right >> 7) & 1;
  const result  = ((value & 0xFF) >> 7) & 1;

  if ((result === v1) || (result === v2)) {
    clearFlagBit(V);
  } else {
    setFlagBit(V);
  }
};

const testAndSetSign = (value) => {
  var result = ((value & 0xFF) >> 7) & 1;
  if (result) {
    setFlagBit(S);
  } else {
    clearFlagBit(S);
  }
};

// OPs Tables
const OP_BYTES = [
  1, 2, 0, 0, 0, 2, 2, 0, 1, 2, 1, 0, 0, 3, 3, 0,
  2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0,
  3, 2, 0, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,
  2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0,
  1, 2, 0, 0, 0, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,
  2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0,
  1, 2, 0, 0, 0, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,
  2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0,
  0, 2, 0, 0, 2, 2, 2, 0, 1, 0, 1, 0, 3, 3, 3, 0,
  2, 2, 0, 0, 2, 2, 2, 0, 1, 3, 1, 0, 0, 3, 0, 0,
  2, 2, 2, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,
  2, 2, 0, 0, 2, 2, 2, 0, 1, 3, 1, 0, 3, 3, 3, 0,
  2, 2, 0, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,
  2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0,
  2, 2, 0, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,
  2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0,
];








const requestInterrupt = (type) => {
  interrupt.requested = true;
  interrupt.type = type;
};

const step = () => {
  console.log('pc', pc);
  // Perform interrupt request before instructions
  // TODO: Check for interrupts
  if (interrupt.requested) {
    // NMI, IRQ, RESET
    interrupt.request = false;
  }
};

const reset = () => {
  pc = (mmu.read(0xFFFC) << 8) | mmu.read(0xFFFD);
  sp = 0xFD;
  flags = 0x24;
};

export { step, reset, requestInterrupt };
