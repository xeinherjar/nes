// CPU Memory Layout
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

//import ppu from './ppu';
let ppu = null;
let ramBuffer = new ArrayBuffer(0xFFFF + 1);
let ram = new Uint8Array(ramBuffer);

const reset = (bus) => {
  ppu = bus.ppu;
}

const read = (address) => {
  /* Mirror of lower byte range */
  if (address < 0x2000) {
    return ram[address & 0x07FF];
  } else if (address <= 0x3FFF) {
    /* Mirror of 0x2000 - 0x2007 */
    /* Memory mapped to PPU */
    console.log('ppu read, ', (address & 0x7));
    return ppu.read(0x2000 + (address & 0x7));
  } else {
    /* Everything else */
    //return ram[address];
    return mapperRead(address);
  }
};

const write = (address, value) => {
  /* Mirror of lower byte range */
  if (address < 0x2000) {
    ram[address & 0x07FF] = (value & 0xFF);
  } else if (address <= 0x3FFF) {
    /* Mirror of 0x2000 - 0x2007 */
    /* Memory mapped to PPU */
    console.log('ppu write, ', (address & 0x7), (value & 0xFF));
    ppu.write(0x2000 + (address & 0x7), (value & 0xFF));
  } else {
    /* Everything else */
    mapperWrite(address, value);
  }
};

// TODO: Move mapping stuff out into their own files
let mapperRead = () => { throw new Error('Mapper read not implemneted'); };
let mapperWrite = () => { throw new Error('Mapper write not implemneted'); };

const loadRom = (header, data, chr) => {
  /* 0x8000 - 0xFFFF */
  var mapper = header.mapper;
  /* Mapper 0 */
  switch (mapper) {
    case 0:
      console.log('Loading mapper 0');
      for (let i = 0; i < data.length; i++) {
        ram[0x8000 + i] = data[i];
      }
      // Mapper 0 Mirrors if only one PRG bank.
      if (data.length <= 0x4000) {
        mapperRead = (address) => {
          return ram[address & 0xBFFF];
        };
        mapperWrite = (address, value) => {
          ram[address & 0xBFFF] = (value & 0xFF);
        };
      } else {
        mapperRead = (address) => {
          return ram[address];
        };
        mapperWrite = (address, value) => {
          ram[address] = (value & 0xFF);
        };
      }
      break;
    default:
      console.log('Mapper not yet supported');
  }

};



export default { reset, loadRom, read, write, ram };
