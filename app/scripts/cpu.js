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
   * */
  cpu.flags = 0;


  /* COUNTERS */
  var cycles = 0;


  /* HELPERS */
  
  /* ADDRESS MODES */

  /* OPCODES */










  window.nes.cpu = cpu;

}());
