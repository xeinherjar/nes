import * as mmu from './mmu';

// REGISTERS
let registers = { };

// Program Counter is 16 bits wide
registers.pc = (mmu.read(0xFFFC) << 8) | mmu.read(0xFFFD);

/* Stack Pointer
 * Least significant byte of address starting at offset 0x100
 * [0x100 - 0x1FF]
 * Grows down in space, pushing decrements, popping increments
 * */
registers.sp = 0xFD;
registers.accumulator = 0;
registers.regX = 0;
registers.regY = 0;

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
registers.flags = 0;
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
  return mmu.read(registers.pc);
};

const getNextByte = () => {
  return mmu.read(registers.pc + 1);
};

const getNextWord = () => {
  var low  = mmu.read(registers.pc + 1);
  var high = mmu.read(registers.pc + 2);
  var word = (high << 8) | low;
  return word;
};

/* HELPERS Stack */
const push = (value) => {
  mmu.write((0x100 + registers.sp), value);
  registers.sp--;
};

const pull = () => {
  registers.sp++;
  return mmu.read(0x100 + registers.sp);
};

/* HELPERS Flags */
const getFlag = (mask) => {
  return (registers.flags >> mask) & 1;
};

const clearFlagBit = (mask) => {
  mask = 1 << mask;
  registers.flags &= ~mask;
};

const setFlagBit = (mask) => {
  mask = 1 << mask;
  registers.flags |= mask;
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

/* ADDRESS MODES */
const read = (address) => {
  switch (address) {
    case 'accumulator':
      return registers.accumulator;
    case 'immediate':
      return getNextByte();
    default:
      return mmu.read(address);
  }
};

const write = (address, value) => {
  switch (address) {
    case 'accumulator':
      registers.accumulator = value & 0xFF;
      break;
    case 'immediate':
      mmu.write(getNextByte(), value);
      break;
    default:
      mmu.write(address, value);
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
  console.log('pc', registers.pc);
  // Perform interrupt request before instructions
  // TODO: Check for interrupts
  if (interrupt.requested) {
    // NMI, IRQ, RESET
    interrupt.request = false;
  }
};

const reset = () => {
  registers.pc = (mmu.read(0xFFFC) << 8) | mmu.read(0xFFFD);
  registers.sp = 0xFD;
  registers.flags = 0x24;
};

export { step, reset, requestInterrupt };
