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
// TODO: Scrolling, https://wiki.nesdev.com/w/index.php/PPU_scrolling

let mmu = null;
let cpu = null;

const reset = (bus) => {
  mmu = bus.mmu;
  cpu = bus.cpu;
  const chr = bus.rom.chr;

  for (let i = 0; i < chr.length; i++) {
    vram[i] = chr[i];
  }
};

/* SCREEN */
let screenBuffer = new ArrayBuffer(256 * 240);
let screen = new Uint8Array(screenBuffer);
const canvas = document.getElementById('nes-canvas').getContext('2d');

/* MEMORY */
const vramBuffer = new ArrayBuffer(0x3FFF + 1);
const vram = new Uint8Array(vramBuffer);


/* Counters */
let cycle = 0;
let scanline = -1; // 341 cycle
let frame = 0; // 262 scanlines
let oddFrame = false;
let renderingEnabled = false;
let previousNmi = 0;  // For use with ppustatus.V or ctrl.V

/* REGISTERS & READERS/WRITERS */
let registers = { };
// use .v for read/write through 0x2007
registers.v = 0; // VRAM address      15 bits
registers.t = 0; // VRAM temp address 15 bits
registers.x = 0; // Fine x scroll      3 bits
registers.w = 0; // write toggle       1 bit

// Background
// 0 = high bits, 1 = low bits
let nameTableByte = 0;
// 16-bit, bitmap data for two tiles
let lowTile = 0;
let highTile = 0;
// 0 - high attribute bits, 1 - low attribute bits (same tile)
let attributeByte = 0;
let palette = [0x00, 0x00]; // 8-bit palette attribtues (shift-registers)

// TODO: sprite registers...
// Sprites
// 64 sprites for frame
// 4 Bytes per sprite
// 0 - y position of top of sprite, 1 - tile index number
// 2 - attribute,                   3 - x position of left side of sprite
const oamramBuffer = new ArrayBuffer(0xFF + 1);
const oamram = new Uint8Array(oamramBuffer);
let secondaryOam = [] // 8 sprites for current scanline
let spriteShiftRegister = []; // 8 pairs of shift registers
let spriteAttributes = [] // 8 attribute bytes
let spriteLatches = [] // 8 x positions


/* PALLET */
const palletTable = [
  "rgb(124, 124, 124)", "rgb(  0,   0, 252)", "rgb(  0,   0, 188)",
  "rgb( 68,  40, 188)", "rgb(148,   0, 132)", "rgb(168,   0,  32)",
  "rgb(168,  16,   0)", "rgb(136,  20,   0)", "rgb( 80,  48,   0)",
  "rgb(  0, 120,   0)", "rgb(  0, 104,   0)", "rgb(  0,  88,   0)",
  "rgb(  0,  64,  88)", "rgb(  0,   0,   0)", "rgb(  0,   0,   0)",
  "rgb(  0,   0,   0)", "rgb(188, 188, 188)", "rgb(  0, 120, 248)",
  "rgb(  0,  88, 248)", "rgb(104,  68, 252)", "rgb(216,   0, 204)",
  "rgb(228,   0,  88)", "rgb(248,  56,   0)", "rgb(228,  92,  16)",
  "rgb(172, 124,   0)", "rgb(  0, 184,   0)", "rgb(  0, 168,   0)",
  "rgb(  0, 168,  68)", "rgb(  0, 136, 136)", "rgb(  0,   0,   0)",
  "rgb(  0,   0,   0)", "rgb(  0,   0,   0)", "rgb(248, 248, 248)",
  "rgb( 60, 188, 252)", "rgb(104, 136, 252)", "rgb(152, 120, 248)",
  "rgb(248, 120, 248)", "rgb(248,  88, 152)", "rgb(248, 120,  88)",
  "rgb(252, 160,  68)", "rgb(248, 184,   0)", "rgb(184, 248,  24)",
  "rgb( 88, 216,  84)", "rgb( 88, 248, 152)", "rgb(  0, 232, 216)",
  "rgb(120, 120, 120)", "rgb(  0,   0,   0)", "rgb(  0,   0,   0)",
  "rgb(252, 252, 252)", "rgb(164, 228, 252)", "rgb(184, 184, 248)",
  "rgb(216, 184, 248)", "rgb(248, 184, 248)", "rgb(248, 164, 192)",
  "rgb(240, 208, 176)", "rgb(252, 224, 168)", "rgb(248, 216, 120)",
  "rgb(216, 248, 120)", "rgb(184, 248, 184)", "rgb(184, 248, 216)",
  "rgb(  0, 252, 252)", "rgb(248, 216, 248)", "rgb(  0,   0,   0)",
  "rgb(  0,   0,   0)"
];
/* Pallet vram memory map
 * 0x3F00 - Universal background color
 * 0x3F01 - 0x3F03 - BG pallete 0
 * 0x3F03 - 0x3F07 - BG pallete 1
 * 0x3F09 - 0x3F0B - BG pallete 2
 * 0x3F0D - 0x3F0F - BG pallete 3
 * 0x3F11 - 0x3F13 - Sprite pallete 0
 * 0x3F15 - 0x3F17 - Sprite pallete 1
 * 0x3F19 - 0x3F1B - Sprite pallete 2
 * 0x3F1D - 0x3F1F - Sprite pallete 3
 * */



