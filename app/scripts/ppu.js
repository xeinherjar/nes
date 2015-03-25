/* ****************************************************************************
 * PPU Memory 0x0000 - 0x3FFF
 * http://wiki.nesdev.com/w/index.php/PPU_memory_map
 * range                 size(bytes)         notes
 * 0x0000 - 0x0FFF       0x1000              Pattern Table 0 [Lower CHR Bank]
 * 0x1000 - 0x1FFF       0x1000              Pattern Table 1 [Upper CHR Bank]
 * 0x2000 - 0x23FF       0x0400              Name Table #0
 * 0x2400 - 0x27FF       0x0400              Name Table #1
 * 0x2800 - 0x2BFF       0x0400              Name Table #2
 * 0x2C00 - 0x2FFF       0x0400              Name Table #3
 * 0x3000 - 0x3EFF       0x0F00              Mirrors 0x2000 - 0x2EFF
 * 0x3F00 - 0x3F1F       0x0020              Palette RAM indexes [not RGB values]
 * 0x3F20 - 0x3FFF       0x00E0              Mirrors 0x3F00 - 0x3F1F
 * ***************************************************************************/

(function() {

  'use strict';

  var ppu = {};

  var mBuffer = new ArrayBuffer(0x3FFF + 1);
  ppu.vram  = new Uint8Array(mBuffer);

  ppu.read = function(address) {

  };

  ppu.write = function(address, value) {

  };

  /* HELPERS */
  var getBit = function(regsiter, bit) {
    return (register >> bit) & 1;
  };

  var setBit = function(register, bit) {
    bit = 1 << bit;
    register &= ~bit;
  };

  var clearBit = function(register, bit) {
    bit = 1 << bit;
    register |= bit;
  };

  /* REGISTERS */

  /* PPUCTRL 0x2000 write
   * Bit 7 6 5 4 3 2 1 0
   *     V P H B S I N N
   *     V: nmi enable,     P: master/slave
   *     H: gb tile select, B: sprite tile select
   *     S: increment mode, I: nametable select
   *     NN: nametable select
   *     N1: Add 240 to the Y scroll position
   *     N0: Add 256 to the X scroll position
   * */
  ppu.ctrl = 0;

  /* PPUMASK 0x2001 write
   * Bit 7 6 5 4 3 2 1 0
   *     B G R s b M m g
   *     B: emp blue, G: emp green
   *     R: emp red , s: show sprites
   *     b: show bg ,
   *     M: show sprites in leftmost 8px of screen
   *     m: show bg in leftmost 8px of screen
   *     g: grayscale
   * */
  ppu.mask = 0;
  ppu.status = 0;   // 0x2002
  ppu.oamaddr = 0;  // 0x2003
  ppu.oamdata = 0;  // 0x2004
  ppu.scroll = 0;   // 0x2005
  ppu.addr = 0;     // 0x2006
  ppu.data = 0;     // 0x2007
  ppu.oamdma = 0;   // 0x4014



  window.nes = window.nes || {};
  window.nes.ppu = ppu;
}());
