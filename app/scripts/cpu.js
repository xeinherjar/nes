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
  // Operation:  A + M + C -> A, C                         N Z C I D V
  //                                                       / / / _ _ /
    var memValue = read(address);
    var result   = memValue + cpu.accumulator + getFlag(C);

    testAndSetFlag(N, result);
    testAndSetFlag(Z, result);
    testAndSetFlag(C, result);
    testAndSetFlag(V, memValue, cpu.accumulator, result);

    write('accumulator', result & 0xFF);
    cpu.pc += OP_BYTES[cpu.op];

  };

  var AND = function(address) {
  };

  var ASL = function(address) {
  };

  var BCC = function(address) {
  };

  var BCS = function(address) {
  };

  var BEQ = function(address) {
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

  cpu.step = function() {
    cpu.op = nes.memory.read(cpu.pc);
    console.log('' + cpu.pc.toString(16), 
                ' ' + cpu.op.toString(16));

   // JSPerf says switch is 66% faster than a map
   switch (cpu.op) {
    case 0x20:
      JSR(absolute());
      break;
    case 0x4C:
      JMP(absolute());
      break;
    case 0x86:
      STX(zeroPage());
      break;
    case 0xA2:
      LDX(immediate());
      break;
    default:
      console.log('UKN OP: ' + '0x' + cpu.op.toString(16));
      console.log('Bytes : ' + OP_BYTES[cpu.op]);
   }
  };




  window.nes.cpu = cpu;

}());