/* PPUCTRL 0x2000 write
 * Bit 7 6 5 4 3 2 1 0
 *     V P H B S I N N
 *     V: nmi enable:                   0 = false,  1 = true
 *     P: master/slave
 *     H: sprite size:                  0 = 8x8,    1 = 16x16,
 *     B: bg pattern table address:     0 = 0x0000, 1 = 0x1000
 *     S: sprite pattern table address: 0 = 0x0000, 1 = 0x1000
 *     I: vram address increment:       0 = inc 1,  1 = inc 32
 *
 *     NN: nametable select (0 = $2000; 1 = $2400; 2 = $2800; 3 = $2C00)
 *     N1: Add 240 to the Y scroll position
 *     N0: Add 256 to the X scroll position
 * */
let ctrl = {
  // NN
  // 0 = 0x2000 1 = 0x2400
  // 2 = 0x2800 3 = 0x2c00
  V: 0, P: 0, H: 0, B: 0, S: 0, I: 0, NN: 0
};
const writeCtrl = (value) => {
  ctrl.V  = (value >> 7) & 1;
  ctrl.P  = (value >> 6) & 1;
  ctrl.H  = (value >> 5) & 1;
  ctrl.B  = (value >> 4) & 1;
  ctrl.S  = (value >> 3) & 1;
  ctrl.I  = (value >> 2) & 1;
  ctrl.NN = value & 3;
  // t: ...BA.. ........ = d: ......BA
  //    1110011 11111111 = 0x73FF
  registers.t = (registers.t & 0x73FF) | (ctrl.NN << 10);
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
let mask = {
  B: 0, G: 0, R: 0, s: 0, b: 0, M: 0, m: 0, g: 0
};
const writeMask = (value) => {
  mask.B  = (value >> 7) & 1;
  mask.G  = (value >> 6) & 1;
  mask.R  = (value >> 5) & 1;
  mask.s  = (value >> 4) & 1;
  mask.b  = (value >> 3) & 1;
  mask.M  = (value >> 2) & 1;
  mask.m  = (value >> 1) & 1;
  mask.g  = value & 1;
};

/* PPUSTATUS 0x2002 read
 * Bit 7 6 5 4 3 2 1 0
 *     V S O . . . . .
 *     V: vertical blank has started
 *     S: sprite 0 hit
 *     O: sprite overflow
 *
 * */
let ppustatus = {
  V: 0, S: 0, O: 0
};

/* OAMADDR 0x2003 write
 *
 *
 * */
let oamaddr = 0;
const writeOamaddr = (value) => {
  oamaddr = value;
};

/* OAMDATA 0x2004 read and write
 * OAM Data is 256 bytes of memory
 *
 *
 * */
const writeOamdata = (value) => {
  oamram[oamaddr] = value;
  oamaddr++;
};

/* PPUSCROLL 0x2005 write x2
 *
 * */
const writeScroll = (value) => {
  if (registers.w === 0) {
    // t: ....... ...HGFED = d: HGFED...
    //    1111111 11100000 = 7fe0
    registers.t = (registers.t & 0x7fe0) | (value >> 3);
    // x:              CBA = d: .....CBA
    //                          11111000 = 0x7
    registers.x = value & 0x07;
    registers.w = 1;
  } else {
    // t: CBA..HG FED..... = d: HGFEDCBA
    //    0001100 00011111 = 0xc1f
    //    0001100 = c
    //    00011111 = 1f
    const CBA = registers.t >> 12;
    const HG  = (registers.t >> 2) & 0xC0;
    const FED = (registers.t & 0x1f) << 3;
    registers.t = HG | FED | CBA;
    registers.w = 0;
  }
};


/* PPUADDR 0x2006 write x2
 * Valid address range, 0x0000 - 0x3FFF
 * */
const writeAddr = (value) => {
  value = value & 0x3FFF;
  if (registers.w === 0) {
    // t: .FEDCBA ........ = d: ..FEDCBA
    //    1000000 11111111 = 0x40FF
    // t: X...... ........ = 0
    //    0111111 11111111 = 0x3FFF
    registers.t = (registers.t & 0x40FF) | (value << 8);
    registers.t = registers.t & 0x3FFF;
    registers.w = 1;
  } else {
    // t: ....... HGFEDCBA = d: HGFEDCBA
    registers.t = (value & 0xFF00) | value;
    registers.v = registers.t;
    registers.w = 0;
  }
};

/* PPUDATA 0x2007 read/write
 *
 * */
const writeData = (value) => {
  let address = registers.v;
  if (registers.v < 0x3F00) {
    address = registers.v & 0x2FFF;
  }
  else {
    address = registers.v & 0x3F1F;
  }

  vram[address] = value;
  const change = ctrl.I === 0 ? 1 : 32;
  registers.v += change;
};

const readVram = () => {
  if (registers.v < 0x3F00) {
    const address = registers.v & 0x2FFF;
    const change = ctrl.I === 0 ? 1 : 32;
    registers.v += change;
    return vram[address];
  }
  else {
    const address = registers.v & 0x3F1F;
    const change = ctrl.I === 0 ? 1 : 32;
    registers.v += change;
    return vram[address];
  }
};


/* OAM DMA 0x4014 write
 *
 * */
const oamdma = (address) => {
  console.log('----oamdma-----, ugh, double check me');
  const from = address << 8;
  const to   = (address << 8) | 0xFF;
  for (let i = 0; i < 0xFF; i++) {
    oamram[i] = mmu.ram[from + i];
  }
  // TODO: cpu ticks, module importing being weird...
  // notes say it uses 2004 to write, should I increment
  // oamaddr as well?
  // const cycles = cpu.cycles % 2 === 1 ? 514 : 513;
  // cpu.cycles += cycles;

};


/* Read & Write from MMU */
const read = (address) => {
  switch (address) {
    case 0x2002:
      // PPUSCROLL and PPUADDR latch is cleared when reading
      const statusValue = (
          (ppustatus.V << 7) |
          (ppustatus.S << 6) |
          (ppustatus.O << 5)
        )
      registers.w = 0;
      // Reading clears Bit7
      ppustatus.V = 0;
      console.log('read', '0x2002', statusValue);
      return statusValue;
    case 0x2004:
      return oamram[oamaddr];
    case 0x2007:
      const value = readVram();
      // TODO: review post fetch notes
      // look into buffered reads
      return value;
    default:
      console.log('Error, not a readable register', address.toString(16));
  }
};

const write = (address, value) => {
  switch (address) {
    case 0x2000:
      writeCtrl(value);
      break;
    case 0x2001:
      writeMask(value);
      break;
    case 0x2003:
      writeOamaddr(value);
      break;
    case 0x2004:
      writeOamdata(value);
      break;
    case 0x2005: // x2
      writeScroll(value);
      break;
    case 0x2006: // x2
      writeAddr(value);
      break;
    case 0x2007:
      writeData(value);
      break;
    case 0x4014:
      oamdma(value);
      break;
    default:
      console.log('Error, not a writeable register', address.toString(16));
  }

};

// BG Rendering and Fetching
const bgTile = () => {
    // 1 - 2 get nametable byte ctrl.NN (base nametable address)
    const ntAddr = 0x2000 | (registers.v & 0x0FFF);
    nameTableByte = vram[ntAddr];
    // 3 - 4 get attribute byte ctrl.B
    const atAddr = 0x23C0 | (registers.v & 0x0C00) |
                            ((registers.v >> 4) & 0x38) |
                            ((registers.v >> 2) & 0x07);
    // Get value and bump register.v
    attributeByte = readVram(atAddr);
    // 5 - 6 get low bg tile byte
    lowTile = vram[nameTableByte]
    // 7 - 8 get high bg tile byte (address + 8)
    highTile = vram[nameTableByte + 8]
};

const renderPixels = () => {
  // screen 256(cycle) x 240(scanline)
  if (cycle > 255) { console.log('cycle too high'); return; }
  if (scanline > 240) { console.log('scanline too high'); return; }
  const base = scanline * cycle;
  // TODO: find pallet for index?
  for (let i = 7; i >= 0; i--) {
    const idx = ((lowTile >> i) & 1)  + (((highTile >> i) & 1) * 2);
    screen[ base + i ] = idx;
  };


};


// TODO: intertup, check if interupts disabled
const step = () => {
  if (scanline === -1) { // scanline -1 and 261
    // TODO: if oddFrame, then 1 less cycle
    // TODO: if cycle 280 - 304 and renderenable, reload vertical scroll bits
    if (cycle == 1) {
      // clear vblank flag
      ppustatus.V = 0;
      // TODO: sprite 0 collision?
    }

    if (cycle <= 248) { // cycle   1 - 256
      bgTile();
      cycle += 8;
    } else if (cycle <= 256) { // cycle   249 - 256
      // Unused tile fetch
      cycle += 1;

    } else if (cycle <= 279) { // cycle 257 - 279
      // Mostly idle
      // TODO: hovri(v) = hori(t) on 257?
      cycle += 1;

    } else if (cycle <= 304) { // cycle 280 - 304
      // vert(v) = vert(t)
      cycle += 1;
    } else if (cycle <= 320) { // cycle 305 - 320
      // Idle
      cycle += 1;

    } else if (cycle <= 336) { // cycle 321 - 336
      bgTile();
      cycle += 8;

    } else if (cycle <= 340) { // cycle 337 - 340
      // TODO: fetch nametable byte twice?  Garbage fetch?
      cycle += 4;
    }


  } else if (scanline <= 239) { // scanline 0 - 239 Visable scanlines
    if (cycle === 0) {
      cycle += 1;
      // PPU is idle
    } else if (cycle <= 256) { // cycle   1 - 256
      bgTile();
      // Render pixel
      //renderPixels();
      cycle += 8;

    } else if (cycle <= 320) { // cycle 257 - 320
      // Mostly idle
      // TODO: hovri(v) = hori(t) on 257?
      cycle += 1;

    } else if (cycle <= 336) { // cycle 321 - 336
      // TODO: same as 1 - 256
      cycle += 8;

    } else if (cycle <= 340) { // cycle 337 - 340
      // TODO: fetch nametable byte twice?  Maybe garbage fetch?
      cycle += 4;
    }

  } else if (scanline === 240) { // scanline 240
    cycle += 1;
    // PPU is idle
  } else if (scanline === 241) { // scanline 241
    if (cycle === 1) {
      // set vblank flag
      ppustatus.V = 1;
      if (ctrl.V) { cpu.requestInterrupt('NMI'); console.log('nmi'); }
      console.log('-----Frame------', ctrl.V, ppustatus.V);
    }
    cycle += 1;

  } else if (scanline <= 260) { // scanline 242 - 260
    cycle += 1;
  }

  if (cycle >= 341) { cycle = 0; scanline += 1; }
  if (scanline >= 261) { scanline = -1; oddFrame = !oddFrame; frame++ }

};



export default { reset, read, write, step, cycle, screen };
