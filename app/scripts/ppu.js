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





  window.nes = window.nes || {};
  window.nes.ppu = ppu;
}());
