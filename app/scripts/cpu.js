(function() {

  'use strict';

  var cpu = {};

  /* REGISTERS */
  /* Program Counter is 16 bits wide */
  cpu.pc = 0xC000;

  /* Stack Pointer
   * Least significant byte of address starting at offset 0x100
   * [0x100 - 0x1FF]
   * Grows down in space, pushing decrements, popping increments
   * */
  cpu.sp = 0xFD;

  cpu.push = function(value) {
    nes.memory.write((0x100 + cpu.sp), value);
    cpu.sp--;
  };

  cpu.pull = function() {
    cpu.sp++;
    return nes.memory.read(0x100 + cpu.sp);
  };

  cpu.accumulator = 0;
  cpu.regX = 0;
  cpu.regY = 0;

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
  cpu.flags = 0;
  var C = 0,
      Z = 1,
      I = 2,
      D = 3,
      B = 4,
      V = 6,
      S = 7;

  var getFlag = function(mask) {
    return (cpu.flags >> mask) & 1;
  };

  var clearFlagBit = function(mask) {
   mask = 1 << mask;
   cpu.flags &= ~mask;
  };

  var setFlagBit = function(mask) {
    mask = 1 << mask;
    cpu.flags |= mask;
  };

  var testAndSetFlag = function(flag, arg1, arg2, arg3) {
    switch(flag) {
      case C:
        if (arg1 > 255 || arg1 <= 0) {
          setFlagBit(C);
        } else {
          clearFlagBit(C);
        }
        break;

      case Z:
        if ((arg1 & 0xFF) === 0) {
          setFlagBit(Z);
        } else {
          clearFlagBit(Z);
        }
        break;

      case V:
        var v1 = (arg1 >> 7) & 1;
        var v2 = (arg2 >> 7) & 1;
        var r  = ((arg3 & 0xFF) >> 7) & 1;

        if ((r === v1) || (r === v2)) {
          clearFlagBit(V);
        } else {
          setFlagBit(V);
        }
        break;

      case S:
        var n = ((arg1 & 0xFF) >> 7) & 1;
        if (n) {
          setFlagBit(S);
        } else {
          clearFlagBit(S);
        }
        break;
    }
  };



  /* COUNTERS */
  var cycles = 0;


  /* HELPERS */
  var toSignedInt = function(n) {
    var halfN = 127;
    var num = halfN * 2;
    return (n + halfN) % num - halfN;
  };

  cpu.getCurrentByte = function() {
    return nes.memory.read(cpu.pc);
  };

  cpu.getNextByte = function() {
    return nes.memory.read(cpu.pc + 1);
  };

  cpu.getNextWord = function() {
    var low  = nes.memory.read(cpu.pc + 1);
    var high = nes.memory.read(cpu.pc + 2);
    var word = (high << 8) | low;
    return word;
  };

  /* ADDRESS MODES */
  var read = function(address) {
    switch (address) {
      case 'accumulator':
        return cpu.accumulator;
      case 'immediate':
        return cpu.getNextByte();
      default:
        return nes.memory.read(address);
    }
  };

  var write = function(address, value) {
    switch (address) {
      case 'accumulator':
        cpu.accumulator = value & 0xFF;
        break;
      case 'immediate':
        nes.memory.write(cpu.getNextByte(), value);
        break;
      default:
        nes.memory.write(address, value);
    }
  };

  var accumulator = function() {
    return 'accumulator';
  };

  var absolute = function() {
    return cpu.getNextWord();
  };

  var absoluteX = function() {
    return cpu.getNextWord() + cpu.regX;
  };

  var absoluteY = function() {
    return cpu.getNextWord() + cpu.regY;
  };

  var immediate = function() {
    return 'immediate';
  };

  // implied/implicit
  // ie return from subroutine, clear flag...
  // nothing to do

  var indirect = function() {
    var lowAddress = cpu.getNextWord();
    var low  = read(lowAddress);

    // Check for page boundry
    var high;
    if ((lowAddress & 0xFF) === 0xFF) {
      high = read((lowAddress >> 8) << 8);
    } else {
      high = read(lowAddress + 1);
    }

    return (high << 8) | low;
  };

  var indirectX = function() {
    var lowAddress = cpu.getNextByte() + cpu.regX;
    var low  = read(lowAddress & 0xFF);
    var high = read((lowAddress + 1) & 0xFF);
    var word = (high << 8) | low;

    return word;
  };

  var indirectY = function() {
    var lowAddress = cpu.getNextByte();
    var low  = read(lowAddress & 0xFF);
    var high = read((lowAddress + 1) & 0xFF);
    var word = (high << 8) | low;

    return (word + cpu.regY) & 0xFFFF;
  };

  var relative = function() {
    return cpu.getNextByte();
  };

  var zeroPage = function() {
    return cpu.getNextByte();
  };

  var zeroPageX = function() {
    return (cpu.getNextByte() + cpu.regX) % 0xFF;
  };

  var zeroPageY = function() {
    return (cpu.getNextByte() + cpu.regY) % 0xFF;
  };

  /* OPCODES */

  var ADC = function(address) {
  // ADC               Add memory to accumulator with carry                ADC
  // Operation:  A + M + C -> A, C                         S Z C I D V
  //                                                       / / / _ _ /
    var memValue = read(address);
    var result   = memValue + cpu.accumulator + getFlag(C);

    testAndSetFlag(S, result);
    testAndSetFlag(Z, result);
    testAndSetFlag(C, result);
    testAndSetFlag(V, memValue, cpu.accumulator, result);

    write('accumulator', result);
    cpu.pc += OP_BYTES[cpu.op];
  };

  var AND = function(address) {
  // AND                  "AND" memory with accumulator                    AND
  // Operation:  A & M -> A                                S Z C I D V
  //                                                       / / _ _ _ _
    var memValue = read(address);
    var result   = memValue & cpu.accumulator;

    testAndSetFlag(S, result);
    testAndSetFlag(Z, result);

    write('accumulator', result);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var ASL = function(address) {
  // ASL          ASL Shift Left One Bit (Memory or Accumulator)           ASL
  //                  +-+-+-+-+-+-+-+-+
  // Operation:  C <- |7|6|5|4|3|2|1|0| <- 0
  //                  +-+-+-+-+-+-+-+-+                    S Z C I D V
  //                                                       / / / _ _ _
    var memValue  = read(address);
    var result    = (memValue << 1) & 0xFF;
    var c         = (memValue >> 7) & 1;

    if (c) { setFlagBit(C); } else { clearFlagBit(C); }
    testAndSetFlag(S, result);
    testAndSetFlag(Z, result);

    write(address, result);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var BCC = function(address) {
  // BCC                     BCC Branch on Carry Clear                     BCC
  //                                                       S Z C I D V
  // Operation:  Branch on C = 0                           _ _ _ _ _ _
    var value = address;
    if (!getFlag(C)) {
      cpu.pc += toSignedInt(value);
    }

    cpu.pc += OP_BYTES[cpu.op];
  };

  var BCS = function(address) {
  //  BCS                      BCS Branch on carry set                      BCS
  // Operation:  Branch on C = 1                           S Z C I D V
  //                                                       _ _ _ _ _ _
    var value = address;
    if (getFlag(C)) {
      cpu.pc += toSignedInt(value);
    }

    cpu.pc += OP_BYTES[cpu.op];
  };

  var BEQ = function(address) {
  // BEQ                    BEQ Branch on result zero                      BEQ
  //                                                       S Z C I D V
  // Operation:  Branch on Z = 1                           _ _ _ _ _ _
    var value = address;
    if (getFlag(Z)) {
      cpu.pc += toSignedInt(value);
    }

    cpu.pc += OP_BYTES[cpu.op];
  };

  var BIT = function(address) {
  // BIT             BIT Test bits in memory with accumulator              BIT
  // Operation:  A & M, M7 -> S, M6 -> V

  // Bit 6 and 7 are transferred to the status register.   S Z C I D V
  // If the result of A & M is zero then Z = 1, otherwise M7 / _ _ _ M6
    var memValue = read(address);
    var result   = cpu.accumulator & memValue;

    var v = (memValue >> 6) & 1;
    if (v) { setFlagBit(V); } else { clearFlagBit(V); }

    var s = (memValue >> 7) & 1;
    if (s) { setFlagBit(S); } else { clearFlagBit(S); }

    testAndSetFlag(Z, result);

    cpu.pc += OP_BYTES[cpu.op];

  };

  var BMI = function(address) {
  // BMI                    BMI Branch on result minus                     BMI
  // Operation:  Branch on N = 1                           S Z C I D V
  //                                                       _ _ _ _ _ _
    var value = address;
    if (getFlag(S)) {
      cpu.pc += toSignedInt(value);
    }

    cpu.pc += OP_BYTES[cpu.op];
  };

  var BNE = function(address) {
  // BNE                   BNE Branch on result not zero                   BNE
  // Operation:  Branch on Z = 0                           S Z C I D V
  //                                                       _ _ _ _ _ _
    var value = address;
    if (!getFlag(Z)) {
      cpu.pc += toSignedInt(value);
    }

    cpu.pc += OP_BYTES[cpu.op];
  };

  var BPL = function(address) {
  // BPL                     BPL Branch on result plus                     BPL
  // Operation:  Branch on S = 0                           S Z C I D V
  //                                                       _ _ _ _ _ _
    var value = address;
    if (!getFlag(S)) {
      cpu.pc += toSignedInt(value);
    }

    cpu.pc += OP_BYTES[cpu.op];
  };

  var BVC = function(address) {
  // BVC                    BVC Branch on overflow clear                   BVC
  // Operation:  Branch on V = 0                           S Z C I D V
  //                                                       _ _ _ _ _ _
    var value = address;
    if (!getFlag(V)) {
      cpu.pc += toSignedInt(value);
    }

    cpu.pc += OP_BYTES[cpu.op];
  };

  var BVS = function(address) {
  // BVS                    BVS Branch on overflow set                     BVS
  // Operation:  Branch on V = 1                           S Z C I D V
  //                                                       _ _ _ _ _ _
    var value = address;
    if (getFlag(V)) {
      cpu.pc += toSignedInt(value);
    }

    cpu.pc += OP_BYTES[cpu.op];
  };

  var CLC = function() {
  // CLC                       CLC Clear carry flag                        CLC
  // Operation:  0 -> C                                    S Z C I D V
  //                                                       _ _ 0 _ _ _
    clearFlagBit(C);
    cpu.pc += OP_BYTES[cpu.op];
  };

  var CLD = function() {
  // CLD                      CLD Clear decimal mode                       CLD
  // Operation:  0 -> D                                    S A C I D V
  //                                                       _ _ _ _ 0 _
    clearFlagBit(D);
    cpu.pc += OP_BYTES[cpu.op];
  };

  var CLV = function() {
  // CLV                      CLV Clear overflow flag                      CLV
  // Operation: 0 -> V                                     S Z C I D V
  //                                                       _ _ _ _ _ 0
    clearFlagBit(V);
    cpu.pc += OP_BYTES[cpu.op];
  };

  var CMP = function(address) {
  // CMP                CMP Compare memory and accumulator                 CMP
  // Operation:  A - M                                     S Z C I D V
  //                                                       / / / _ _ _
    var memValue = read(address);

    if (cpu.accumulator >= memValue) { setFlagBit(C); } else { clearFlagBit(C); }
    if (cpu.accumulator === memValue) { setFlagBit(Z); } else { clearFlagBit(Z); }

    testAndSetFlag(S, cpu.accumulator - memValue);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var CPX = function(address) {
  // CPX                  CPX Compare memory and index X                   CPX
  // Operation:  X - M                                    S Z C I D V
  //                                                      / / / _ _ _
    var memValue = read(address);

    if (cpu.regX >= memValue) { setFlagBit(C); } else { clearFlagBit(C); }
    if (cpu.regX === memValue) { setFlagBit(Z); } else { clearFlagBit(Z); }

    testAndSetFlag(S, cpu.regX - memValue);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var CPY = function(address) {
  // CPY                  CPY Compare memory and index Y                   CPY
  // Operation:  Y - M                                    S Z C I D V
  //                                                      / / / _ _ _
    var memValue = read(address);

    if (cpu.regY >= memValue) { setFlagBit(C); } else { clearFlagBit(C); }
    if (cpu.regY === memValue) { setFlagBit(Z); } else { clearFlagBit(Z); }

    testAndSetFlag(S, cpu.regY - memValue);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var DEC = function(address) {
  // DEC                   DEC Decrement memory by one                     DEC
  // Operation:  M - 1 -> M                                S Z C I D V
  //                                                       / / _ _ _ _
    var memValue = read(address);
    var result   = memValue - 1;

    testAndSetFlag(S, result);
    testAndSetFlag(Z, result);
    write(address, result);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var DEX = function() {
  // DEX                    DEX Decrement Index X by one                   DEX
  // Operation:  X - 1 -> X                                S Z C I D V
  //                                                       / / _ _ _ _
    cpu.regX = (cpu.regX - 1) & 0xFF;
    testAndSetFlag(Z, cpu.regX);
    testAndSetFlag(S, cpu.regX);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var DEY = function() {
  // DEY                    DEY Decrement Index Y by one                   DEY
  // Operation:  Y - 1 -> Y                                S Z C I D V
  //                                                       / / _ _ _ _
    cpu.regY = (cpu.regY - 1) & 0xFF;
    testAndSetFlag(Z, cpu.regY);
    testAndSetFlag(S, cpu.regY);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var EOR = function(address) {
  // EOR            EOR "Exclusive-Or" memory with accumulator             EOR
  // Operation:  A EOR M -> A                              S Z C I D V
  //                                                       / / _ _ _ _
    var memValue = read(address);
    var result   = cpu.accumulator ^ memValue;

    testAndSetFlag(Z, result);
    testAndSetFlag(S, result);
    write('accumulator', result);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var INC = function(address) {
  // INC                    INC Increment memory by one                    INC
  // Operation:  M + 1 -> M                                S Z C I D V
  //                                                       / / _ _ _ _
    var memValue = read(address);
    var result = memValue + 1;

    testAndSetFlag(Z, result);
    testAndSetFlag(S, result);
    write(address, result);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var INX = function() {
  // INX                    INX Increment Index X by one                   INX
  // Operation:  X + 1 -> X                                S Z C I D V
  //                                                       / / _ _ _ _
    cpu.regX = (cpu.regX + 1) & 0xFF;
    testAndSetFlag(Z, cpu.regX);
    testAndSetFlag(S, cpu.regX);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var INY = function() {
  // INY                    INY Increment Index Y by one                   INY
  // Operation:  Y + 1 -> Y                                S Z C I D V
  //                                                       / / _ _ _ _
    cpu.regY = (cpu.regY + 1) & 0xFF;
    testAndSetFlag(Z, cpu.regY);
    testAndSetFlag(S, cpu.regY);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var LDA = function(address) {
  // LDA                  LDA Load accumulator with memory                 LDA
  // Operation:  M -> A                                    S Z C I D V
  //                                                       / / _ _ _ _
    var memValue = read(address);

    testAndSetFlag(Z, memValue);
    testAndSetFlag(S, memValue);

    write('accumulator', memValue);
    cpu.pc += OP_BYTES[cpu.op];
  };

  var LDX = function(address) {
  // LDX                   LDX Load index X with memory                    LDX
  // Operation:  M -> X                                    S Z C I D V
  //                                                       / / _ _ _ _
    var memValue = read(address);

    testAndSetFlag(Z, memValue);
    testAndSetFlag(S, memValue);

    cpu.regX = memValue & 0xFF;
    cpu.pc += OP_BYTES[cpu.op];

  };

  var LDY = function(address) {
  // LDY                   LDY Load index Y with memory                    LDY
  // Operation: M -> Y                                     S Z C I D V
  //                                                       / / _ _ _ _
    var memValue = read(address);

    testAndSetFlag(Z, memValue);
    testAndSetFlag(S, memValue);

    cpu.regY = memValue & 0xFF;
    cpu.pc += OP_BYTES[cpu.op];

  };

  var LSR = function(address) {
  // LSR          LSR Shift right one bit (memory or accumulator)          LSR
  //                  +-+-+-+-+-+-+-+-+
  // Operation:  0 -> |7|6|5|4|3|2|1|0| -> C               S Z C I D V
  //                  +-+-+-+-+-+-+-+-+                    0 / / _ _ _
    var memValue = read(address);
    var result   = memValue >> 1;
    var c        = (memValue >> 0) & 1;

    testAndSetFlag(Z, result);
    testAndSetFlag(S, result);
    if (c) { setFlagBit(C); } else { clearFlagBit(C); }
    write(address, result);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var JMP = function(address) {
  // JMP                     JMP Jump to new location                      JMP
  // Operation:  (PC + 1) -> PCL                           S Z C I D V
  //             (PC + 2) -> PCH                           _ _ _ _ _ _
    cpu.pc = address;
  };

  var JSR = function(address) {
  // JSR          JSR Jump to new location saving return address           JSR
  // Operation:  PC + 2 toS, (PC + 1) -> PCL               S Z C I D V
  //                         (PC + 2) -> PCH               _ _ _ _ _ _
    var pc = cpu.pc + 2;
    cpu.push((pc >> 8) & 0xFF); // high byte
    cpu.push(pc & 0xFF);        // low byte

    cpu.pc = address;
  };

  var NOP = function() {
  // NOP                         NOP No operation                          NOP
  //                                                       S Z C I D V
  // Operation:  No Operation (2 cycles)                   _ _ _ _ _ _

    cpu.pc += OP_BYTES[cpu.op];
  };

  var ORA = function(address) {
  // ORA                 ORA "OR" memory with accumulator                  ORA
  // Operation: A | M -> A                                 S Z C I D V
  //                                                       / / _ _ _ _
    var memValue = read(address);
    var result = cpu.accumulator | memValue;

    testAndSetFlag(S, result);
    testAndSetFlag(Z, result);

    write('accumulator', result);
    cpu.pc += OP_BYTES[cpu.op];
  };

  var PHA = function() {
  // PHA                   PHA Push accumulator on stack                   PHA
  // Operation:  A toS                                     S Z C I D V
  //                                                       _ _ _ _ _ _
    cpu.push(cpu.accumulator);
    cpu.pc += OP_BYTES[cpu.op];
  };

  var PHP = function() {
  // PHP                 PHP Push processor status on stack                PHP
  // Operation:  P toS                                     S Z C I D V
  //                                                       _ _ _ _ _ _
    cpu.push(cpu.flags | 0x10); // set break flag on pushed flag

    cpu.pc += OP_BYTES[cpu.op];
  };

  var PLA = function() {
  // PLA                 PLA Pull accumulator from stack                   PLA
  // Operation:  A fromS                                   S Z C I D V
  //                                                       / / _ _ _ _
    var result = cpu.pull();
    testAndSetFlag(Z, result);
    testAndSetFlag(S, result);

    write('accumulator', result);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var PLP = function() {
  // PLP               PLP Pull processor status from stack                PLA
  // Operation:  P fromS                                   S Z C I D V
  //                                                       From Stack
    cpu.flags = cpu.pull();
    clearFlagBit(4);
    setFlagBit(5); // Should alwasy be set

    cpu.pc += OP_BYTES[cpu.op];
  };

  var ROL = function(address) {
  // ROL          ROL Rotate one bit left (memory or accumulator)          ROL
  //              +------------------------------+
  //              |         M or A               |
  //              |   +-+-+-+-+-+-+-+-+    +-+   |
  // Operation:   +-< |7|6|5|4|3|2|1|0| <- |C| <-+         S Z C I D V
  //                  +-+-+-+-+-+-+-+-+    +-+             / / / _ _ _
    var memValue = read(address);
    var result   = ((memValue << 1) | getFlag(C)) & 0xFF;
    var c        = (memValue >> 7) & 1;

    if (c) { setFlagBit(C); } else { clearFlagBit(C); }
    testAndSetFlag(Z, result);
    testAndSetFlag(S, result);

    write(address, result);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var ROR = function(address) {
  // ROR          ROR Rotate one bit right (memory or accumulator)         ROR
  //              +------------------------------+
  //              |                              |
  //              |   +-+    +-+-+-+-+-+-+-+-+   |
  // Operation:   +-> |C| -> |7|6|5|4|3|2|1|0| >-+         S Z C I D V
  //                  +-+    +-+-+-+-+-+-+-+-+             / / / _ _ _
    var memValue = read(address);
    var result   = ((memValue >> 1) | ((getFlag(C) << 7) & 0xFF));
    var c        = (memValue >> 0) & 1;

    if (c) { setFlagBit(C); } else { clearFlagBit(C); }
    testAndSetFlag(Z, result);
    testAndSetFlag(S, result);

    write(address, result);

    cpu.pc +=OP_BYTES[cpu.op];
  };

  var RTI = function() {
  // RTI                    RTI Return from interrupt                      RTI
  // Operation:  P fromS PC fromS                         S Z C I D V
  //                                                      From Stack
    cpu.flags = cpu.pull();
    setFlagBit(5);

    var low  = cpu.pull();
    var high = cpu.pull();
    var word = (high << 8) | low;

    cpu.pc = word;
  };

  var RTS = function() {
  // RTS                    RTS Return from subroutine                     RTS
  //                                                       S Z C I D V
  // Operation:  PC fromS, PC + 1 -> PC                    _ _ _ _ _ _
    var low  = cpu.pull();
    var high = cpu.pull();
    var word = (high << 8) | low;

    cpu.pc = word;
    cpu.pc += OP_BYTES[cpu.op];
  };

  var SBC = function(address) {
  // SBC          SBC Subtract memory from accumulator with borrow         SBC
  // Operation:  A - M - C -> A                            S Z C I D V
  //                                                       / / / _ _ /
    var memValue = read(address);
    var result = cpu.accumulator - memValue - (!getFlag(C));

    testAndSetFlag(S, result);
    testAndSetFlag(Z, result);

    // http://www.righto.com/2012/12/the-6502-overflow-flag-explained.html
    // Set V is bit 7 doesn't match
    var v1 = (cpu.accumulator >> 7) & 1;
    var v2 = (memValue >> 7) & 1;
    if (v1 !== v2) { setFlagBit(V); } else { clearFlagBit(V); }

    if (result >= 0 && result <= 255) {
      setFlagBit(C);
    } else {
      clearFlagBit(C);
    }

    write('accumulator', result);
    cpu.pc += OP_BYTES[cpu.op];
  };

  var SEC = function() {
  // SEC                        SEC Set carry flag                         SEC
  //                                                       S Z C I D V
  // Operation:  1 -> C                                    _ _ 1 _ _ _
    setFlagBit(C);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var SED = function() {
  // SED                       SED Set decimal mode                        SED
  //                                                       S Z C I D V
  // Operation:  1 -> D                                    _ _ _ _ 1 _
    setFlagBit(D);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var SEI = function() {
  // SEI                 SEI Set interrupt disable status                  SED
  //                                                       S Z C I D V
  // Operation:  1 -> I                                    _ _ _ 1 _ _
    setFlagBit(I);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var STA = function(address) {
  // STA                  STA Store accumulator in memory                  STA
  // Operation:  A -> M                                    S Z C I D V
  //                                                       _ _ _ _ _ _
    write(address, cpu.accumulator);
    cpu.pc += OP_BYTES[cpu.op];
  };

  var STX = function(address) {
  // STX                    STX Store index X in memory                    STX
  // Operation: X -> M                                     S Z C I D V
  //                                                       _ _ _ _ _ _
    write(address, cpu.regX);
    cpu.pc += OP_BYTES[cpu.op];
  };

  var STY = function(address) {
  // STY                    STY Store index Y in memory                    STY
  // Operation: Y -> M                                     S Z C I D V
  //                                                       _ _ _ _ _ _
    write(address, cpu.regY);
    cpu.pc += OP_BYTES[cpu.op];
  };

  var TAX = function() {
  // TAX                TAX Transfer accumulator to index X                TAX
  // Operation:  A -> X                                    S Z C I D V
  //                                                       / / _ _ _ _
    cpu.regX = cpu.accumulator;
    testAndSetFlag(S, cpu.regX);
    testAndSetFlag(Z, cpu.regX);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var TAY = function() {
  // TAY                TAY Transfer accumulator to index Y                TAY
  // Operation:  A -> Y                                    S Z C I D V
  //                                                       / / _ _ _ _
    cpu.regY = cpu.accumulator;
    testAndSetFlag(S, cpu.regY);
    testAndSetFlag(Z, cpu.regY);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var TSX = function() {
  // TSX              TSX Transfer stack pointer to index X                TSX
  // Operation:  S -> X                                    S Z C I D V
  //                                                       / / _ _ _ _
    cpu.regX = cpu.sp;
    testAndSetFlag(S, cpu.regX);
    testAndSetFlag(Z, cpu.regX);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var TXA = function() {
  // TXA                TYX Transfer index X to accumulator                TYX
  // Operation:  X -> A                                    S Z C I D V
  //                                                       / / _ _ _ _
    cpu.accumulator = cpu.regX;
    testAndSetFlag(S, cpu.accumulator);
    testAndSetFlag(Z, cpu.accumulator);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var TXS = function() {
  // TXS              TXS Transfer index X to stack pointer                TXS
  // Operation:  X -> S                                    S Z C I D V
  //                                                       _ _ _ _ _ _
    cpu.sp = cpu.regX;

    cpu.pc += OP_BYTES[cpu.op];
  };

  var TYA = function() {
  // TYA                TYA Transfer index Y to accumulator                TYA
  // Operation:  Y -> A                                    S Z C I D V
  //                                                       / / _ _ _ _
    cpu.accumulator = cpu.regY;
    testAndSetFlag(S, cpu.accumulator);
    testAndSetFlag(Z, cpu.accumulator);

    cpu.pc += OP_BYTES[cpu.op];
  };


  // EXECUTE
  // OP Table
  var OP_BYTES = [
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

  var stepCount = 1;
  cpu.step = function() {
    cpu.op = nes.memory.read(cpu.pc);
    console.log(stepCount + ': ' +
                cpu.pc.toString(16) +
                ' OP: ' + cpu.op.toString(16) +
                ' A: ' + cpu.accumulator.toString(16) +
                ' X: ' + cpu.regX.toString(16) +
                ' Y: ' + cpu.regY.toString(16) +
                ' P: ' + cpu.flags.toString(16) +
                ' SP: ' + cpu.sp.toString(16)
    );
    stepCount += 1;

   // JSPerf says switch is 66% faster than a map
   switch (cpu.op) {
    case 0x01:
      ORA(indirectX());
      break;
    case 0x05:
      ORA(zeroPage());
      break;
    case 0x06:
      ASL(zeroPage());
      break;
    case 0x08:
      PHP();
      break;
    case 0x09:
      ORA(immediate());
      break;
    case 0x0A:
      ASL(accumulator());
      break;
    case 0x0D:
      ORA(absolute());
      break;
    case 0x0E:
      ASL(absolute());
      break;
    case 0x10:
      BPL(relative());
      break;
    case 0x18:
      CLC();
      break;
    case 0x20:
      JSR(absolute());
      break;
    case 0x21:
      AND(indirectX());
      break;
    case 0x24:
      BIT(zeroPage());
      break;
    case 0x25:
      AND(zeroPage());
      break;
    case 0x26:
      ROL(zeroPage());
      break;
    case 0x28:
      PLP();
      break;
    case 0x29:
      AND(immediate());
      break;
    case 0x2A:
      ROL(accumulator());
      break;
    case 0x2C:
      BIT(absolute());
      break;
    case 0x2D:
      AND(absolute());
      break;
    case 0x2E:
      ROL(absolute());
      break;
    case 0x30:
      BMI(relative());
      break;
    case 0x38:
      SEC();
      break;
    case 0x40:
      RTI();
      break;
    case 0x41:
      EOR(indirectX());
      break;
    case 0x45:
      EOR(zeroPage());
      break;
    case 0x46:
      LSR(zeroPage());
      break;
    case 0x48:
      PHA();
      break;
    case 0x49:
      EOR(immediate());
      break;
    case 0x4A:
      LSR(accumulator());
      break;
    case 0x4C:
      JMP(absolute());
      break;
    case 0x4D:
      EOR(absolute());
      break;
    case 0x4E:
      LSR(absolute());
      break;
    case 0x50:
      BVC(relative());
      break;
    case 0x60:
      RTS();
      break;
    case 0x61:
      ADC(indirectX());
      break;
    case 0x65:
      ADC(zeroPage());
      break;
    case 0x66:
      ROR(zeroPage());
      break;
    case 0x68:
      PLA();
      break;
    case 0x69:
      ADC(immediate());
      break;
    case 0x6A:
      ROR(accumulator());
      break;
    case 0x6D:
      ADC(absolute());
      break;
    case 0x6E:
      ROR(absolute());
      break;
    case 0x70:
      BVS(relative());
      break;
    case 0x78:
      SEI();
      break;
    case 0x81:
      STA(indirectX());
      break;
    case 0x84:
      STY(zeroPage());
      break;
    case 0x85:
      STA(zeroPage());
      break;
    case 0x86:
      STX(zeroPage());
      break;
    case 0x88:
      DEY();
      break;
    case 0x8A:
      TXA();
      break;
    case 0x8C:
      STY(absolute());
      break;
    case 0x8D:
      STA(absolute());
      break;
    case 0x8E:
      STX(absolute());
      break;
    case 0x90:
      BCC(relative());
      break;
    case 0x98:
      TYA();
      break;
    case 0x9A:
      TXS();
      break;
    case 0xA0:
      LDY(immediate());
      break;
    case 0xA1:
      LDA(indirectX());
      break;
    case 0xA2:
      LDX(immediate());
      break;
    case 0xA4:
      LDY(zeroPage());
      break;
    case 0xA5:
      LDA(zeroPage());
      break;
    case 0xA6:
      LDX(zeroPage());
      break;
    case 0xA8:
      TAY();
      break;
    case 0xA9:
      LDA(immediate());
      break;
    case 0xAA:
      TAX();
      break;
    case 0xAC:
      LDY(absolute());
      break;
    case 0xAD:
      LDA(absolute());
      break;
    case 0xAE:
      LDX(absolute());
      break;
    case 0xB0:
      BCS(relative());
      break;
    case 0xB1:
      LDA(indirectY());
      break;
    case 0xB8:
      CLV();
      break;
    case 0xBA:
      TSX();
      break;
    case 0xC0:
      CPY(immediate());
      break;
    case 0xC1:
      CMP(indirectX());
      break;
    case 0xC4:
      CPY(zeroPage());
      break;
    case 0xC5:
      CMP(zeroPage());
      break;
    case 0xC6:
      DEC(zeroPage());
      break;
    case 0xC8:
      INY();
      break;
    case 0xC9:
      CMP(immediate());
      break;
    case 0xCA:
      DEX();
      break;
    case 0xCC:
      CPY(absolute());
      break;
    case 0xCD:
      CMP(absolute());
      break;
    case 0xCE:
      DEC(absolute());
      break;
    case 0xD0:
      BNE(relative());
      break;
    case 0xD8:
      CLD();
      break;
    case 0xE0:
      CPX(immediate());
      break;
    case 0xE1:
      SBC(indirectX());
      break;
    case 0xE4:
      CPX(zeroPage());
      break;
    case 0xE5:
      SBC(zeroPage());
      break;
    case 0xE6:
      INC(zeroPage());
      break;
    case 0xE8:
      INX();
      break;
    case 0xE9:
      SBC(immediate());
      break;
    case 0xEA:
      NOP();
      break;
    case 0xEC:
      CPX(absolute());
      break;
    case 0xED:
      SBC(absolute());
      break;
    case 0xEE:
      INC(absolute());
      break;
    case 0xF0:
      BEQ(relative());
      break;
    case 0xF8:
      SED();
      break;
    default:
      console.log('UKN OP: ' + '0x' + cpu.op.toString(16));
      console.log('Bytes : ' + OP_BYTES[cpu.op]);
      throw new Error('UKN OP!');
   }
  };




  window.nes.cpu = cpu;

}());
