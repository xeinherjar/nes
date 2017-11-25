let rom = { };

rom.load = () => {
  return new Promise( (resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.open('GET', 'roms/DonkeyKong.nes', true);
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

/* Parse ROM data */
const parse = (data) => {
  let header = { };

  const ines = Array.from(data.slice(0, 4)).map(d => String.fromCharCode(d)).join('');
  if (ines !== 'NES\x1a') { throw new Error('Not a valid NES rom!'); }

  /* Number of Banks
   * PRG has a minimum,  16kb page size [16384 bytes]
   * CHR has no minimum,  8kb page size [ 8192 bytes]
   * */
  // TODO: Add other header fields
  // ie battery, mirroring, etc
  header.prgPageCount = data[4] || 1;
  header.chrPageCount = data[5];
  header.flag06       = data[6];
  header.flag07       = data[7];
  header.prgRAM       = data[8] || 1;
  header.format       = data[9]; // 0: NTSC, 1: PAL
  header.mapper       = (header.flag07 & 0xF0) |
                        ((header.flag06 & 0xF0) >> 4);
  header.trainer      = (header.flag06 & 0x04) === 1;
  header.prgDataSize  = 16384 * header.prgPageCount;
  header.chrDataSize  =  8192 * header.chrPageCount;

  // First 16 bytes of the ROM is the header
  const offset = header.trainer ? 512 + 16 : 16;
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

  return { header, prg, chr, data: data.slice(offset) };
};




export default rom;
