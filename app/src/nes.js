import rom from './rom';
import { loadRom } from './mmu';
import * as cpu from './cpu';

console.log('Powered up');
rom.load().then((romData) => {
  console.log('romData', romData);
  loadRom(romData.header, romData.data);
  cpu.reset();
  cpu.step();
});
