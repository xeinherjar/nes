import rom from './rom';

console.log('Powered up');
rom.load().then((romData) => {
  console.log('romData', romData);
});
/*
setTimeout(function() {
 nes.memory.loadRom(nes.rom.prgData);
}, 2000);

console.log('Init CPU');
//setTimeout(function() {nes.cpu.flags = 0x24;}, 2500);
setTimeout(function() {nes.cpu.reset();}, 2500);


nes.step = function() {
  nes.cpu.step();
};
*/
