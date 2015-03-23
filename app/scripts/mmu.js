/* ****************************************************************************
 * 0x0000 - 0x00FF    256  Zero Page
 * 0x0100 - 0x01FF    256  Stack Memory
 * 0x0200 - 0x07FF   1536  RAM
 * 0x0800 - 0x0FFF   2048  Mirror of 0x0000 - 0x07FF
 * 0x1000 - 0x17FF   2048  Mirror of 0x0000 - 0x07FF
 * 0x1800 - 0x1FFF   2048  Mirror of 0x0000 - 0x07FF
 * 0x2000 - 0x2007      8  Input/Output Regsiters
 * 0x2008 - 0x3FFF   8184  Mirror of 0x2000 - 0x2007 (mutiple times)
 * 0x4000 - 0x401F     32  Input/Output Regsiters
 * 0x4020 - 0x5FFF   8160  Expansion ROM - Used with Nintendo MMC5 to expand VRAM
 * 0x6000 - 0x7FFF   8192  SRAM - Save Ram used to save data between game plays
 * 0x8000 - 0xFFFF  32768  PRG-ROM
 * 0xFFFA - 0xFFFB      2  Address of Non Maskable Interrupt (NMI) handler routine
 * 0xFFFC - 0xFFFD      2  Address of Power on reset handler routine
 * 0xFFFE - 0xFFFF      2  Address of Break (BRK instruction) handler routine
 * ***************************************************************************/

(function() {

'use strict';

var memory = {};

var mBuffer = new ArrayBuffer(0xFFFF + 1);
memory.ram  = new Uint8Array(mBuffer);


memory.read = function(address) {
  /* Mirror of lower byte range */
  if (address < 0x2000) {
    return memory.ram[address & 0x07FF];
  } else if (address < 0x3FFF) {
    /* Mirror of 0x2000 - 0x2007 */
    /* Memory mapped to PPU */
    return memory.ram[0x2000 + (address & 0x7)];
  } else {
    /* Everything else */
    return memory.ram[address];
  }
};

memory.write = function(address, value) {
  if (address === 0) { console.log('asdf', value); }
  /* Mirror of lower byte range */
  if (address < 0x2000) {
    memory.ram[address & 0x07FF] = (value & 0xFF);
  } else if (address < 0x3FFF) {
    /* Mirror of 0x2000 - 0x2007 */
    /* Memory mapped to PPU */
    memory.ram[0x2000 + (address & 0x7)] = (value & 0xFF);
  } else {
    /* Everything else */
    memory.ram[address] = (value & 0xFF);
  }
};


memory.loadRom = function(data) {
  /* 0x8000 - 0xFFFF */
  var mapper = nes.rom.header.mapper;
  /* Mapper 0 */
  switch (mapper) {
    case 0:
      for (var i = 0; i < data.length; i++) {
        memory.ram[0x8000 + i] = data[i];
      }
      if (data.length < 0x8000) {
        console.log("Mapper 0: Mirroring");
        for (var i = 0; i < data.length; i++) {
          memory.ram[0xC000 + i] = data[i];
        }
      }

      break;
    default:
      console.log('Not supported');

  }

};

window.nes = window.nes || {};
window.nes.memory = memory;

}());
