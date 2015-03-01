(function() {

  'use strict';

  var nes = nes || {};
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










  window.nes.cpu = cpu;

}());
