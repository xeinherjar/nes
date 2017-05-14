import rom from './rom';
import mmu from './mmu';
import cpu from './cpu';
import ppu from './ppu';

console.log('Powered up');
rom.load().then((romData) => {
  mmu.loadRom(romData.header, romData.prg);
  cpu.reset();
  for (let i = 0; i < 10000000; i++) {
    cpu.step();
    ppu.step();
    ppu.step();
    ppu.step();
  }
  console.log('done');
});
