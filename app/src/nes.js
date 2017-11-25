import rom from './rom';
import mmu from './mmu';
import ppu from './ppu';
import cpu from './cpu';

console.log('Powered up');

const bus = {
  mmu, cpu, ppu, rom
};

rom.load().then((romData) => {
  rom.prg = romData.prg;
  rom.chr = romData.chr;
  mmu.reset(bus);
  mmu.loadRom(romData.header, romData.prg, romData.chr);
  cpu.reset(bus);
  ppu.reset(bus);
  console.time('ah');
  // TODO: count both cpu and ppu cycles
  for (let i = 0; i < 10000; i++) {
    cpu.step();
    for (let i = 0; i <= cpu.cycles; i++) {
      ppu.step();
      ppu.step();
      ppu.step();
    }
  }
  console.timeEnd('ah');
  console.log('done');
  console.log('screen', ppu.screen);
});

window.bus = bus;
