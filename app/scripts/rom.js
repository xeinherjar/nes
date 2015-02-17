(function() {

'use strict';
var rom = {};

var rBuffer = new ArrayBuffer();

rom.get = new XMLHttpRequest();
rom.get.onload = function(e) {
  rBuffer = rom.get.response;
  rom.rawData = new Uint8Array(rBuffer);

};

rom.load = function() {
  rom.get.open('GET', 'roms/nestest.nes', true);
  rom.get.responseType = 'arraybuffer';
  rom.get.send(null);
};

var inesHeader = '',
    prgPageCount,
    chrPageCount;


/* Parse ROM data */
rom.parse = function() {
  var i = 0;
  for (i = 0; i < 4; i++) {
    inesHeader += String.fromCharCode(rom.rawData[i]);
  }
  if (inesHeader !== 'NES\x1a') { throw new Error('Not a valid NES rom!'); }

  /* Number of Banks
   * PRG has a minimum,  16kb page size [16384 bytes]
   * CHR has no minimum,  8kb page size [ 8192 bytes]
   * */
  prgPageCount = rom.rawData[4] || 1;
  chrPageCount = rom.rawData[5];
  
};

window.nes = window.nes || {};
window.nes.rom = rom;

}());
