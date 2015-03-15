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
    // TODO: check for page boundry
    var lowAddress = cpu.getNextWord();
    var low  = read(lowAddress);
    var high = read(lowAddress + 1);
    return (high << 8) | low;
  };

  var indirectX = function() {
    var lowAddress = cpu.getNextByte() + cpu.regX;
    var low  = read(lowAddress);
    var high = read(lowAddress + 1);
    return (high << 8) | low;
  };

  var indirectY = function() {
    var lowAddress = cpu.getNextByte();
    var low  = read(lowAddress);
    var high = read(lowAddress + 1);
    var word = (high << 8) | low;
    return word + cpu.regY;
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

    write('accumulator', result & 0xFF);
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

    var v = (result >> 6) & 1;
    if (v) { setFlagBit(V); } else { clearFlagBit(V); }

    var s = (result >> 7) & 1;
    if (s) { setFlagBit(S); } else { clearFlagBit(S); }

    testAndSetFlag(Z, memValue);

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

  var CMP = function(address) {
  // CMP                CMP Compare memory and accumulator                 CMP
  // Operation:  A - M                                     S Z C I D V
  //                                                       / / / _ _ _
    var memValue = read(address);

    if (cpu.accumulator >= memValue) { setFlagBit(C); } else { clearFlagBit(C); }
    if (cpu.accumulator === memValue) { setFlagBit(Z); } else { clearFlagBit(W); }

    testAndSetFlag(S, memValue);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var LDA = function(address) {
    var memValue = read(address);

    testAndSetFlag(Z, memValue);
    testAndSetFlag(S, memValue);

    cpu.accumulator = memValue & 0xFF;
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

  var PHP = function() {
  // PHP                 PHP Push processor status on stack                PHP
  // Operation:  P toS                                     S Z C I D V
  //                                                       _ _ _ _ _ _
    setFlagBit(5); // Bit 5 is not used but should always be 1.
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

  var SEC = function() {
  // SEC                        SEC Set carry flag                         SEC
  //                                                       S Z C I D V
  // Operation:  1 -> C                                    _ _ 1 _ _ _
    setFlagBit(C);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var SED = function() {
  // SED                       SED Set decimal mode                        SED
  //                                                       N Z C I D V
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
    case 0x08:
      PHP();
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
    case 0x24:
      BIT(zeroPage());
      break;
    case 0x29:
      AND(immediate());
      break;
    case 0x38:
      SEC();
      break;
    case 0x4C:
      JMP(absolute());
      break;
    case 0x50:
      BVC(relative());
      break;
    case 0x60:
      RTS();
      break;
    case 0x68:
      PLA();
      break;
    case 0x70:
      BVS(relative());
      break;
    case 0x78:
      SEI();
      break;
    case 0x85:
      STA(zeroPage());
      break;
    case 0x86:
      STX(zeroPage());
      break;
    case 0x90:
      BCC(relative());
      break;
    case 0xA2:
      LDX(immediate());
      break;
    case 0xA9:
      LDA(immediate());
      break;
    case 0xB0:
      BCS(relative());
      break;
    case 0xC9:
      CMP(immediate());
      break;
    case 0xD0:
      BNE(relative());
      break;
    case 0xEA:
      NOP();
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
