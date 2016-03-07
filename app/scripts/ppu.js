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
  ppu.cycles = 0;
  ppu.dots = 0;
  ppu.scanlines = 0;

  // use .v for read/write through 0x2007
  ppu.v = 0; // VRAM address      15 bits
  ppu.t = 0; // VRAM temp address 15 bits
  ppu.x = 0; // Fine x scroll      3 bits
  ppu.w = 0; // write toggle       1 bit

  var mBuffer = new ArrayBuffer(0x3FFF + 1);
  ppu.vram  = new Uint8Array(mBuffer);

  ppu.read = function(address) {

  };

  ppu.write = function(address, value) {

  };

  // Called from mmu.js
  ppu.readRegister = function(regAddress) {
    switch (regAddress) {
     case 0x2002:
        // PPUSCROLL and PPUADDR latch is cleared when reading
        ppu.w = 0;
        return ppu.status;
      case 0x2004:
        return ppu.oamdata[ppu.oamaddr];
      case 0x2007:
        return ppu.vram[ppu.v];
      default:
        console.log('Error, not a readable register', regAddress.toString(16));
    }
  };

  ppu.writeRegister = function(regAddress, value) {
    console.log('ppu write', regAddress.toString(16), value);
    switch (regAddress) {
      case 0x2000:
        ppu.writeCtrl(value);
        break;
      case 0x2001:
        ppu.writeMask(value);
        break;
      case 0x2003:
        ppu.writeOamaddr(value);
        break;
      case 0x2004:
        ppu.writeOamdata(value);
        break;
      case 0x2005: // x2
        ppu.writeScroll(value);
        break;
      case 0x2006: // x2
        ppu.writeAddr(value);
        break;
      case 0x2007:
        ppu.writeData(value);
        break;
      default:
        console.log('Error, not a writeable register', regAddress.toString(16));
      }
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
  ppu.reg = {};

  /* PPUCTRL 0x2000 write
   * Bit 7 6 5 4 3 2 1 0
   *     V P H B S I N N
   *     V: nmi enable,     P: master/slave
   *     H: gb tile select, B: sprite tile select
   *     S: increment mode, I: nametable select
   *
   *     NN: nametable select
   *     N1: Add 240 to the Y scroll position
   *     N0: Add 256 to the X scroll position
   * */
  ppu.reg.ctrl = {
    // NN
    // 0 = 0x2000 1 = 0x2400
    // 2 = 0x2800 3 = 0x2c00
    V: 0, P: 0, H: 0, B: 0, S: 0, I: 0, NN: 0
  };
  ppu.writeCtrl = function(value) {
    ppu.reg.ctrl.V  = (value >> 7) & 1;
    ppu.reg.ctrl.P  = (value >> 6) & 1;
    ppu.reg.ctrl.H  = (value >> 5) & 1;
    ppu.reg.ctrl.B  = (value >> 4) & 1;
    ppu.reg.ctrl.S  = (value >> 3) & 1;
    ppu.reg.ctrl.I  = (value >> 2) & 1;
    ppu.reg.ctrl.NN = value & 3;
    // t: ...BA.. ........ = d: ......BA
    //    1110011 11111111 = 0x73FF
    ppu.t = (ppu.t & 0x73FF) | (nn << 10);
  };

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
  ppu.reg.mask = {
    B: 0, G: 0, R: 0, s: 0, b: 0, M: 0, m: 0, g: 0
  };
  ppu.writeMask = function(value) {
    ppu.mask = value;
    ppu.reg.mask.B  = (value >> 7) & 1;
    ppu.reg.mask.G  = (value >> 6) & 1;
    ppu.reg.mask.R  = (value >> 5) & 1;
    ppu.reg.mask.s  = (value >> 4) & 1;
    ppu.reg.mask.b  = (value >> 3) & 1;
    ppu.reg.mask.M  = (value >> 2) & 1;
    ppu.reg.mask.m  = (value >> 1) & 1;
    ppu.reg.mask.m  = value & 1;
  };

  /* PPUSTATUS 0x2002 read
   * Bit 7 6 5 4 3 2 1 0
   *     V S O . . . . .
   *     V: vertical blank has started
   *     S: sprite 0 hit
   *     O: sprite overflow
   *
   *     TODO: Reading clears Bit7
   * */
  ppu.status = 0;
  ppu.reg.status = {
    V: 0, S: 0, O: 0
  };

  /* OAMADDR 0x2003 write
   *
   *
   * */
  ppu.oamaddr = 0;
  ppu.writeOamaddr = function(value) {
    ppu.oamaddr = value;
  };

  /* OAMDATA 0x2004 read and write
   * OAM Data is 256 bytes of memory
   *
   *
   * */
  var oBuffer = new ArrayBuffer(0xFF);
  ppu.oamdata = new Uint8Array(oBuffer);
  ppu.writeOamdata = function(value) {
    ppu.oamdata[ppu.oamaddr] = value;
    ppu.oamaddr++;
  };

  /* PPUSCROLL 0x2005 write
   *
   * */
  ppu.writeScroll = function(value) {
    if (ppu.w === 0) {
      // t: ....... ...HGFED = d: HGFED...
      //    1111111 11100000 = 7fe0
      ppu.t = (ppu.t & 0x7fe0) | (value >> 3);
      // x:              CBA = d: .....CBA
      //                          11111000 = 0x7
      ppu.x = value & 0x07;
      ppu.w = 1;
    } else {
      // t: CBA..HG FED..... = d: HGFEDCBA
      //    0001100 00011111 = 0xc1f
      //    0001100 = c
      //    00011111 = 1f
      //    TODO:
      ppu.w = 0;
    }
  };

  // 0x2006
  ppu.writeAddr = function(value) {
    if (ppu.w === 0) {
      ppu.w = 1;
      ppu.v = (value << 8) | (ppu.v & 0xFF);
    } else {
      ppu.v = (value & 0xFF00) | value;
      ppu.w = 0;
    }

  };

  // 0x2007
  ppu.writeData = function(value) {
    ppu.vram[ppu.v] = value;
  };

  ppu.oamdma = 0;   // 0x4014



  window.nes = window.nes || {};
  window.nes.ppu = ppu;
}());
