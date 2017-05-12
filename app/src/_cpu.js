  var accumulator = function() {
    return 'accumulator';
  };

  var absolute = function() {
    return cpu.getNextWord();
  };

  var absoluteX = function() {
    return (cpu.getNextWord() + cpu.regX) & 0xFFFF;
  };

  // Extra cycles on page boundry crossing
  var absoluteX_pageBoundry = function() {
    var word = cpu.getNextWord();
    var addr = (word + cpu.regX);

    if ((addr >> 8) != (word >> 8)) { cpu.cycles += 1; }
  };

  var absoluteY = function() {
        return (cpu.getNextWord() +cpu.regY) & 0xFFFF;
  };

  var absoluteY_pageBoundry = function() {
    var word = cpu.getNextWord();
    var addr = (word + cpu.regY);

    if ((addr >> 8) > (word >> 8)) { cpu.cycles += 1; }
  };

  var immediate = function() {
    return 'immediate';
  };

  // implied/implicit
  // ie return from subroutine, clear flag...
  // nothing to do

  var indirect = function() {
    var lowAddress = cpu.getNextWord();
    var low  = read(lowAddress);

    // Check for page boundry
    var high;
    if ((lowAddress & 0xFF) === 0xFF) {
      high = read((lowAddress >> 8) << 8);
    } else {
      high = read(lowAddress + 1);
    }

    return (high << 8) | low;
  };

  var indirectX = function() {
    var lowAddress = cpu.getNextByte() + cpu.regX;
    var low  = read(lowAddress & 0xFF);
    var high = read((lowAddress + 1) & 0xFF);
    var word = (high << 8) | low;

    return word;
  };

  var indirectY = function() {
    var lowAddress = cpu.getNextByte();
    var low  = read(lowAddress & 0xFF);
    var high = read((lowAddress + 1) & 0xFF);
    var word = (high << 8) | low;
    var addr = (word + cpu.regY) & 0xFFFF;

    return addr;
  };

  var indirectY_pageBoundry = function() {
    var lowAddress = cpu.getNextByte();
    var low  = read(lowAddress & 0xFF);
    var high = read((lowAddress + 1) & 0xFF);
    var word = (high << 8) | low;
    var addr = (word + cpu.regY);

    if ((addr >> 8) > (word >> 8)) { cpu.cycles += 1;

    }
  };

  var relative = function() {
    return cpu.getNextByte();
  };

  var zeroPage = function() {
    return cpu.getNextByte();
  };

  var zeroPageX = function() {
    return (cpu.getNextByte() + cpu.regX) & 0xFF;
  };

  var zeroPageY = function() {
    return (cpu.getNextByte() + cpu.regY) & 0xFF;
  };



  var NMI = function() {
    // cpu.pc += 2;
    // cpu.cycles += 7;

    cpu.push(cpu.pc);
    cpu.push(cpu.flags);
    setFlagBit(I);

    var low  = read(0xFFFA);
    var high = read(0xFFFB);
    cpu.pc = (high << 8) | low;
  };

  var IRQ = function() {
    // cpu.pc += 2;
    // cpu.cycles += 7;

    cpu.push(cpu.pc);
    cpu.push(cpu.flags);
    setFlagBit(I);

    var low  = read(0xFFFE);
    var high = read(0xFFFF);
    cpu.pc = (high << 8) | low;
  };

  /* OPCODES */

  var ADC = function(address) {
  // ADC               Add memory to accumulator with carry                ADC
  // Operation:  A + M + C -> A, C                         S Z C I D V
  //                                                       / / / _ _ /
    var memValue = read(address);
    var result   = memValue + cpu.accumulator + getFlag(C);

    testAndSetFlag(S, result);
    testAndSetFlag(Z, result);
    testAndSetFlag(C, result);
    testAndSetFlag(V, memValue, cpu.accumulator, result);

    write('accumulator', result);
    cpu.pc += OP_BYTES[cpu.op];
  };

  var AND = function(address) {
  // AND                  "AND" memory with accumulator                    AND
  // Operation:  A & M -> A                                S Z C I D V
  //                                                       / / _ _ _ _
    var memValue = read(address);
    var result   = memValue & cpu.accumulator;

    testAndSetFlag(S, result);
    testAndSetFlag(Z, result);

    write('accumulator', result);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var ASL = function(address) {
  // ASL          ASL Shift Left One Bit (Memory or Accumulator)           ASL
  //                  +-+-+-+-+-+-+-+-+
  // Operation:  C <- |7|6|5|4|3|2|1|0| <- 0
  //                  +-+-+-+-+-+-+-+-+                    S Z C I D V
  //                                                       / / / _ _ _
    var memValue  = read(address);
    var result    = (memValue << 1) & 0xFF;
    var c         = (memValue >> 7) & 1;

    if (c) { setFlagBit(C); } else { clearFlagBit(C); }
    testAndSetFlag(S, result);
    testAndSetFlag(Z, result);

    write(address, result);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var BCC = function(address) {
  // BCC                     BCC Branch on Carry Clear                     BCC
  //                                                       S Z C I D V
  // Operation:  Branch on C = 0                           _ _ _ _ _ _
    cpu.pc += OP_BYTES[cpu.op];

    var value = address;
    if (!getFlag(C)) {
      var branch = toSignedInt(value);
      cpu.cycles += 1;
      if (cpu.pc >> 8 < ((cpu.pc + branch) >> 8)) { cpu.cycles += 1; }

      cpu.pc += branch;
    }
  };

  var BCS = function(address) {
  //  BCS                      BCS Branch on carry set                      BCS
  // Operation:  Branch on C = 1                           S Z C I D V
  //                                                       _ _ _ _ _ _
    cpu.pc += OP_BYTES[cpu.op];

    var value = address;
    if (getFlag(C)) {
      var branch = toSignedInt(value);
      cpu.cycles += 1;
      if (cpu.pc >> 8 < ((cpu.pc + branch) >> 8)) { cpu.cycles += 1; }

      cpu.pc += branch;
    }
  };

  var BEQ = function(address) {
  // BEQ                    BEQ Branch on result zero                      BEQ
  //                                                       S Z C I D V
  // Operation:  Branch on Z = 1                           _ _ _ _ _ _
    cpu.pc += OP_BYTES[cpu.op];

    var value = address;
    if (getFlag(Z)) {
      var branch = toSignedInt(value);
      cpu.cycles += 1;
      if (cpu.pc >> 8 < ((cpu.pc + branch) >> 8)) { cpu.cycles += 1; }

      cpu.pc += branch;
    }
  };

  var BIT = function(address) {
  // BIT             BIT Test bits in memory with accumulator              BIT
  // Operation:  A & M, M7 -> S, M6 -> V

  // Bit 6 and 7 are transferred to the status register.   S Z C I D V
  // If the result of A & M is zero then Z = 1, otherwise M7 / _ _ _ M6
    var memValue = read(address);
    var result   = cpu.accumulator & memValue;

    var v = (memValue >> 6) & 1;
    if (v) { setFlagBit(V); } else { clearFlagBit(V); }

    var s = (memValue >> 7) & 1;
    if (s) { setFlagBit(S); } else { clearFlagBit(S); }

    testAndSetFlag(Z, result);

    cpu.pc += OP_BYTES[cpu.op];

  };

  var BMI = function(address) {
  // BMI                    BMI Branch on result minus                     BMI
  // Operation:  Branch on N = 1                           S Z C I D V
  //                                                       _ _ _ _ _ _
    cpu.pc += OP_BYTES[cpu.op];

    var value = address;
    if (getFlag(S)) {
      var branch = toSignedInt(value);
      cpu.cycles += 1;
      if (cpu.pc >> 8 < ((cpu.pc + branch) >> 8)) { cpu.cycles += 1; }

      cpu.pc += branch;
    }
  };

  var BNE = function(address) {
  // BNE                   BNE Branch on result not zero                   BNE
  // Operation:  Branch on Z = 0                           S Z C I D V
  //                                                       _ _ _ _ _ _
    cpu.pc += OP_BYTES[cpu.op];

    var value = address;
    if (!getFlag(Z)) {
      var branch = toSignedInt(value);
      cpu.cycles += 1;
      if (cpu.pc >> 8 < ((cpu.pc + branch) >> 8)) { cpu.cycles += 1; }

      cpu.pc += branch;
    }
  };

  var BPL = function(address) {
  // BPL                     BPL Branch on result plus                     BPL
  // Operation:  Branch on S = 0                           S Z C I D V
  //                                                       _ _ _ _ _ _
    cpu.pc += OP_BYTES[cpu.op];

    var value = address;
    if (!getFlag(S)) {
      var branch = toSignedInt(value);
      cpu.cycles += 1;
      if (cpu.pc >> 8 < ((cpu.pc + branch) >> 8)) { cpu.cycles += 1; }

      cpu.pc += branch;
    }
  };

  var BRK = function() {
  // BRK                          BRK Force Break                          BRK
  // Operation:  Forced Interrupt PC + 2 toS P toS         S Z C I D V
  //                                                       _ _ _ 1 _ _
    cpu.pc += 2;

    cpu.push(cpu.pc);
    cpu.push(cpu.flags);
    setFlagBit(B); // nestech.txt says to set

    var low  = read(0xFFFE);
    var high = read(0xFFFF);
    cpu.pc = (high << 8) | low;
  };

  var BVC = function(address) {
  // BVC                    BVC Branch on overflow clear                   BVC
  // Operation:  Branch on V = 0                           S Z C I D V
  //                                                       _ _ _ _ _ _
    cpu.pc += OP_BYTES[cpu.op];

    var value = address;
    if (!getFlag(V)) {
      var branch = toSignedInt(value);
      cpu.cycles += 1;
      if (cpu.pc >> 8 < ((cpu.pc + branch) >> 8)) { cpu.cycles += 1; }
      cpu.pc += branch;
    }
  };

  var BVS = function(address) {
  // BVS                    BVS Branch on overflow set                     BVS
  // Operation:  Branch on V = 1                           S Z C I D V
  //                                                       _ _ _ _ _ _
    cpu.pc += OP_BYTES[cpu.op];

    var value = address;
    if (getFlag(V)) {
      var branch = toSignedInt(value);
      cpu.cycles += 1;
      if (cpu.pc >> 8 < ((cpu.pc + branch) >> 8)) { cpu.cycles += 1; }

      cpu.pc += branch;
    }
  };

  var CLC = function() {
  // CLC                       CLC Clear carry flag                        CLC
  // Operation:  0 -> C                                    S Z C I D V
  //                                                       _ _ 0 _ _ _
    clearFlagBit(C);
    cpu.pc += OP_BYTES[cpu.op];
  };

  var CLD = function() {
  // CLD                      CLD Clear decimal mode                       CLD
  // Operation:  0 -> D                                    S A C I D V
  //                                                       _ _ _ _ 0 _
    clearFlagBit(D);
    cpu.pc += OP_BYTES[cpu.op];
  };

  var CLI = function() {
  // CLI                  CLI Clear interrupt disable bit                  CLI
  // Operation: 0 -> I                                     S Z C I D V
  //                                                       _ _ _ 0 _ _
    clearFlagBit(I);
    cpu.pc += OP_BYTES[cpu.op];
  };

  var CLV = function() {
  // CLV                      CLV Clear overflow flag                      CLV
  // Operation: 0 -> V                                     S Z C I D V
  //                                                       _ _ _ _ _ 0
    clearFlagBit(V);
    cpu.pc += OP_BYTES[cpu.op];
  };

  var CMP = function(address) {
  // CMP                CMP Compare memory and accumulator                 CMP
  // Operation:  A - M                                     S Z C I D V
  //                                                       / / / _ _ _
    var memValue = read(address);

    if (cpu.accumulator >= memValue) { setFlagBit(C); } else { clearFlagBit(C); }
    if (cpu.accumulator === memValue) { setFlagBit(Z); } else { clearFlagBit(Z); }

    testAndSetFlag(S, cpu.accumulator - memValue);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var CPX = function(address) {
  // CPX                  CPX Compare memory and index X                   CPX
  // Operation:  X - M                                    S Z C I D V
  //                                                      / / / _ _ _
    var memValue = read(address);

    if (cpu.regX >= memValue) { setFlagBit(C); } else { clearFlagBit(C); }
    if (cpu.regX === memValue) { setFlagBit(Z); } else { clearFlagBit(Z); }

    testAndSetFlag(S, cpu.regX - memValue);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var CPY = function(address) {
  // CPY                  CPY Compare memory and index Y                   CPY
  // Operation:  Y - M                                    S Z C I D V
  //                                                      / / / _ _ _
    var memValue = read(address);

    if (cpu.regY >= memValue) { setFlagBit(C); } else { clearFlagBit(C); }
    if (cpu.regY === memValue) { setFlagBit(Z); } else { clearFlagBit(Z); }

    testAndSetFlag(S, cpu.regY - memValue);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var DEC = function(address) {
  // DEC                   DEC Decrement memory by one                     DEC
  // Operation:  M - 1 -> M                                S Z C I D V
  //                                                       / / _ _ _ _
    var memValue = read(address);
    var result   = memValue - 1;

    testAndSetFlag(S, result);
    testAndSetFlag(Z, result);
    write(address, result);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var DEX = function() {
  // DEX                    DEX Decrement Index X by one                   DEX
  // Operation:  X - 1 -> X                                S Z C I D V
  //                                                       / / _ _ _ _
    cpu.regX = (cpu.regX - 1) & 0xFF;
    testAndSetFlag(Z, cpu.regX);
    testAndSetFlag(S, cpu.regX);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var DEY = function() {
  // DEY                    DEY Decrement Index Y by one                   DEY
  // Operation:  Y - 1 -> Y                                S Z C I D V
  //                                                       / / _ _ _ _
    cpu.regY = (cpu.regY - 1) & 0xFF;
    testAndSetFlag(Z, cpu.regY);
    testAndSetFlag(S, cpu.regY);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var EOR = function(address) {
  // EOR            EOR "Exclusive-Or" memory with accumulator             EOR
  // Operation:  A EOR M -> A                              S Z C I D V
  //                                                       / / _ _ _ _
    var memValue = read(address);
    var result   = cpu.accumulator ^ memValue;

    testAndSetFlag(Z, result);
    testAndSetFlag(S, result);
    write('accumulator', result);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var INC = function(address) {
  // INC                    INC Increment memory by one                    INC
  // Operation:  M + 1 -> M                                S Z C I D V
  //                                                       / / _ _ _ _
    var memValue = read(address);
    var result = memValue + 1;

    testAndSetFlag(Z, result);
    testAndSetFlag(S, result);
    write(address, result);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var INX = function() {
  // INX                    INX Increment Index X by one                   INX
  // Operation:  X + 1 -> X                                S Z C I D V
  //                                                       / / _ _ _ _
    cpu.regX = (cpu.regX + 1) & 0xFF;
    testAndSetFlag(Z, cpu.regX);
    testAndSetFlag(S, cpu.regX);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var INY = function() {
  // INY                    INY Increment Index Y by one                   INY
  // Operation:  Y + 1 -> Y                                S Z C I D V
  //                                                       / / _ _ _ _
    cpu.regY = (cpu.regY + 1) & 0xFF;
    testAndSetFlag(Z, cpu.regY);
    testAndSetFlag(S, cpu.regY);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var LDA = function(address) {
  // LDA                  LDA Load accumulator with memory                 LDA
  // Operation:  M -> A                                    S Z C I D V
  //                                                       / / _ _ _ _
    var memValue = read(address);

    testAndSetFlag(Z, memValue);
    testAndSetFlag(S, memValue);

    write('accumulator', memValue);
    cpu.pc += OP_BYTES[cpu.op];
  };

  var LDX = function(address) {
  // LDX                   LDX Load index X with memory                    LDX
  // Operation:  M -> X                                    S Z C I D V
  //                                                       / / _ _ _ _
    var memValue = read(address);

    testAndSetFlag(Z, memValue);
    testAndSetFlag(S, memValue);

    cpu.regX = memValue & 0xFF;
    cpu.pc += OP_BYTES[cpu.op];

  };

  var LDY = function(address) {
  // LDY                   LDY Load index Y with memory                    LDY
  // Operation: M -> Y                                     S Z C I D V
  //                                                       / / _ _ _ _
    var memValue = read(address);

    testAndSetFlag(Z, memValue);
    testAndSetFlag(S, memValue);

    cpu.regY = memValue & 0xFF;
    cpu.pc += OP_BYTES[cpu.op];

  };

  var LSR = function(address) {
  // LSR          LSR Shift right one bit (memory or accumulator)          LSR
  //                  +-+-+-+-+-+-+-+-+
  // Operation:  0 -> |7|6|5|4|3|2|1|0| -> C               S Z C I D V
  //                  +-+-+-+-+-+-+-+-+                    0 / / _ _ _
    var memValue = read(address);
    var result   = memValue >> 1;
    var c        = (memValue >> 0) & 1;

    testAndSetFlag(Z, result);
    testAndSetFlag(S, result);
    if (c) { setFlagBit(C); } else { clearFlagBit(C); }
    write(address, result);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var JMP = function(address) {
  // JMP                     JMP Jump to new location                      JMP
  // Operation:  (PC + 1) -> PCL                           S Z C I D V
  //             (PC + 2) -> PCH                           _ _ _ _ _ _
    cpu.pc = address;
  };

  var JSR = function(address) {
  // JSR          JSR Jump to new location saving return address           JSR
  // Operation:  PC + 2 toS, (PC + 1) -> PCL               S Z C I D V
  //                         (PC + 2) -> PCH               _ _ _ _ _ _
    var pc = cpu.pc + 2;
    cpu.push((pc >> 8) & 0xFF); // high byte
    cpu.push(pc & 0xFF);        // low byte

    cpu.pc = address;
  };

  var NOP = function() {
  // NOP                         NOP No operation                          NOP
  //                                                       S Z C I D V
  // Operation:  No Operation (2 cycles)                   _ _ _ _ _ _

    cpu.pc += OP_BYTES[cpu.op];
  };

  var ORA = function(address) {
  // ORA                 ORA "OR" memory with accumulator                  ORA
  // Operation: A | M -> A                                 S Z C I D V
  //                                                       / / _ _ _ _
    var memValue = read(address);
    var result = cpu.accumulator | memValue;

    testAndSetFlag(S, result);
    testAndSetFlag(Z, result);

    write('accumulator', result);
    cpu.pc += OP_BYTES[cpu.op];
  };

  var PHA = function() {
  // PHA                   PHA Push accumulator on stack                   PHA
  // Operation:  A toS                                     S Z C I D V
  //                                                       _ _ _ _ _ _
    cpu.push(cpu.accumulator);
    cpu.pc += OP_BYTES[cpu.op];
  };

  var PHP = function() {
  // PHP                 PHP Push processor status on stack                PHP
  // Operation:  P toS                                     S Z C I D V
  //                                                       _ _ _ _ _ _
    cpu.push(cpu.flags | 0x10); // set break flag on pushed flag

    cpu.pc += OP_BYTES[cpu.op];
  };

  var PLA = function() {
  // PLA                 PLA Pull accumulator from stack                   PLA
  // Operation:  A fromS                                   S Z C I D V
  //                                                       / / _ _ _ _
    var result = cpu.pull();
    testAndSetFlag(Z, result);
    testAndSetFlag(S, result);

    write('accumulator', result);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var PLP = function() {
  // PLP               PLP Pull processor status from stack                PLA
  // Operation:  P fromS                                   S Z C I D V
  //                                                       From Stack
    cpu.flags = cpu.pull();
    clearFlagBit(4);
    setFlagBit(5); // Should alwasy be set

    cpu.pc += OP_BYTES[cpu.op];
  };

  var ROL = function(address) {
  // ROL          ROL Rotate one bit left (memory or accumulator)          ROL
  //              +------------------------------+
  //              |         M or A               |
  //              |   +-+-+-+-+-+-+-+-+    +-+   |
  // Operation:   +-< |7|6|5|4|3|2|1|0| <- |C| <-+         S Z C I D V
  //                  +-+-+-+-+-+-+-+-+    +-+             / / / _ _ _
    var memValue = read(address);
    var result   = ((memValue << 1) | getFlag(C)) & 0xFF;
    var c        = (memValue >> 7) & 1;

    if (c) { setFlagBit(C); } else { clearFlagBit(C); }
    testAndSetFlag(Z, result);
    testAndSetFlag(S, result);

    write(address, result);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var ROR = function(address) {
  // ROR          ROR Rotate one bit right (memory or accumulator)         ROR
  //              +------------------------------+
  //              |                              |
  //              |   +-+    +-+-+-+-+-+-+-+-+   |
  // Operation:   +-> |C| -> |7|6|5|4|3|2|1|0| >-+         S Z C I D V
  //                  +-+    +-+-+-+-+-+-+-+-+             / / / _ _ _
    var memValue = read(address);
    var result   = ((memValue >> 1) | ((getFlag(C) << 7) & 0xFF));
    var c        = (memValue >> 0) & 1;

    if (c) { setFlagBit(C); } else { clearFlagBit(C); }
    testAndSetFlag(Z, result);
    testAndSetFlag(S, result);

    write(address, result);

    cpu.pc +=OP_BYTES[cpu.op];
  };

  var RTI = function() {
  // RTI                    RTI Return from interrupt                      RTI
  // Operation:  P fromS PC fromS                         S Z C I D V
  //                                                      From Stack
    cpu.flags = cpu.pull();
    setFlagBit(5);

    var low  = cpu.pull();
    var high = cpu.pull();
    var word = (high << 8) | low;

    cpu.pc = word;
  };

  var RTS = function() {
  // RTS                    RTS Return from subroutine                     RTS
  //                                                       S Z C I D V
  // Operation:  PC fromS, PC + 1 -> PC                    _ _ _ _ _ _
    var low  = cpu.pull();
    var high = cpu.pull();
    var word = (high << 8) | low;

    cpu.pc = word;
    cpu.pc += OP_BYTES[cpu.op];
  };

  var SBC = function(address) {
  // SBC          SBC Subtract memory from accumulator with borrow         SBC
  // Operation:  A - M - C -> A                            S Z C I D V
  //                                                       / / / _ _ /
    var memValue = read(address);
    var result = cpu.accumulator - memValue - (!getFlag(C));

    testAndSetFlag(S, result);
    testAndSetFlag(Z, result);

    // http://www.righto.com/2012/12/the-6502-overflow-flag-explained.html
    // Set V is bit 7 doesn't match
    var v1 = (cpu.accumulator >> 7) & 1;
    var v2 = (memValue >> 7) & 1;
    if (v1 !== v2) { setFlagBit(V); } else { clearFlagBit(V); }

    if (result >= 0 && result <= 255) {
      setFlagBit(C);
    } else {
      clearFlagBit(C);
    }

    write('accumulator', result);
    cpu.pc += OP_BYTES[cpu.op];
  };

  var SEC = function() {
  // SEC                        SEC Set carry flag                         SEC
  //                                                       S Z C I D V
  // Operation:  1 -> C                                    _ _ 1 _ _ _
    setFlagBit(C);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var SED = function() {
  // SED                       SED Set decimal mode                        SED
  //                                                       S Z C I D V
  // Operation:  1 -> D                                    _ _ _ _ 1 _
    setFlagBit(D);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var SEI = function() {
  // SEI                 SEI Set interrupt disable status                  SED
  //                                                       S Z C I D V
  // Operation:  1 -> I                                    _ _ _ 1 _ _
    setFlagBit(I);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var STA = function(address) {
  // STA                  STA Store accumulator in memory                  STA
  // Operation:  A -> M                                    S Z C I D V
  //                                                       _ _ _ _ _ _
    write(address, cpu.accumulator);
    cpu.pc += OP_BYTES[cpu.op];
  };

  var STX = function(address) {
  // STX                    STX Store index X in memory                    STX
  // Operation: X -> M                                     S Z C I D V
  //                                                       _ _ _ _ _ _
    write(address, cpu.regX);
    cpu.pc += OP_BYTES[cpu.op];
  };

  var STY = function(address) {
  // STY                    STY Store index Y in memory                    STY
  // Operation: Y -> M                                     S Z C I D V
  //                                                       _ _ _ _ _ _
    write(address, cpu.regY);
    cpu.pc += OP_BYTES[cpu.op];
  };

  var TAX = function() {
  // TAX                TAX Transfer accumulator to index X                TAX
  // Operation:  A -> X                                    S Z C I D V
  //                                                       / / _ _ _ _
    cpu.regX = cpu.accumulator;
    testAndSetFlag(S, cpu.regX);
    testAndSetFlag(Z, cpu.regX);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var TAY = function() {
  // TAY                TAY Transfer accumulator to index Y                TAY
  // Operation:  A -> Y                                    S Z C I D V
  //                                                       / / _ _ _ _
    cpu.regY = cpu.accumulator;
    testAndSetFlag(S, cpu.regY);
    testAndSetFlag(Z, cpu.regY);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var TSX = function() {
  // TSX              TSX Transfer stack pointer to index X                TSX
  // Operation:  S -> X                                    S Z C I D V
  //                                                       / / _ _ _ _
    cpu.regX = cpu.sp;
    testAndSetFlag(S, cpu.regX);
    testAndSetFlag(Z, cpu.regX);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var TXA = function() {
  // TXA                TYX Transfer index X to accumulator                TYX
  // Operation:  X -> A                                    S Z C I D V
  //                                                       / / _ _ _ _
    cpu.accumulator = cpu.regX;
    testAndSetFlag(S, cpu.accumulator);
    testAndSetFlag(Z, cpu.accumulator);

    cpu.pc += OP_BYTES[cpu.op];
  };

  var TXS = function() {
  // TXS              TXS Transfer index X to stack pointer                TXS
  // Operation:  X -> S                                    S Z C I D V
  //                                                       _ _ _ _ _ _
    cpu.sp = cpu.regX;

    cpu.pc += OP_BYTES[cpu.op];
  };

  var TYA = function() {
  // TYA                TYA Transfer index Y to accumulator                TYA
  // Operation:  Y -> A                                    S Z C I D V
  //                                                       / / _ _ _ _
    cpu.accumulator = cpu.regY;
    testAndSetFlag(S, cpu.accumulator);
    testAndSetFlag(Z, cpu.accumulator);

    cpu.pc += OP_BYTES[cpu.op];
  };


  // EXECUTE

  var stepCount = 1;
  cpu.step = function() {
    cpu.op = nes.memory.read(cpu.pc);
    console.log(stepCount + ': ' +
                cpu.pc.toString(16) +
                ' OP: ' + cpu.op.toString(16) +
                ' A: ' + cpu.accumulator.toString(16) +
                ' X: ' + cpu.regX.toString(16) +
                ' Y: ' + cpu.regY.toString(16) +
                ' P: ' + cpu.flags.toString(16) +
                ' SP: ' + cpu.sp.toString(16) +
                ' cyc: ' + (cpu.cycles * 3) % 341
    );
    stepCount += 1;

  // JSPerf says switch is 66% faster than a map
  switch (cpu.op) {
    case 0x00:
      cpu.cycles += 7;
      BRK();
      break;
    case 0x01:
      cpu.cycles += 6;
      ORA(indirectX());
      break;
    case 0x05:
      cpu.cycles += 3;
      ORA(zeroPage());
      break;
    case 0x06:
      cpu.cycles += 5;
      ASL(zeroPage());
      break;
    case 0x08:
      cpu.cycles += 3;
      PHP();
      break;
    case 0x09:
      cpu.cycles += 2;
      ORA(immediate());
      break;
   case 0x0A:
      cpu.cycles += 2;
      ASL(accumulator());
      break;
    case 0x0D:
      cpu.cycles += 4;
      ORA(absolute());
      break;
    case 0x0E:
      cpu.cycles += 6;
      ASL(absolute());
      break;
    case 0x10:
      cpu.cycles += 2;
      BPL(relative());
      break;
    case 0x11:
      indirectY_pageBoundry();
      cpu.cycles += 5;
      ORA(indirectY());
      break;
    case 0x15:
      cpu.cycles += 4;
      ORA(zeroPageX());
      break;
    case 0x16:
      cpu.cycles += 6;
      ASL(zeroPageX());
      break;
    case 0x18:
      cpu.cycles += 2;
      CLC();
      break;
    case 0x19:
      absoluteY_pageBoundry();
      cpu.cycles += 4;
      ORA(absoluteY());
      break;
    case 0x1D:
      absoluteX_pageBoundry();
      cpu.cycles += 4;
      ORA(absoluteX());
      break;
    case 0x1E:
      cpu.cycles += 7;
      ASL(absoluteX());
      break;
    case 0x20:
      cpu.cycles += 6;
      JSR(absolute());
      break;
    case 0x21:
      cpu.cycles += 6;
      AND(indirectX());
      break;
    case 0x24:
      cpu.cycles += 3;
      BIT(zeroPage());
      break;
    case 0x25:
      cpu.cycles += 3;
      AND(zeroPage());
      break;
    case 0x26:
      cpu.cycles += 5;
      ROL(zeroPage());
      break;
    case 0x28:
      cpu.cycles += 4;
      PLP();
      break;
    case 0x29:
      cpu.cycles += 2;
      AND(immediate());
      break;
    case 0x2A:
      cpu.cycles += 2;
      ROL(accumulator());
      break;
    case 0x2C:
      cpu.cycles += 4;
      BIT(absolute());
      break;
    case 0x2D:
      cpu.cycles += 4;
      AND(absolute());
      break;
    case 0x2E:
      cpu.cycles += 6;
      ROL(absolute());
      break;
    case 0x30:
      cpu.cycles += 2;
      BMI(relative());
      break;
    case 0x31:
      indirectY_pageBoundry();
      cpu.cycles += 5;
      AND(indirectY());
      break;
    case 0x35:
      cpu.cycles += 4;
      AND(zeroPageX());
      break;
    case 0x36:
      cpu.cycles += 6;
      ROL(zeroPageX());
      break;
    case 0x38:
      cpu.cycles += 2;
      SEC();
      break;
    case 0x39:
      absoluteY_pageBoundry();
      cpu.cycles += 4;
      AND(absoluteY());
      break;
    case 0x3D:
      absoluteX_pageBoundry();
      cpu.cycles += 4;
      AND(absoluteX());
      break;
    case 0x3E:
      cpu.cycles += 7;
      ROL(absoluteX());
      break;
    case 0x40:
      cpu.cycles += 6;
      RTI();
      break;
    case 0x41:
      cpu.cycles += 6;
      EOR(indirectX());
      break;
    case 0x45:
      cpu.cycles += 3;
      EOR(zeroPage());
      break;
    case 0x46:
      cpu.cycles += 5;
      LSR(zeroPage());
      break;
    case 0x48:
      cpu.cycles += 3;
      PHA();
      break;
    case 0x49:
      cpu.cycles += 2;
      EOR(immediate());
      break;
    case 0x4A:
      cpu.cycles += 2;
      LSR(accumulator());
      break;
    case 0x4C:
      cpu.cycles += 3;
      JMP(absolute());
      break;
    case 0x4D:
      cpu.cycles += 4;
      EOR(absolute());
      break;
    case 0x4E:
      cpu.cycles += 6;
      LSR(absolute());
      break;
    case 0x50:
      cpu.cycles += 2;
      BVC(relative());
      break;
    case 0x51:
      indirectY_pageBoundry();
      cpu.cycles += 5;
      EOR(indirectY());
      break;
    case 0x55:
      cpu.cycles += 4;
      EOR(zeroPageX());
      break;
    case 0x56:
      cpu.cycles += 6;
      LSR(zeroPageX());
      break;
    case 0x58:
      cpu.cycles += 2;
      CLI();
      break;
    case 0x59:
      absoluteY_pageBoundry();
      cpu.cycles += 4;
      EOR(absoluteY());
      break;
    case 0x5D:
      absoluteX_pageBoundry();
      cpu.cycles += 4;
      EOR(absoluteX());
      break;
    case 0x5E:
      cpu.cycles += 7;
      LSR(absoluteX());
      break;
    case 0x60:
      cpu.cycles += 6;
      RTS();
      break;
    case 0x61:
      cpu.cycles += 6;
      ADC(indirectX());
      break;
    case 0x65:
      cpu.cycles += 3;
      ADC(zeroPage());
      break;
    case 0x66:
      cpu.cycles += 5;
      ROR(zeroPage());
      break;
    case 0x68:
      cpu.cycles += 4;
      PLA();
      break;
    case 0x69:
      cpu.cycles += 2;
      ADC(immediate());
      break;
    case 0x6A:
      cpu.cycles += 2;
      ROR(accumulator());
      break;
    case 0x6C:
      cpu.cycles += 5;
      JMP(indirect());
      break;
    case 0x6D:
      cpu.cycles += 4;
      ADC(absolute());
      break;
    case 0x6E:
      cpu.cycles += 6;
      ROR(absolute());
      break;
    case 0x70:
      cpu.cycles += 2;
      BVS(relative());
      break;
    case 0x71:
      indirectY_pageBoundry();
      cpu.cycles += 5;
      ADC(indirectY());
      break;
    case 0x75:
      cpu.cycles += 4;
      ADC(zeroPageX());
      break;
    case 0x76:
      cpu.cycles += 6;
      ROR(zeroPageX());
      break;
    case 0x78:
      cpu.cycles += 2;
      SEI();
      break;
    case 0x79:
      absoluteY_pageBoundry();
      cpu.cycles += 4;
      ADC(absoluteY());
      break;
    case 0x7D:
      absoluteX_pageBoundry();
      cpu.cycles += 4;
      ADC(absoluteX());
      break;
    case 0x7E:
      cpu.cycles += 7;
      ROR(absoluteX());
      break;
    case 0x81:
      cpu.cycles += 6;
      STA(indirectX());
      break;
    case 0x84:
      cpu.cycles += 3;
      STY(zeroPage());
      break;
    case 0x85:
      cpu.cycles += 3;
      STA(zeroPage());
      break;
    case 0x86:
      cpu.cycles += 3;
      STX(zeroPage());
      break;
    case 0x88:
      cpu.cycles += 2;
      DEY();
      break;
    case 0x8A:
      cpu.cycles += 2;
      TXA();
      break;
    case 0x8C:
      cpu.cycles += 4;
      STY(absolute());
      break;
    case 0x8D:
      cpu.cycles += 4;
      STA(absolute());
      break;
    case 0x8E:
      cpu.cycles += 4;
      STX(absolute());
      break;
    case 0x90:
      cpu.cycles += 2;
      BCC(relative());
      break;
    case 0x91:
      cpu.cycles += 6;
      STA(indirectY());
      break;
    case 0x94:
      cpu.cycles += 4;
      STY(zeroPageX());
      break;
    case 0x95:
      cpu.cycles += 4;
      STA(zeroPageX());
      break;
    case 0x96:
      cpu.cycles += 4;
      STX(zeroPageY());
      break;
    case 0x98:
      cpu.cycles += 2;
      TYA();
      break;
    case 0x99:
      cpu.cycles += 5;
      STA(absoluteY());
      break;
    case 0x9A:
      cpu.cycles += 2;
      TXS();
      break;
    case 0x9D:
      cpu.cycles += 5;
      STA(absoluteX());
      break;
    case 0xA0:
      cpu.cycles += 2;
      LDY(immediate());
      break;
    case 0xA1:
      cpu.cycles += 6;
      LDA(indirectX());
      break;
    case 0xA2:
      cpu.cycles += 2;
      LDX(immediate());
      break;
    case 0xA4:
      cpu.cycles += 3;
      LDY(zeroPage());
      break;
    case 0xA5:
      cpu.cycles += 3;
      LDA(zeroPage());
      break;
    case 0xA6:
      cpu.cycles += 3;
      LDX(zeroPage());
      break;
    case 0xA8:
      cpu.cycles += 2;
      TAY();
      break;
    case 0xA9:
      cpu.cycles += 2;
      LDA(immediate());
      break;
    case 0xAA:
      cpu.cycles += 2;
      TAX();
      break;
    case 0xAC:
      cpu.cycles += 4;
      LDY(absolute());
      break;
    case 0xAD:
      cpu.cycles += 4;
      LDA(absolute());
      break;
    case 0xAE:
      cpu.cycles += 4;
      LDX(absolute());
      break;
    case 0xB0:
      cpu.cycles += 2;
      BCS(relative());
      break;
    case 0xB1:
      indirectY_pageBoundry();
      cpu.cycles += 5;
      LDA(indirectY());
      break;
    case 0xB4:
      cpu.cycles += 4;
      LDY(zeroPageX());
      break;
    case 0xB5:
      cpu.cycles += 4;
      LDA(zeroPageX());
      break;
    case 0xB6:
      cpu.cycles += 4;
      LDX(zeroPageY());
      break;
    case 0xB8:
      cpu.cycles += 2;
      CLV();
      break;
    case 0xB9:
      absoluteY_pageBoundry();
      cpu.cycles += 4;
      LDA(absoluteY());
      break;
    case 0xBD:
      absoluteX_pageBoundry();
      cpu.cycles += 4;
      LDA(absoluteX());
      break;
    case 0xBE:
      absoluteY_pageBoundry();
      cpu.cycles += 4;
      LDX(absoluteY());
      break;
    case 0xBA:
      cpu.cycles += 2;
      TSX();
      break;
    case 0xBC:
      absoluteX_pageBoundry();
      cpu.cycles += 4;
      LDY(absoluteX());
      break;
    case 0xC0:
      cpu.cycles += 2;
      CPY(immediate());
      break;
    case 0xC1:
      cpu.cycles += 6;
      CMP(indirectX());
      break;
    case 0xC4:
      cpu.cycles += 3;
      CPY(zeroPage());
      break;
    case 0xC5:
      cpu.cycles += 3;
      CMP(zeroPage());
      break;
    case 0xC6:
      cpu.cycles += 5;
      DEC(zeroPage());
      break;
    case 0xC8:
      cpu.cycles += 2;
      INY();
      break;
    case 0xC9:
      cpu.cycles += 2;
      CMP(immediate());
      break;
    case 0xCA:
      cpu.cycles += 2;
      DEX();
      break;
    case 0xCC:
      cpu.cycles += 4;
      CPY(absolute());
      break;
    case 0xCD:
      cpu.cycles += 4;
      CMP(absolute());
      break;
    case 0xCE:
      cpu.cycles += 6;
      DEC(absolute());
      break;
    case 0xD0:
      cpu.cycles += 2;
      BNE(relative());
      break;
    case 0xD1:
      indirectY_pageBoundry();
      cpu.cycles += 5;
      CMP(indirectY());
      break;
    case 0xD5:
      cpu.cycles += 4;
      CMP(zeroPageX());
      break;
    case 0xD6:
      cpu.cycles += 6;
      DEC(zeroPageX());
      break;
    case 0xD8:
      cpu.cycles += 2;
      CLD();
      break;
    case 0xD9:
      absoluteY_pageBoundry();
      cpu.cycles += 4;
      CMP(absoluteY());
      break;
    case 0xDD:
      absoluteX_pageBoundry();
      cpu.cycles += 4;
      CMP(absoluteX());
      break;
    case 0xDE:
      cpu.cycles += 7;
      DEC(absoluteX());
      break;
    case 0xE0:
      cpu.cycles += 2;
      CPX(immediate());
      break;
    case 0xE1:
      cpu.cycles += 6;
      SBC(indirectX());
      break;
    case 0xE4:
      cpu.cycles += 3;
      CPX(zeroPage());
      break;
    case 0xE5:
      cpu.cycles += 3;
      SBC(zeroPage());
      break;
    case 0xE6:
      cpu.cycles += 5;
      INC(zeroPage());
      break;
    case 0xE8:
      cpu.cycles += 2;
      INX();
      break;
    case 0xE9:
      cpu.cycles += 2;
      SBC(immediate());
      break;
    case 0xEA:
      cpu.cycles += 2;
      NOP();
      break;
    case 0xEC:
      cpu.cycles += 4;
      CPX(absolute());
      break;
    case 0xED:
      cpu.cycles += 4;
      SBC(absolute());
      break;
    case 0xEE:
      cpu.cycles += 6;
      INC(absolute());
      break;
    case 0xF0:
      cpu.cycles += 2;
      BEQ(relative());
      break;
    case 0xF1:
      indirectY_pageBoundry();
      cpu.cycles += 5;
      SBC(indirectY());
      break;
    case 0xF5:
      cpu.cycles += 4;
      SBC(zeroPageX());
      break;
    case 0xF6:
      cpu.cycles += 6;
      INC(zeroPageX());
      break;
    case 0xF8:
      cpu.cycles += 2;
      SED();
      break;
    case 0xF9:
      absoluteY_pageBoundry();
      cpu.cycles += 4;
      SBC(absoluteY());
      break;
    case 0xFD:
      absoluteX_pageBoundry();
      cpu.cycles += 4;
      SBC(absoluteX());
      break;
    case 0xFE:
      cpu.cycles += 7;
      INC(absoluteX());
      break;
    default:
      console.log('UKN OP: ' + '0x' + cpu.op.toString(16));
      console.log('Bytes : ' + OP_BYTES[cpu.op]);
      throw new Error('UKN OP!');
   }
  };
