(function() {
  'use strict';

  var disasm = {};
  var prgData;

  disasm.loadPrg = function() {
    prgData = nes.rom.prgData;
  };

  var opcodes = [
    'BRK', 'ORA', 'UKN', 'UKN', 'UKN', 'ORA', 'ASL', 'UKN',
    'PHP', 'ORA', 'ASL', 'UKN', 'UKN', 'ORA', 'ASL', 'UKN',
    'BPL', 'ORA', 'UKN', 'UKN', 'UKN', 'ORA', 'ASL', 'UKN',
    'CLC', 'ORA', 'UKN', 'UKN', 'UKN', 'ORA', 'ASL', 'UKN',
    'JSR', 'AND', 'UKN', 'UKN', 'BIT', 'AND', 'ROL', 'UKN',
    'PLP', 'AND', 'ROL', 'UKN', 'BIT', 'AND', 'ROL', 'UKN',
    'BMI', 'AND', 'UKN', 'UKN', 'UKN', 'AND', 'ROL', 'UKN',
    'SEC', 'AND', 'UKN', 'UKN', 'UKN', 'AND', 'ROL', 'UKN',
    'RTI', 'EOR', 'UKN', 'UKN', 'UKN', 'EOR', 'LSR', 'UKN',
    'PHA', 'EOR', 'LSR', 'UKN', 'JMP', 'EOR', 'LSR', 'UKN',
    'BVC', 'EOR', 'UKN', 'UKN', 'UKN', 'EOR', 'LSR', 'UKN',
    'CLI', 'EOR', 'UKN', 'UKN', 'UKN', 'EOR', 'LSR', 'UKN',
    'RTS', 'ADC', 'UKN', 'UKN', 'UKN', 'ADC', 'ROR', 'UKN',
    'PLA', 'ADC', 'ROR', 'UKN', 'JMP', 'ADC', 'ROR', 'UKN',
    'BVS', 'ADC', 'UKN', 'UKN', 'UKN', 'ADC', 'ROR', 'UKN',
    'SEI', 'ADC', 'UKN', 'UKN', 'UKN', 'ADC', 'ROR', 'UKN',
    'UKN', 'STA', 'UKN', 'UKN', 'STY', 'STA', 'STX', 'UKN',
    'DEY', 'UKN', 'TXA', 'UKN', 'STY', 'STA', 'STX', 'UKN',
    'BCC', 'STA', 'UKN', 'UKN', 'STY', 'STA', 'STX', 'UKN',
    'TYA', 'STA', 'TXS', 'UKN', 'UKN', 'STA', 'UKN', 'UKN',
    'LDY', 'LDA', 'LDX', 'UKN', 'LDY', 'LDA', 'LDX', 'UKN',
    'TAY', 'LDA', 'TAX', 'UKN', 'LDY', 'LDA', 'LDX', 'UKN',
    'BCS', 'LDA', 'UKN', 'UKN', 'LDY', 'LDA', 'LDX', 'UKN',
    'CLV', 'LDA', 'TSX', 'UKN', 'LDY', 'LDA', 'LDX', 'UKN',
    'CPY', 'CMP', 'UKN', 'UKN', 'CPY', 'CMP', 'DEC', 'UKN',
    'INY', 'CMP', 'DEX', 'UKN', 'CPY', 'CMP', 'DEC', 'UKN',
    'BNE', 'CMP', 'UKN', 'UKN', 'UKN', 'CMP', 'DEC', 'UKN',
    'CLD', 'CMP', 'UKN', 'UKN', 'UKN', 'CMP', 'DEC', 'UKN',
    'CPX', 'SBC', 'UKN', 'UKN', 'CPX', 'SBC', 'INC', 'UKN',
    'INX', 'SBC', 'NOP', 'UKN', 'CPX', 'SBC', 'INC', 'UKN',
    'BEQ', 'SBC', 'UKN', 'UKN', 'UKN', 'SBC', 'INC', 'UKN',
    'SED', 'SBC', 'UKN', 'UKN', 'UKN', 'SBC', 'INC', 'UKN'
  ];


  var opbytes = [
  //0  1  2  3  4  5  6  7  8  9  A  B  C  D  E  F
    1, 2, 0, 0, 0, 2, 2, 0, 1, 2, 1, 0, 0, 3, 3, 0, // 0
    2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0, // 1
    3, 2, 0, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0, // 2
    2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0, // 3
    1, 2, 0, 0, 0, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0, // 4
    2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0, // 5
    1, 2, 0, 0, 0, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0, // 6
    2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0, // 7
    0, 2, 0, 0, 2, 2, 2, 0, 1, 0, 1, 0, 3, 3, 3, 0, // 8
    2, 2, 0, 0, 2, 2, 2, 0, 1, 3, 1, 0, 0, 3, 0, 0, // 9
    2, 2, 2, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0, // A
    2, 2, 0, 0, 2, 2, 2, 0, 1, 3, 1, 0, 3, 3, 3, 0, // B
    2, 2, 0, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0, // C
    2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0, // D
    2, 2, 0, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0, // E
    2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0, // F
  ];
  // Fetch op
  // Fetch Bytes needed
  // Format
  //

  var bytecount = 0;

  var hex = function(num) {
    var h = num.toString(16);
    if (h.length < 2) { h = "0" + h; }
    h = "$" + h.toUpperCase();

    return h;
  };

  var getNthByte = function(n) {
    var nb = prgData[bytecount + n];
    return nb;
  };


  // Accumulator
  var acc = function() {
    return 'A';
  };

  // Absolute
  var abs = function() {
    var a = hex(getNthByte(1));
    return a;
  };

  // Absolute,X
  var abx = function() {
    var a = hex(getNthByte(1));
    return a + ',X';
  };

  // Absolute,Y
  var aby = function() {
    var a = hex(getNthByte(1));
    return a + ',Y';
  };

  // Immediate
  var imd = function() {
    var h = getNthByte(1);
        h = h.toString(16);
    if (h.length < 2) { h = '0' + h; }
    return '#' + h.toUpperCase();
  };

  // Implied/Implicit
  var imp = function() {
    return '';
  };

  // Indirect
  var ind = function() {
    var h = getNthByte(1);
    var l = getNthByte(2);
        l = l.toString(16);
    if (l.length < 2) { l = "0" + l; }

    return '(' + hex(h) + l + ')';
  };

  // (Indirect,X)
  var inx = function() {
    var i = getNthByte(1);
    return '(' + hex(i) + ',X)';
  };

  // (Indirect),Y
  var iny = function() {
    var i = getNthByte(1);
    return '(' + hex(i) + '),Y';
  };

  // Non offical opcode
  var nos = function() {
    throw new Error('Unsupprted Op');
  };

  // Relative
  var rel = function() {
    var b = getNthByte(1);
    var n = 127 * 2;
        b = (b + 127) % n - 127;
        b = b >= 0 ? '+' + b : b;
        return '*' + b;
  };

  // Zero Page
  var zpg = function() {
    return hex(getNthByte(1));
  };

  // Zero Page,X
  var zpx = function() {
    var zx = hex(getNthByte(1));
        zx += ',X';
    return zx;
  };

  // Zero Page,Y
  var zpy = function() {
    var zy = hex(getNthByte(1));
        zy += ',Y';
    return zy;
  };


  var opaddressmode = [
    imp, inx, nos, nos, nos, zpg, zpg, nos,
    imp, imd, acc, nos, nos, abs, abs, nos,
    rel, iny, nos, nos, nos, zpx, zpx, nos,
    imp, aby, nos, nos, nos, abx, abx, nos,
    abs, inx, nos, nos, zpg, zpg, zpg, nos,
    imp, imd, acc, nos, abs, abs, abs, nos,
    rel, iny, nos, nos, nos, zpx, zpx, nos,
    imp, aby, nos, nos, nos, abx, abx, nos,
    imp, inx, nos, nos, nos, zpg, zpg, nos,
    imp, imd, acc, nos, abs, abs, abs, nos,
    rel, iny, nos, nos, nos, zpx, zpx, nos,
    imp, aby, nos, nos, nos, abx, abx, nos,
    imp, inx, nos, nos, nos, zpg, zpg, nos,
    imp, imd, acc, nos, ind, abs, abs, nos,
    rel, iny, nos, nos, nos, zpx, zpx, nos,
    imp, aby, nos, nos, nos, abx, abx, nos,
    nos, inx, nos, nos, zpg, zpg, zpg, nos,
    imp, nos, imp, nos, abs, abs, abs, nos,
    rel, iny, nos, nos, zpx, zpx, zpy, nos,
    imp, aby, imp, nos, nos, abx, nos, nos,
    imd, inx, imd, nos, zpg, zpg, zpg, nos,
    imp, imd, imp, nos, abs, abs, abs, nos,
    rel, inx, nos, nos, zpx, zpx, zpy, nos,
    imp, aby, imp, nos, abx, abx, aby, nos,
    imd, inx, nos, nos, zpg, zpg, zpg, nos,
    imp, imd, imp, nos, abs, abs, abs, nos,
    rel, iny, nos, nos, nos, zpx, zpx, nos,
    imp, aby, nos, nos, nos, abx, abx, nos,
    imd, inx, nos, nos, zpg, zpg, zpg, nos,
    imp, imd, imp, nos, abs, abs, abs, nos,
    rel, iny, nos, nos, nos, zpx, zpx, nos,
    imp, aby, nos, nos, nos, abx, abx, nos,
  ];




  disasm.step = function() {
    var op = prgData[bytecount];
    console.log(opcodes[op], opaddressmode[op]());
    bytecount += opbytes[op];
  };


  disasm.run = function() {
    disasm.loadPrg();
    for (;bytecount < prgData.length;) {
      disasm.step();
    }
  };

  window.nes = window.nes || {};
  window.nes.disasm = disasm;

}());
