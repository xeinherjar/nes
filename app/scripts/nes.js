console.log('Power up');

nes.rom.load();
setTimeout(nes.rom.parse, 2000);
setTimeout(function() {
 nes.memory.loadRom(nes.rom.rawData);
}, 4000);

console.log('Init CPU');
nes.cpu.flags = 0x24;


