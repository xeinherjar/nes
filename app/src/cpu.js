//import mmu from './mmu';
let mmu = null;

// REGISTERS
let registers = { };
let opCode = null;

// Program Counter is 16 bits wide
registers.pc = 0;

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

let interrupt = { requested: false, type: null };

/* COUNTERS */
let cycles = 0;
let cycles_ran = 0;

/* Memory Access */
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
const accumulator = () => {
  return 'accumulator';
};

const immediate = () => {
  return 'immediate';
};

const absolute = () => {
  return getNextWord();
};

const absoluteX = () => {
  return (getNextWord() + registers.regX) & 0xFFFF;
};

// Extra cycles on page boundry crossing
const absoluteX_pageBoundry = () => {
  var word = getNextWord();
  var addr = (word + registers.regX);

  if ((addr >> 8) !== (word >> 8)) { cycles += 1; }
};

const absoluteY = () => {
  return (getNextWord() + registers.regY) & 0xFFFF;
};

const absoluteY_pageBoundry = () => {
  var word = getNextWord();
  var addr = (word + registers.regY);

  if ((addr >> 8) > (word >> 8)) { cycles += 1; }
};

// implied/implicit
// ie return from subroutine, clear flag...
// nothing to do

const indirect = () => {
  const lowAddress = getNextWord();
  const low  = read(lowAddress);

  // Check for page boundry
  let high;
  if ((lowAddress & 0xFF) === 0xFF) {
    high = read((lowAddress >> 8) << 8);
  } else {
    high = read(lowAddress + 1);
  }

  return (high << 8) | low;
};

const indirectX = () => {
  const lowAddress = getNextByte() + registers.regX;
  const low  = read(lowAddress & 0xFF);
  const high = read((lowAddress + 1) & 0xFF);
  const word = (high << 8) | low;

  return word;
};

const indirectY = () => {
  const lowAddress = getNextByte();
  const low  = read(lowAddress & 0xFF);
  const high = read((lowAddress + 1) & 0xFF);
  const word = (high << 8) | low;
  const addr = (word + registers.regY) & 0xFFFF;

  return addr;
};

var indirectY_pageBoundry = () => {
  const lowAddress = getNextByte();
  const low  = read(lowAddress & 0xFF);
  const high = read((lowAddress + 1) & 0xFF);
  const word = (high << 8) | low;
  const addr = (word + registers.regY);

  if ((addr >> 8) > (word >> 8)) { cycles += 1; }
};

const relative = () => {
  return getNextByte();
};

const zeroPage = () => {
  return getNextByte();
};

const zeroPageX = () => {
  return (getNextByte() + registers.regX) & 0xFF;
};

const zeroPageY = () => {
  return (getNextByte() + registers.regY) & 0xFF;
};


/* Interupts */
const requestInterrupt = (type) => {
  interrupt.requested = true;
  interrupt.type = type;
};

// TODO: cycle count for interups?
const NMI = () => {
  // cycles += 7;

  push(registers.pc);
  push(registers.flags);
  setFlagBit(I);

  var low  = read(0xFFFA);
  var high = read(0xFFFB);
  registers.pc = (high << 8) | low;
};

