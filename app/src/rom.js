let rom = { };

rom.load = () => {
  'use strict';
  return new Promise( (resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.open('GET', 'roms/IceHockey.nes', true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = (e) => {
      const buffer = xhr.response;
      const data = new Uint8Array(buffer);
      const romData = parse(data);
      resolve(romData);
    };
    xhr.send(null);
  });
};


// TODO: Add other header fields
// ie battery, mirroring, etc
let header = {
  inesHeader: '',
  prgPageCount: 1,
  chrPageCount: 0,
  flag06:       0,
  flag07:       0,
  prgRAM:       0,
  format:       0,
  mapper:       0,
  trainer:      false,
};


/* Parse ROM data */
const parse = (data) => {
  var i = 0;
  for (i = 0; i < 4; i++) {
    header.inesHeader += String.fromCharCode(data[i]);
  }
  if (header.inesHeader !== 'NES\x1a') { throw new Error('Not a valid NES rom!'); }

  /* Number of Banks
   * PRG has a minimum,  16kb page size [16384 bytes]
   * CHR has no minimum,  8kb page size [ 8192 bytes]
   * */
  header.prgPageCount = data[4] || 1;
  header.chrPageCount = data[5];
  header.flag06       = data[6];
  header.flag07       = data[7];
  header.prgRAM       = data[8] || 1;
  header.format       = data[9]; // 0: NTSC, 1: PAL
  header.mapper       = (header.flag07 & 0xF0) |
    ((header.flag06 & 0xF0) >> 4);
  header.trainer      = (header.flag06 & 0x04) === 1 ? true : false;
  header.prgDataSize  = 16384 * header.prgPageCount;
  header.chrDataSize  =  8192 * header.chrPageCount;

  // First 16 bytes of the ROM is the header
  /*
  let offset = 16;
  if (header.trainer) { offset += 512; }
  */
  const offset = header.trainer ? 512 + 16 : 16;

  /*
  var pBuffer = new ArrayBuffer(header.prgDataSize);
  var cBuffer = new ArrayBuffer(header.chrDataSize);
  let prg = new Uint8Array(pBuffer);
  let chr = new Uint8Array(cBuffer);
  for (i = 0; i < header.prgDataSize; i++) {
    prg[i] = data[offset + i];
  }

  offset += header.prgDataSize;
  for (i = 0; i < header.chrDataSize; i++) {
    chr[i] = data[offset + i];
  }
  */
  const prgStart = offset;
  const prgEnd = offset + header.prgDataSize;
  const chrStart = offset + header.prgDataSize;
  const chrEnd = offset + header.prgDataSize + header.chrDataSize + 1;
  
  const prg = data.slice(prgStart, prgEnd);
  const chr = data.slice(chrStart, chrEnd);

  console.log('Mapper: ', header.mapper);
  console.log('PRG_COUNT ', header.prgPageCount);
  console.log('CHR_COUNT ', header.chrPageCount);
  console.log('PRG_SIZE  ', header.prgDataSize);
  console.log('CHR_SIZE  ', header.chrDataSize);
  
  return { header, prg, chr };

};




export default rom;