const IRQ = () => {
  // cycles += 7;

  push(registers.pc);
  push(registers.flags);
  setFlagBit(I);

  var low  = read(0xFFFE);
  var high = read(0xFFFF);
  registers.pc = (high << 8) | low;
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



/* OPCODES */
const ADC = (address) => {
  // ADC               Add memory to accumulator with carry                ADC
  // Operation:  A + M + C -> A, C                         S Z C I D V
  //                                                       / / / _ _ /
  const memValue = read(address);
  const result   = memValue + registers.accumulator + getFlag(C);

  testAndSetSign(result);
  testAndSetZero(result);
  testAndSetCarry(result);
  testAndSetOverflow(memValue, registers.accumulator, result);

  write('accumulator', result);
  registers.pc += OP_BYTES[opCode];
};

const AND = (address) => {
  // AND                  "AND" memory with accumulator                    AND
  // Operation:  A & M -> A                                S Z C I D V
  //                                                       / / _ _ _ _
  const memValue = read(address);
  const result   = memValue & registers.accumulator;

  testAndSetSign(result);
  testAndSetZero(result);

  write('accumulator', result);

  registers.pc += OP_BYTES[opCode];
};

const ASL = (address) => {
  // ASL          ASL Shift Left One Bit (Memory or Accumulator)           ASL
  //                  +-+-+-+-+-+-+-+-+
  // Operation:  C <- |7|6|5|4|3|2|1|0| <- 0
  //                  +-+-+-+-+-+-+-+-+                    S Z C I D V
  //                                                       / / / _ _ _
  const memValue  = read(address);
  const result    = (memValue << 1) & 0xFF;
  const c         = (memValue >> 7) & 1;

  if (c) { setFlagBit(C); } else { clearFlagBit(C); }
  testAndSetSign(result);
  testAndSetZero(result);

  write(address, result);

  registers.pc += OP_BYTES[opCode];
};

const BCC = (address) => {
  // BCC                     BCC Branch on Carry Clear                     BCC
  //                                                       S Z C I D V
  // Operation:  Branch on C = 0                           _ _ _ _ _ _
  registers.pc += OP_BYTES[opCode];

  const value = address;
  if (!getFlag(C)) {
    const branch = toSignedInt(value);
    cycles += 1;
    if (registers.pc >> 8 < ((registers.pc + branch) >> 8)) { cycles += 1; }

    registers.pc += branch;
  }
};

const BCS = (address) => {
  //  BCS                      BCS Branch on carry set                      BCS
  // Operation:  Branch on C = 1                           S Z C I D V
  //                                                       _ _ _ _ _ _
  registers.pc += OP_BYTES[opCode];

  const value = address;
  if (getFlag(C)) {
    const branch = toSignedInt(value);
    cycles += 1;
    if (registers.pc >> 8 < ((registers.pc + branch) >> 8)) { cycles += 1; }

    registers.pc += branch;
  }
};

const BEQ = (address) => {
  // BEQ                    BEQ Branch on result zero                      BEQ
  //                                                       S Z C I D V
  // Operation:  Branch on Z = 1                           _ _ _ _ _ _
  registers.pc += OP_BYTES[opCode];

  const value = address;
  if (getFlag(Z)) {
    const branch = toSignedInt(value);
    cycles += 1;
    if (registers.pc >> 8 < ((registers.pc + branch) >> 8)) { cycles += 1; }

    registers.pc += branch;
  }
};

const BIT = (address) => {
  // BIT             BIT Test bits in memory with accumulator              BIT
  // Operation:  A & M, M7 -> S, M6 -> V

  // Bit 6 and 7 are transferred to the status register.   S Z C I D V
  // If the result of A & M is zero then Z = 1, otherwise M7 / _ _ _ M6
  const memValue = read(address);
  const result   = registers.accumulator & memValue;

  const v = (memValue >> 6) & 1;
  if (v) { setFlagBit(V); } else { clearFlagBit(V); }

  const s = (memValue >> 7) & 1;
  if (s) { setFlagBit(S); } else { clearFlagBit(S); }

  testAndSetZero(result);

  registers.pc += OP_BYTES[opCode];

};

const BMI = (address) => {
  // BMI                    BMI Branch on result minus                     BMI
  // Operation:  Branch on N = 1                           S Z C I D V
  //                                                       _ _ _ _ _ _
  registers.pc += OP_BYTES[opCode];

  const value = address;
  if (getFlag(S)) {
    const branch = toSignedInt(value);
    cycles += 1;
    if (registers.pc >> 8 < ((registers.pc + branch) >> 8)) { cycles += 1; }

    registers.pc += branch;
  }
};

const BNE = (address) => {
  // BNE                   BNE Branch on result not zero                   BNE
  // Operation:  Branch on Z = 0                           S Z C I D V
  //                                                       _ _ _ _ _ _
  registers.pc += OP_BYTES[opCode];

  const value = address;
  if (!getFlag(Z)) {
    const branch = toSignedInt(value);
    cycles += 1;
    if (registers.pc >> 8 < ((registers.pc + branch) >> 8)) { cycles += 1; }

    registers.pc += branch;
  }
};

const BPL = (address) => {
  // BPL                     BPL Branch on result plus                     BPL
  // Operation:  Branch on S = 0                           S Z C I D V
  //                                                       _ _ _ _ _ _
  registers.pc += OP_BYTES[opCode];

  const value = address;
  if (!getFlag(S)) {
    const branch = toSignedInt(value);
    cycles += 1;
    if (registers.pc >> 8 < ((registers.pc + branch) >> 8)) { cycles += 1; }

    registers.pc += branch;
  }
};

const BRK = () => {
  // BRK                          BRK Force Break                          BRK
  // Operation:  Forced Interrupt PC + 2 toS P toS         S Z C I D V
  //                                                       _ _ _ 1 _ _
  registers.pc += 2;

  push(registers.pc);
  push(registers.flags);
  setFlagBit(B); // nestech.txt says to set

  const low  = read(0xFFFE);
  const high = read(0xFFFF);
  registers.pc = (high << 8) | low;
};

const BVC = (address) => {
  // BVC                    BVC Branch on overflow clear                   BVC
  // Operation:  Branch on V = 0                           S Z C I D V
  //                                                       _ _ _ _ _ _
  registers.pc += OP_BYTES[opCode];

  const value = address;
  if (!getFlag(V)) {
    const branch = toSignedInt(value);
    cycles += 1;
    if (registers.pc >> 8 < ((registers.pc + branch) >> 8)) { cycles += 1; }
    registers.pc += branch;
  }
};

const BVS = (address) => {
  // BVS                    BVS Branch on overflow set                     BVS
  // Operation:  Branch on V = 1                           S Z C I D V
  //                                                       _ _ _ _ _ _
  registers.pc += OP_BYTES[opCode];

  const value = address;
  if (getFlag(V)) {
    const branch = toSignedInt(value);
    cycles += 1;
    if (registers.pc >> 8 < ((registers.pc + branch) >> 8)) { cycles += 1; }

    registers.pc += branch;
  }
};

const CLC = () => {
  // CLC                       CLC Clear carry flag                        CLC
  // Operation:  0 -> C                                    S Z C I D V
  //                                                       _ _ 0 _ _ _
  clearFlagBit(C);
  registers.pc += OP_BYTES[opCode];
};

const CLD = () => {
  // CLD                      CLD Clear decimal mode                       CLD
  // Operation:  0 -> D                                    S A C I D V
  //                                                       _ _ _ _ 0 _
  clearFlagBit(D);
  registers.pc += OP_BYTES[opCode];
};

const CLI = () => {
  // CLI                  CLI Clear interrupt disable bit                  CLI
  // Operation: 0 -> I                                     S Z C I D V
  //                                                       _ _ _ 0 _ _
  clearFlagBit(I);
  registers.pc += OP_BYTES[opCode];
};

const CLV = () => {
  // CLV                      CLV Clear overflow flag                      CLV
  // Operation: 0 -> V                                     S Z C I D V
  //                                                       _ _ _ _ _ 0
  clearFlagBit(V);
  registers.pc += OP_BYTES[opCode];
};

const CMP = (address) => {
  // CMP                CMP Compare memory and accumulator                 CMP
  // Operation:  A - M                                     S Z C I D V
  //                                                       / / / _ _ _
  const memValue = read(address);

  if (registers.accumulator >= memValue) { setFlagBit(C); } else { clearFlagBit(C); }
  if (registers.accumulator === memValue) { setFlagBit(Z); } else { clearFlagBit(Z); }

  testAndSetSign(registers.accumulator - memValue);

  registers.pc += OP_BYTES[opCode];
};

const CPX = (address) => {
  // CPX                  CPX Compare memory and index X                   CPX
  // Operation:  X - M                                    S Z C I D V
  //                                                      / / / _ _ _
  const memValue = read(address);

  if (registers.regX >= memValue) { setFlagBit(C); } else { clearFlagBit(C); }
  if (registers.regX === memValue) { setFlagBit(Z); } else { clearFlagBit(Z); }

  testAndSetSign(registers.regX - memValue);

  registers.pc += OP_BYTES[opCode];
};

const CPY = (address) => {
  // CPY                  CPY Compare memory and index Y                   CPY
  // Operation:  Y - M                                    S Z C I D V
  //                                                      / / / _ _ _
  const memValue = read(address);

  if (registers.regY >= memValue) { setFlagBit(C); } else { clearFlagBit(C); }
  if (registers.regY === memValue) { setFlagBit(Z); } else { clearFlagBit(Z); }

  testAndSetSign(registers.regY - memValue);

  registers.pc += OP_BYTES[opCode];
};

const DEC = (address) => {
  // DEC                   DEC Decrement memory by one                     DEC
  // Operation:  M - 1 -> M                                S Z C I D V
  //                                                       / / _ _ _ _
  const memValue = read(address);
  const result   = memValue - 1;

  testAndSetSign(result);
  testAndSetZero(result);
  write(address, result);

  registers.pc += OP_BYTES[opCode];
};

const DEX = () => {
  // DEX                    DEX Decrement Index X by one                   DEX
  // Operation:  X - 1 -> X                                S Z C I D V
  //                                                       / / _ _ _ _
  registers.regX = (registers.regX - 1) & 0xFF;
  testAndSetZero(registers.regX);
  testAndSetSign(registers.regX);

  registers.pc += OP_BYTES[opCode];
};

const DEY = () => {
  // DEY                    DEY Decrement Index Y by one                   DEY
  // Operation:  Y - 1 -> Y                                S Z C I D V
  //                                                       / / _ _ _ _
  registers.regY = (registers.regY - 1) & 0xFF;
  testAndSetZero(registers.regY);
  testAndSetSign(registers.regY);

  registers.pc += OP_BYTES[opCode];
};

const EOR = (address) => {
  // EOR            EOR "Exclusive-Or" memory with accumulator             EOR
  // Operation:  A EOR M -> A                              S Z C I D V
  //                                                       / / _ _ _ _
  const memValue = read(address);
  const result   = registers.accumulator ^ memValue;

  testAndSetZero(result);
  testAndSetSign(result);
  write('accumulator', result);

  registers.pc += OP_BYTES[opCode];
};

const INC = (address) => {
  // INC                    INC Increment memory by one                    INC
  // Operation:  M + 1 -> M                                S Z C I D V
  //                                                       / / _ _ _ _
  const memValue = read(address);
  const result = memValue + 1;

  testAndSetZero(result);
  testAndSetSign(result);
  write(address, result);

  registers.pc += OP_BYTES[opCode];
};

const INX = () => {
  // INX                    INX Increment Index X by one                   INX
  // Operation:  X + 1 -> X                                S Z C I D V
  //                                                       / / _ _ _ _
  registers.regX = (registers.regX + 1) & 0xFF;
  testAndSetZero(registers.regX);
  testAndSetSign(registers.regX);

  registers.pc += OP_BYTES[opCode];
};

const INY = () => {
  // INY                    INY Increment Index Y by one                   INY
  // Operation:  Y + 1 -> Y                                S Z C I D V
  //                                                       / / _ _ _ _
  registers.regY = (registers.regY + 1) & 0xFF;
  testAndSetZero(registers.regY);
  testAndSetSign(registers.regY);

  registers.pc += OP_BYTES[opCode];
};

const LDA = (address) => {
  // LDA                  LDA Load accumulator with memory                 LDA
  // Operation:  M -> A                                    S Z C I D V
  //                                                       / / _ _ _ _
  const memValue = read(address);

  testAndSetZero(memValue);
  testAndSetSign(memValue);

  write('accumulator', memValue);
  registers.pc += OP_BYTES[opCode];
};

const LDX = (address) => {
  // LDX                   LDX Load index X with memory                    LDX
  // Operation:  M -> X                                    S Z C I D V
  //                                                       / / _ _ _ _
  const memValue = read(address);

  testAndSetZero(memValue);
  testAndSetSign(memValue);

  registers.regX = memValue & 0xFF;
  registers.pc += OP_BYTES[opCode];

};

const LDY = (address) => {
  // LDY                   LDY Load index Y with memory                    LDY
  // Operation: M -> Y                                     S Z C I D V
  //                                                       / / _ _ _ _
  const memValue = read(address);

  testAndSetZero(memValue);
  testAndSetSign(memValue);

  registers.regY = memValue & 0xFF;
  registers.pc += OP_BYTES[opCode];

};

const LSR = (address) => {
  // LSR          LSR Shift right one bit (memory or accumulator)          LSR
  //                  +-+-+-+-+-+-+-+-+
  // Operation:  0 -> |7|6|5|4|3|2|1|0| -> C               S Z C I D V
  //                  +-+-+-+-+-+-+-+-+                    0 / / _ _ _
  const memValue = read(address);
  const result   = memValue >> 1;
  const c        = (memValue >> 0) & 1;

  testAndSetZero(result);
  testAndSetSign(result);
  if (c) { setFlagBit(C); } else { clearFlagBit(C); }
  write(address, result);

  registers.pc += OP_BYTES[opCode];
};

const JMP = (address) => {
  // JMP                     JMP Jump to new location                      JMP
  // Operation:  (PC + 1) -> PCL                           S Z C I D V
  //             (PC + 2) -> PCH                           _ _ _ _ _ _
  registers.pc = address;
};

const JSR = (address) => {
  // JSR          JSR Jump to new location saving return address           JSR
  // Operation:  PC + 2 toS, (PC + 1) -> PCL               S Z C I D V
  //                         (PC + 2) -> PCH               _ _ _ _ _ _
  const pc = registers.pc + 2;
  push((pc >> 8) & 0xFF); // high byte
  push(pc & 0xFF);        // low byte

  registers.pc = address;
};

const NOP = () => {
  // NOP                         NOP No operation                          NOP
  //                                                       S Z C I D V
  // Operation:  No Operation (2 cycles)                   _ _ _ _ _ _

  registers.pc += OP_BYTES[opCode];
};

const ORA = (address) => {
  // ORA                 ORA "OR" memory with accumulator                  ORA
  // Operation: A | M -> A                                 S Z C I D V
  //                                                       / / _ _ _ _
  const memValue = read(address);
  const result = registers.accumulator | memValue;

  testAndSetSign(result);
  testAndSetZero(result);

  write('accumulator', result);
  registers.pc += OP_BYTES[opCode];
};

const PHA = () => {
  // PHA                   PHA Push accumulator on stack                   PHA
  // Operation:  A toS                                     S Z C I D V
  //                                                       _ _ _ _ _ _
  push(registers.accumulator);
  registers.pc += OP_BYTES[opCode];
};

const PHP = () => {
  // PHP                 PHP Push processor status on stack                PHP
  // Operation:  P toS                                     S Z C I D V
  //                                                       _ _ _ _ _ _
  push(registers.flags | 0x10); // set break flag on pushed flag

  registers.pc += OP_BYTES[opCode];
};

const PLA = () => {
  // PLA                 PLA Pull accumulator from stack                   PLA
  // Operation:  A fromS                                   S Z C I D V
  //                                                       / / _ _ _ _
  const result = pull();
  testAndSetZero(result);
  testAndSetSign(result);

  write('accumulator', result);

  registers.pc += OP_BYTES[opCode];
};

const PLP = () => {
  // PLP               PLP Pull processor status from stack                PLA
  // Operation:  P fromS                                   S Z C I D V
  //                                                       From Stack
  registers.flags = pull();
  clearFlagBit(4);
  setFlagBit(5); // Should alwasy be set

  registers.pc += OP_BYTES[opCode];
};

const ROL = (address) => {
  // ROL          ROL Rotate one bit left (memory or accumulator)          ROL
  //              +------------------------------+
  //              |         M or A               |
  //              |   +-+-+-+-+-+-+-+-+    +-+   |
  // Operation:   +-< |7|6|5|4|3|2|1|0| <- |C| <-+         S Z C I D V
  //                  +-+-+-+-+-+-+-+-+    +-+             / / / _ _ _
  const memValue = read(address);
  const result   = ((memValue << 1) | getFlag(C)) & 0xFF;
  const c        = (memValue >> 7) & 1;

  if (c) { setFlagBit(C); } else { clearFlagBit(C); }
  testAndSetZero(result);
  testAndSetSign(result);

  write(address, result);

  registers.pc += OP_BYTES[opCode];
};

const ROR = (address) => {
  // ROR          ROR Rotate one bit right (memory or accumulator)         ROR
  //              +------------------------------+
  //              |                              |
  //              |   +-+    +-+-+-+-+-+-+-+-+   |
  // Operation:   +-> |C| -> |7|6|5|4|3|2|1|0| >-+         S Z C I D V
  //                  +-+    +-+-+-+-+-+-+-+-+             / / / _ _ _
  const memValue = read(address);
  const result   = ((memValue >> 1) | ((getFlag(C) << 7) & 0xFF));
  const c        = (memValue >> 0) & 1;

  if (c) { setFlagBit(C); } else { clearFlagBit(C); }
  testAndSetZero(result);
  testAndSetSign(result);

  write(address, result);

  registers.pc +=OP_BYTES[opCode];
};

const RTI = () => {
  // RTI                    RTI Return from interrupt                      RTI
  // Operation:  P fromS PC fromS                         S Z C I D V
  //                                                      From Stack
  registers.flags = pull();
  setFlagBit(5);

  const low  = pull();
  const high = pull();
  const word = (high << 8) | low;

  registers.pc = word;
};

const RTS = () => {
  // RTS                    RTS Return from subroutine                     RTS
  //                                                       S Z C I D V
  // Operation:  PC fromS, PC + 1 -> PC                    _ _ _ _ _ _
  const low  = pull();
  const high = pull();
  const word = (high << 8) | low;

  registers.pc = word;
  registers.pc += OP_BYTES[opCode];
};

const SBC = (address) => {
  // SBC          SBC Subtract memory from accumulator with borrow         SBC
  // Operation:  A - M - C -> A                            S Z C I D V
  //                                                       / / / _ _ /
  const memValue = read(address);
  const result = registers.accumulator - memValue - (!getFlag(C));

  testAndSetSign(result);
  testAndSetZero(result);

  // http://www.righto.com/2012/12/the-6502-overflow-flag-explained.html
  // Set V is bit 7 doesn't match
  const v1 = (registers.accumulator >> 7) & 1;
  const v2 = (memValue >> 7) & 1;
  if (v1 !== v2) { setFlagBit(V); } else { clearFlagBit(V); }

  if (result >= 0 && result <= 255) {
    setFlagBit(C);
  } else {
    clearFlagBit(C);
  }

  write('accumulator', result);
  registers.pc += OP_BYTES[opCode];
};

const SEC = () => {
  // SEC                        SEC Set carry flag                         SEC
  //                                                       S Z C I D V
  // Operation:  1 -> C                                    _ _ 1 _ _ _
  setFlagBit(C);

  registers.pc += OP_BYTES[opCode];
};

const SED = () => {
  // SED                       SED Set decimal mode                        SED
  //                                                       S Z C I D V
  // Operation:  1 -> D                                    _ _ _ _ 1 _
  setFlagBit(D);

  registers.pc += OP_BYTES[opCode];
};

const SEI = () => {
  // SEI                 SEI Set interrupt disable status                  SED
  //                                                       S Z C I D V
  // Operation:  1 -> I                                    _ _ _ 1 _ _
  setFlagBit(I);

  registers.pc += OP_BYTES[opCode];
};

const STA = (address) => {
  // STA                  STA Store accumulator in memory                  STA
  // Operation:  A -> M                                    S Z C I D V
  //                                                       _ _ _ _ _ _
  write(address, registers.accumulator);
  registers.pc += OP_BYTES[opCode];
};

const STX = (address) => {
  // STX                    STX Store index X in memory                    STX
  // Operation: X -> M                                     S Z C I D V
  //                                                       _ _ _ _ _ _
  write(address, registers.regX);
  registers.pc += OP_BYTES[opCode];
};

const STY = (address) => {
  // STY                    STY Store index Y in memory                    STY
  // Operation: Y -> M                                     S Z C I D V
  //                                                       _ _ _ _ _ _
  write(address, registers.regY);
  registers.pc += OP_BYTES[opCode];
};

const TAX = () => {
  // TAX                TAX Transfer accumulator to index X                TAX
  // Operation:  A -> X                                    S Z C I D V
  //                                                       / / _ _ _ _
  registers.regX = registers.accumulator;
  testAndSetSign(registers.regX);
  testAndSetZero(registers.regX);

  registers.pc += OP_BYTES[opCode];
};

const TAY = () => {
  // TAY                TAY Transfer accumulator to index Y                TAY
  // Operation:  A -> Y                                    S Z C I D V
  //                                                       / / _ _ _ _
  registers.regY = registers.accumulator;
  testAndSetSign(registers.regY);
  testAndSetZero(registers.regY);

  registers.pc += OP_BYTES[opCode];
};

const TSX = () => {
  // TSX              TSX Transfer stack pointer to index X                TSX
  // Operation:  S -> X                                    S Z C I D V
  //                                                       / / _ _ _ _
  registers.regX = registers.sp;
  testAndSetSign(registers.regX);
  testAndSetZero(registers.regX);

  registers.pc += OP_BYTES[opCode];
};

const TXA = () => {
  // TXA                TYX Transfer index X to accumulator                TYX
  // Operation:  X -> A                                    S Z C I D V
  //                                                       / / _ _ _ _
  registers.accumulator = registers.regX;
  testAndSetSign(registers.accumulator);
  testAndSetZero(registers.accumulator);

  registers.pc += OP_BYTES[opCode];
};

const TXS = () => {
  // TXS              TXS Transfer index X to stack pointer                TXS
  // Operation:  X -> S                                    S Z C I D V
  //                                                       _ _ _ _ _ _
  registers.sp = registers.regX;

  registers.pc += OP_BYTES[opCode];
};

const TYA = () => {
  // TYA                TYA Transfer index Y to accumulator                TYA
  // Operation:  Y -> A                                    S Z C I D V
  //                                                       / / _ _ _ _
  registers.accumulator = registers.regY;
  testAndSetSign(registers.accumulator);
  testAndSetZero(registers.accumulator);

  registers.pc += OP_BYTES[opCode];
};



const reset = (bus) => {
  mmu = bus.mmu;
  registers.pc = (mmu.read(0xFFFD) << 8) | mmu.read(0xFFFC);
  registers.sp = 0xFD;
  registers.flags = 0x24;
};


let stepCount = 1;
/* EXECUTE */
const step = () => {
  cycles = 0;
  // Perform interrupt request before instructions
  // If I is set then only NMI happens, ignore IRQ?
  if (interrupt.requested) {
    // NMI, IRQ, RESET
    if (interrupt.type === 'NMI') { NMI(); interrupt.requested = false; }
    // Check if interrupt ignore flag (SEI) is set
    else if (interrupt.type === 'IRQ' && !I) { IRQ(); interrupt.requested = false; }
  }

  opCode = mmu.read(registers.pc);
  /*
  console.log(stepCount + ': ' +
      registers.pc.toString(16) +
      ' OP: ' + opCode.toString(16) +
      ' A: ' + registers.accumulator.toString(16) +
      ' X: ' + registers.regX.toString(16) +
      ' Y: ' + registers.regY.toString(16) +
      ' P: ' + registers.flags.toString(16) +
      ' SP: ' + registers.sp.toString(16) +
      ' cyc: ' + (cycles * 3) % 341
      );
  stepCount += 1;
  */


  // JSPerf says switch is 66% faster than a map
  switch (opCode) {
    case 0x00:
      cycles += 7; BRK(); break;
    case 0x01:
      cycles += 6; ORA(indirectX()); break;
    case 0x05:
      cycles += 3; ORA(zeroPage()); break;
    case 0x06:
      cycles += 5; ASL(zeroPage()); break;
    case 0x08:
      cycles += 3; PHP(); break;
    case 0x09:
      cycles += 2; ORA(immediate()); break;
    case 0x0A:
      cycles += 2; ASL(accumulator()); break;
    case 0x0D:
      cycles += 4; ORA(absolute()); break;
    case 0x0E:
      cycles += 6; ASL(absolute()); break;
    case 0x10:
      cycles += 2; BPL(relative()); break;
    case 0x11:
      indirectY_pageBoundry(); cycles += 5; ORA(indirectY()); break;
    case 0x15:
      cycles += 4; ORA(zeroPageX()); break;
    case 0x16:
      cycles += 6; ASL(zeroPageX()); break;
    case 0x18:
      cycles += 2; CLC(); break;
    case 0x19:
      absoluteY_pageBoundry(); cycles += 4; ORA(absoluteY()); break;
    case 0x1D:
      absoluteX_pageBoundry(); cycles += 4; ORA(absoluteX()); break;
    case 0x1E:
      cycles += 7; ASL(absoluteX()); break;
    case 0x20:
      cycles += 6; JSR(absolute()); break;
    case 0x21:
      cycles += 6; AND(indirectX()); break;
    case 0x24:
      cycles += 3; BIT(zeroPage()); break;
    case 0x25:
      cycles += 3; AND(zeroPage()); break;
    case 0x26:
      cycles += 5; ROL(zeroPage()); break;
    case 0x28:
      cycles += 4; PLP(); break;
    case 0x29:
      cycles += 2; AND(immediate()); break;
    case 0x2A:
      cycles += 2; ROL(accumulator()); break;
    case 0x2C:
      cycles += 4; BIT(absolute()); break;
    case 0x2D:
      cycles += 4; AND(absolute()); break;
    case 0x2E:
      cycles += 6; ROL(absolute()); break;
    case 0x30:
      cycles += 2; BMI(relative()); break;
    case 0x31:
      indirectY_pageBoundry(); cycles += 5; AND(indirectY()); break;
    case 0x35:
      cycles += 4; AND(zeroPageX()); break;
    case 0x36:
      cycles += 6; ROL(zeroPageX()); break;
    case 0x38:
      cycles += 2; SEC(); break;
    case 0x39:
      absoluteY_pageBoundry(); cycles += 4; AND(absoluteY()); break;
    case 0x3D:
      absoluteX_pageBoundry(); cycles += 4; AND(absoluteX()); break;
    case 0x3E:
      cycles += 7; ROL(absoluteX()); break;
    case 0x40:
      cycles += 6; RTI(); break;
    case 0x41:
      cycles += 6; EOR(indirectX()); break;
    case 0x45:
      cycles += 3; EOR(zeroPage()); break;
    case 0x46:
      cycles += 5; LSR(zeroPage()); break;
    case 0x48:
      cycles += 3; PHA(); break;
    case 0x49:
      cycles += 2; EOR(immediate()); break;
    case 0x4A:
      cycles += 2; LSR(accumulator()); break;
    case 0x4C:
      cycles += 3; JMP(absolute()); break;
    case 0x4D:
      cycles += 4; EOR(absolute()); break;
    case 0x4E:
      cycles += 6; LSR(absolute()); break;
    case 0x50:
      cycles += 2; BVC(relative()); break;
    case 0x51:
      indirectY_pageBoundry(); cycles += 5; EOR(indirectY());
      break;
    case 0x55:
      cycles += 4; EOR(zeroPageX()); break;
    case 0x56:
      cycles += 6; LSR(zeroPageX()); break;
    case 0x58:
      cycles += 2; CLI(); break;
    case 0x59:
      absoluteY_pageBoundry(); cycles += 4; EOR(absoluteY()); break;
    case 0x5D:
      absoluteX_pageBoundry(); cycles += 4; EOR(absoluteX()); break;
    case 0x5E:
      cycles += 7; LSR(absoluteX()); break;
    case 0x60:
      cycles += 6; RTS(); break;
    case 0x61:
      cycles += 6; ADC(indirectX()); break;
    case 0x65:
      cycles += 3; ADC(zeroPage()); break;
    case 0x66:
      cycles += 5; ROR(zeroPage()); break;
    case 0x68:
      cycles += 4; PLA(); break;
    case 0x69:
      cycles += 2; ADC(immediate()); break;
    case 0x6A:
      cycles += 2; ROR(accumulator()); break;
    case 0x6C:
      cycles += 5; JMP(indirect()); break;
    case 0x6D:
      cycles += 4; ADC(absolute()); break;
    case 0x6E:
      cycles += 6; ROR(absolute()); break;
    case 0x70:
      cycles += 2; BVS(relative()); break;
    case 0x71:
      indirectY_pageBoundry(); cycles += 5; ADC(indirectY()); break;
    case 0x75:
      cycles += 4; ADC(zeroPageX()); break;
    case 0x76:
      cycles += 6; ROR(zeroPageX()); break;
    case 0x78:
      cycles += 2; SEI(); break;
    case 0x79:
      absoluteY_pageBoundry(); cycles += 4; ADC(absoluteY()); break;
    case 0x7D:
      absoluteX_pageBoundry(); cycles += 4; ADC(absoluteX()); break;
    case 0x7E:
      cycles += 7; ROR(absoluteX()); break;
    case 0x81:
      cycles += 6; STA(indirectX()); break;
    case 0x84:
      cycles += 3; STY(zeroPage()); break;
    case 0x85:
      cycles += 3; STA(zeroPage()); break;
    case 0x86:
      cycles += 3; STX(zeroPage()); break;
    case 0x88:
      cycles += 2; DEY(); break;
    case 0x8A:
      cycles += 2; TXA(); break;
    case 0x8C:
      cycles += 4; STY(absolute()); break;
    case 0x8D:
      cycles += 4; STA(absolute()); break;
    case 0x8E:
      cycles += 4; STX(absolute()); break;
    case 0x90:
      cycles += 2; BCC(relative()); break;
    case 0x91:
      cycles += 6; STA(indirectY()); break;
    case 0x94:
      cycles += 4; STY(zeroPageX()); break;
    case 0x95:
      cycles += 4; STA(zeroPageX()); break;
    case 0x96:
      cycles += 4; STX(zeroPageY()); break;
    case 0x98:
      cycles += 2; TYA(); break;
    case 0x99:
      cycles += 5; STA(absoluteY()); break;
    case 0x9A:
      cycles += 2; TXS(); break;
    case 0x9D:
      cycles += 5; STA(absoluteX()); break;
    case 0xA0:
      cycles += 2; LDY(immediate()); break;
    case 0xA1:
      cycles += 6; LDA(indirectX()); break;
    case 0xA2:
      cycles += 2; LDX(immediate()); break;
    case 0xA4:
      cycles += 3; LDY(zeroPage()); break;
    case 0xA5:
      cycles += 3; LDA(zeroPage()); break;
    case 0xA6:
      cycles += 3; LDX(zeroPage()); break;
    case 0xA8:
      cycles += 2; TAY(); break;
    case 0xA9:
      cycles += 2; LDA(immediate()); break;
    case 0xAA:
      cycles += 2; TAX(); break;
    case 0xAC:
      cycles += 4; LDY(absolute()); break;
    case 0xAD:
      cycles += 4; LDA(absolute()); break;
    case 0xAE:
      cycles += 4; LDX(absolute()); break;
    case 0xB0:
      cycles += 2; BCS(relative()); break;
    case 0xB1:
      indirectY_pageBoundry(); cycles += 5; LDA(indirectY()); break;
    case 0xB4:
      cycles += 4; LDY(zeroPageX()); break;
    case 0xB5:
      cycles += 4; LDA(zeroPageX()); break;
    case 0xB6:
      cycles += 4; LDX(zeroPageY()); break;
    case 0xB8:
      cycles += 2; CLV(); break;
    case 0xB9:
      absoluteY_pageBoundry(); cycles += 4; LDA(absoluteY()); break;
    case 0xBD:
      absoluteX_pageBoundry(); cycles += 4; LDA(absoluteX()); break;
    case 0xBE:
      absoluteY_pageBoundry(); cycles += 4; LDX(absoluteY()); break;
    case 0xBA:
      cycles += 2; TSX(); break;
    case 0xBC:
      absoluteX_pageBoundry(); cycles += 4; LDY(absoluteX()); break;
    case 0xC0:
      cycles += 2; CPY(immediate()); break;
    case 0xC1:
      cycles += 6; CMP(indirectX()); break;
    case 0xC4:
      cycles += 3; CPY(zeroPage()); break;
    case 0xC5:
      cycles += 3; CMP(zeroPage()); break;
    case 0xC6:
      cycles += 5; DEC(zeroPage()); break;
    case 0xC8:
      cycles += 2; INY(); break;
    case 0xC9:
      cycles += 2; CMP(immediate()); break;
    case 0xCA:
      cycles += 2; DEX(); break;
    case 0xCC:
      cycles += 4; CPY(absolute()); break;
    case 0xCD:
      cycles += 4; CMP(absolute()); break;
    case 0xCE:
      cycles += 6; DEC(absolute()); break;
    case 0xD0:
      cycles += 2; BNE(relative()); break;
    case 0xD1:
      indirectY_pageBoundry(); cycles += 5; CMP(indirectY()); break;
    case 0xD5:
      cycles += 4; CMP(zeroPageX()); break;
    case 0xD6:
      cycles += 6; DEC(zeroPageX()); break;
    case 0xD8:
      cycles += 2; CLD(); break;
    case 0xD9:
      absoluteY_pageBoundry(); cycles += 4; CMP(absoluteY()); break;
    case 0xDD:
      absoluteX_pageBoundry(); cycles += 4; CMP(absoluteX()); break;
    case 0xDE:
      cycles += 7; DEC(absoluteX()); break;
    case 0xE0:
      cycles += 2; CPX(immediate()); break;
    case 0xE1:
      cycles += 6; SBC(indirectX()); break;
    case 0xE4:
      cycles += 3; CPX(zeroPage()); break;
    case 0xE5:
      cycles += 3; SBC(zeroPage()); break;
    case 0xE6:
      cycles += 5; INC(zeroPage()); break;
    case 0xE8:
      cycles += 2; INX(); break;
    case 0xE9:
      cycles += 2; SBC(immediate()); break;
    case 0xEA:
      cycles += 2; NOP(); break;
    case 0xEC:
      cycles += 4; CPX(absolute()); break;
    case 0xED:
      cycles += 4; SBC(absolute()); break;
    case 0xEE:
      cycles += 6; INC(absolute()); break;
    case 0xF0:
      cycles += 2; BEQ(relative()); break;
    case 0xF1:
      indirectY_pageBoundry(); cycles += 5; SBC(indirectY()); break;
    case 0xF5:
      cycles += 4; SBC(zeroPageX()); break;
    case 0xF6:
      cycles += 6; INC(zeroPageX()); break;
    case 0xF8:
      cycles += 2; SED(); break;
    case 0xF9:
      absoluteY_pageBoundry(); cycles += 4; SBC(absoluteY()); break;
    case 0xFD:
      absoluteX_pageBoundry(); cycles += 4; SBC(absoluteX()); break;
    case 0xFE:
      cycles += 7; INC(absoluteX()); break;
    default:
      console.log('ugh oh', mmu.read(0x02), mmu.read(0x03));
      console.log('UKN OP: ' + '0x' + opCode.toString(16));
      console.log('Bytes : ' + OP_BYTES[opCode]);
      console.log('Registers: ', registers);
      console.log('Cycles: ', cycles);
      throw new Error('UKN OP!');
  }


};


export default { step, reset, cycles, requestInterrupt };
