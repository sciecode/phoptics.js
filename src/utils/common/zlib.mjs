export default () => {
  // MEMORY

  class Memory {

    static allocate_layout(layout) {
      let sum = 0;
      for (const key in layout) {
        const entry = layout[key];
        entry.start = sum;
        sum += aligned(entry.count * entry.type.bytes);
      }

      const buffer = new ArrayBuffer(sum);
      for (const key in layout) {
        const entry = layout[key];
        layout[key] = new entry.type.array(buffer, entry.start, entry.count);
      }

      return layout;
    }

  }

  const u8 = (v) => v & 0xFF;
  const aligned = (size) => (size + 3) & ~3;
  const memcpy = (dst, dst_offset, src, src_offset, length) =>
    dst.set(src.subarray(src_offset, src_offset + length), dst_offset);

  class TYPE {
    static get u16()  { return { id: 3,  bytes: 2, array: Uint16Array } }
    static get u32()  { return { id: 6,  bytes: 4, array: Uint32Array } }
  }

  // ZLIB

  const DEFLATE_NUM_PRECODE_SYMS =  19;
  const DEFLATE_NUM_LITLEN_SYMS =   288;
  const DEFLATE_NUM_OFFSET_SYMS =   32;

  const DEFLATE_MAX_NUM_SYMS =      288;
  const DEFLATE_MAX_LENS_OVERRUN =  137;

  const PRECODE_TABLEBITS	= 7;
  const LITLEN_TABLEBITS =  11;
  const OFFSET_TABLEBITS =  8;
  const PRECODE_ENOUGH =    128;
  const LITLEN_ENOUGH =     2342;
  const OFFSET_ENOUGH =     402;

  const DEFLATE_NUM_LITERALS =    256;
  const DEFLATE_MAX_MATCH_LEN =     258;

  const DEFLATE_MAX_PRE_CODEWORD_LEN =    7;
  const DEFLATE_MAX_CODEWORD_LEN =        15;
  const DEFLATE_MAX_LITLEN_CODEWORD_LEN	= 15;
  const DEFLATE_MAX_OFFSET_CODEWORD_LEN = 15;

  const DEFLATE_MAX_EXTRA_LENGTH_BITS	=	5;
  const DEFLATE_MAX_EXTRA_OFFSET_BITS	=	13;

  const HUFFDEC_LITERAL =           0x80000000;
  const HUFFDEC_EXCEPTIONAL =       0x00008000;
  const HUFFDEC_SUBTABLE_POINTER =  0x00004000;
  const HUFFDEC_END_OF_BLOCK =      0x00002000;

  const DEFLATE_BLOCKTYPE_UNCOMPRESSED =		0;
  const DEFLATE_BLOCKTYPE_DYNAMIC_HUFFMAN =	2;

  const ZLIB_MIN_HEADER_SIZE =  2
  const ZLIB_FOOTER_SIZE	=     4
  const ZLIB_MIN_OVERHEAD	=     ZLIB_MIN_HEADER_SIZE + ZLIB_FOOTER_SIZE;
  const ZLIB_CM_DEFLATE =       8
  const ZLIB_CINFO_32K_WINDOW =	7

  const LENGTH_MAXBITS = DEFLATE_MAX_LITLEN_CODEWORD_LEN + DEFLATE_MAX_EXTRA_LENGTH_BITS;

  const OFFSET_MAXBITS	=	DEFLATE_MAX_OFFSET_CODEWORD_LEN + DEFLATE_MAX_EXTRA_OFFSET_BITS;
  const OFFSET_MAXFASTBITS = OFFSET_TABLEBITS + DEFLATE_MAX_EXTRA_OFFSET_BITS;

  const WORDBYTES = 4;
  const BITBUF_NBITS = 32;
  const MAX_BITSLEFT = BITBUF_NBITS;
  const CONSUMABLE_NBITS = MAX_BITSLEFT - 7;
  const FASTLOOP_PRELOADABLE_NBITS = CONSUMABLE_NBITS;
  const PRELOAD_SLACK	= Math.max(0, FASTLOOP_PRELOADABLE_NBITS - MAX_BITSLEFT);

  const ROUND_UP = (n, d) => ((n + d - 1) / (d)) | 0;
  const BITMASK = (n) => (1 << n) - 1;
  const CAN_CONSUME_AND_THEN_PRELOAD = (consume_nbits, preload_nbits)	=> {
    return CONSUMABLE_NBITS >= (consume_nbits) &&	FASTLOOP_PRELOADABLE_NBITS >= (consume_nbits) + (preload_nbits);
  }
  const EXTRACT_VARBITS = (word, count) =>	word & BITMASK(count);
  const EXTRACT_VARBITS8 = (word, count) => word & BITMASK(count & 255);
  const get_unaligned_le16 = (p, i) => (p[i+1] << 8) | p[i];
  const get_unaligned_be16 = (p, i) => (p[i] << 8) | p[i+1];
  const bsr32 = (v) => 31 - Math.clz32(v);

  const FASTLOOP_MAX_BYTES_WRITTEN = (2 + DEFLATE_MAX_MATCH_LEN + (5 * WORDBYTES) - 1);
  const FASTLOOP_MAX_BYTES_READ = (ROUND_UP(MAX_BITSLEFT + (2 * LITLEN_TABLEBITS) +	
    LENGTH_MAXBITS + OFFSET_MAXBITS, 8) +	WORDBYTES);

  const precode_decode_results = new Uint32Array(DEFLATE_NUM_PRECODE_SYMS);
  for (let i = 0; i < DEFLATE_NUM_PRECODE_SYMS; i++) precode_decode_results[i] = i << 16;

  let entry = (len, bits) => (len << 16) | bits;
  const litlen_decode_results = new Uint32Array(DEFLATE_NUM_LITLEN_SYMS);
  for (let i = 0; i < DEFLATE_NUM_LITERALS; i++) litlen_decode_results[i] = HUFFDEC_LITERAL | (i << 16);
  litlen_decode_results[256] = HUFFDEC_EXCEPTIONAL | HUFFDEC_END_OF_BLOCK;
  litlen_decode_results.set([
    entry(3   , 0), entry(4   , 0), entry(5   , 0), entry(6   , 0),
    entry(7   , 0), entry(8   , 0), entry(9   , 0), entry(10  , 0),
    entry(11  , 1), entry(13  , 1), entry(15  , 1), entry(17  , 1),
    entry(19  , 2), entry(23  , 2), entry(27  , 2), entry(31  , 2),
    entry(35  , 3), entry(43  , 3), entry(51  , 3), entry(59  , 3),
    entry(67  , 4), entry(83  , 4), entry(99  , 4), entry(115 , 4),
    entry(131 , 5), entry(163 , 5), entry(195 , 5), entry(227 , 5),
    entry(258 , 0), entry(258 , 0), entry(258 , 0),
  ], 257);

  const offset_decode_results = new Uint32Array(DEFLATE_NUM_OFFSET_SYMS);
  offset_decode_results.set([
    entry(1     , 0),   entry(2     , 0),   entry(3     , 0),   entry(4     , 0),
    entry(5     , 1),   entry(7     , 1),   entry(9     , 2),   entry(13    , 2),
    entry(17    , 3),   entry(25    , 3),   entry(33    , 4),   entry(49    , 4),
    entry(65    , 5),   entry(97    , 5),   entry(129   , 6),   entry(193   , 6),
    entry(257   , 7),   entry(385   , 7),   entry(513   , 8),   entry(769   , 8),
    entry(1025  , 9),   entry(1537  , 9),   entry(2049  , 10),  entry(3073  , 10),
    entry(4097  , 11),  entry(6145  , 11),  entry(8193  , 12),  entry(12289 , 12),
    entry(16385 , 13),  entry(24577 , 13),  entry(24577 , 13),  entry(24577 , 13),
  ]);

  const deflate_precode_lens_permutation = new Uint8Array([
    16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15
  ]);

  class Decompressor {
    constructor() {
      this.litlen_decode_table = { type: TYPE.u32, count: LITLEN_ENOUGH };
      this.offset_decode_table = { type: TYPE.u32, count: OFFSET_ENOUGH };
      this.sorted_syms = { type: TYPE.u16, count: DEFLATE_MAX_NUM_SYMS };
      this.len_counts = { type: TYPE.u32, count: DEFLATE_MAX_CODEWORD_LEN + 1 };
      this.offsets = { type: TYPE.u32, count: DEFLATE_MAX_CODEWORD_LEN + 1 };

      Memory.allocate_layout(this);

      const buffer = this.litlen_decode_table.buffer;
      const lens_count = DEFLATE_NUM_LITLEN_SYMS + DEFLATE_NUM_OFFSET_SYMS + DEFLATE_MAX_LENS_OVERRUN;
      this.lens = new Uint8Array(buffer, 0, lens_count);
      this.precode_decode_table = new Uint32Array(buffer, aligned(lens_count), PRECODE_ENOUGH);
      this.precode_lens = new Uint8Array(buffer, 0, DEFLATE_NUM_PRECODE_SYMS);
      this.static_codes_loaded = false;
      this.litlen_tablebits = 0;
    }

    zlib(input, dst) {
      let in_next = 0, in_end = input.length, hdr;

      if (in_end < ZLIB_MIN_OVERHEAD) throw 'Zlib::Decompress: bad data - small input';

      hdr = get_unaligned_be16(input, in_next); in_next += 2;
      if ((hdr % 31) != 0) throw 'Zlib::Decompress: bad data - mod check';
      if (((hdr >> 8) & 0xF) != ZLIB_CM_DEFLATE) throw 'Zlib::Decompress: bad data - compression mode';
      if ((hdr >> 12) > ZLIB_CINFO_32K_WINDOW) throw 'Zlib::Decompress: bad data - info';
      if ((hdr >> 5) & 1) throw 'Zlib::Decompress: bad data - bit';

      return this.#deflate_raw(input, in_next, in_end - in_next, dst);
    }

    deflate(input, dst) {
      return this.#deflate_raw(input, 0, input.length, dst);
    }

    #deflate_raw(input, in_next, in_end, dst) {
      let resize = false, output;
      let in_fastloop_end = in_end - Math.min(in_end, FASTLOOP_MAX_BYTES_READ);
      if (!dst) {
        resize = true;
        const buffer = new ArrayBuffer(in_end * 4, { maxByteLength: Math.min(512 * in_end, 0xffffffff) });
        output = new Uint8Array(buffer);
      } else {
        output = dst;
      }
      let out_next = 0, out_end = output.length;
      let out_fastloop_end = out_end - Math.min(out_end, FASTLOOP_MAX_BYTES_WRITTEN);

      if (in_end < 2) throw 'Deflate::Decompress: Invalid Data.';

      let bitbuf = 0, saved_bitbuf;
      let bitsleft = 0, overread_count = 0;

      let is_final_block = false, block_type;
      let num_litlen_syms, num_offset_syms;
      let litlen_tablemask, entry;

      const REFILL_BITS = () => {
        let bit = bitsleft & 255;
        while (bit < CONSUMABLE_NBITS) {
          if (in_next != in_end) bitbuf |= input[in_next++] << bit;
          else overread_count++;
          bitsleft += 8; bit = bitsleft & 255;
        }
      }

      const REFILL_BITS_IN_FASTLOOP = () => {
        let bit = bitsleft & 255;
        while (bit < CONSUMABLE_NBITS) {
          bitbuf |= input[in_next++] << bit;
          bitsleft += 8; bit = bitsleft & 255;
        }
      }

      while (!is_final_block) {
        REFILL_BITS();
        is_final_block = bitbuf & BITMASK(1);
        block_type = (bitbuf >>> 1) & BITMASK(2);
        let block_done = false;

        if (block_type == DEFLATE_BLOCKTYPE_DYNAMIC_HUFFMAN) {
          let num_explicit_precode_lens, i;

          num_litlen_syms = 257 + ((bitbuf >>> 3) & BITMASK(5));
          num_offset_syms = 1 + ((bitbuf >>> 8) & BITMASK(5));
          num_explicit_precode_lens = 4 + ((bitbuf >>> 13) & BITMASK(4));

          this.static_codes_loaded = false;

          bitbuf >>>= 17; bitsleft -= 17; i = 0;
          do {
            if (u8(bitsleft) < 3) REFILL_BITS();
            this.precode_lens[deflate_precode_lens_permutation[i]] = bitbuf & BITMASK(3);
            bitbuf >>>= 3; bitsleft -= 3;
          } while (++i < num_explicit_precode_lens);

          for (; i < DEFLATE_NUM_PRECODE_SYMS; i++)
            this.precode_lens[deflate_precode_lens_permutation[i]] = 0;

          this.#build_precode_decode_table();

          i = 0;
          do {
            let presym, rep_count, rep_val;

            if (u8(bitsleft) < DEFLATE_MAX_PRE_CODEWORD_LEN + 7) REFILL_BITS();

            entry = this.precode_decode_table[bitbuf & BITMASK(DEFLATE_MAX_PRE_CODEWORD_LEN)];
            bitbuf >>>= u8(entry); bitsleft -= entry;
            presym = entry >>> 16;

            if (presym < 16) {
              this.lens[i++] = presym;
              continue;
            }

            if (presym == 16) {
              rep_val = this.lens[i - 1];
              rep_count = 3 + (bitbuf & BITMASK(2));
              bitbuf >>>= 2; bitsleft -= 2;
              this.lens.fill(rep_val, i, i + 6);
            } else if (presym == 17) {
              rep_count = 3 + (bitbuf & BITMASK(3));
              bitbuf >>>= 3; bitsleft -= 3;
              this.lens.fill(0, i, i + 10);
            } else {
              rep_count = 11 + (bitbuf & BITMASK(7));
              bitbuf >>>= 7; bitsleft -= 7;
              this.lens.fill(0, i, i + rep_count);
            }
            i+= rep_count;
          } while (i < num_litlen_syms + num_offset_syms);

          this.#build_offset_decode_table(num_litlen_syms, num_offset_syms);
          this.#build_litlen_decode_table(num_litlen_syms, num_offset_syms);
        } else if (block_type == DEFLATE_BLOCKTYPE_UNCOMPRESSED) {
          let len, nlen;
          bitsleft = u8(bitsleft - 3);
          in_next -= (bitsleft >>> 3) - overread_count;
          overread_count = bitbuf = bitsleft = 0;

          len = get_unaligned_le16(input, in_next);
          nlen = get_unaligned_le16(input, in_next + 2);
          in_next += 4;

          if (len > out_end - out_next) {
            if (!resize) throw 'Deflate::Decompress: Insufficient Space.';
            let bytes = output.byteLength, buffer = output.buffer;
            buffer.resize(bytes * 2);
            output = new Uint8Array(buffer);
          }

          memcpy(output, out_next, input, in_next, len);
          in_next += len; out_next += len;

          continue;
        } else {
          bitbuf >>>= 3; bitsleft -= 3;
          if (!this.static_codes_loaded) {
            this.static_codes_loaded = true;

            this.lens.fill(8, 0, 144);
            this.lens.fill(9, 144, 256);
            this.lens.fill(7, 256, 280);
            this.lens.fill(8, 280, 288);
            this.lens.fill(5, 288, 288 + 32);

            num_litlen_syms = 288;
            num_offset_syms = 32;

            this.#build_offset_decode_table(num_litlen_syms, num_offset_syms);
            this.#build_litlen_decode_table(num_litlen_syms, num_offset_syms);
          }
        }

        litlen_tablemask = BITMASK(this.litlen_tablebits);

        if (!(in_next >= in_fastloop_end || out_next >= out_fastloop_end)) {
          REFILL_BITS_IN_FASTLOOP();
          entry = this.litlen_decode_table[bitbuf & litlen_tablemask];
          do {
            let length, offset, lit, src, dst;

            saved_bitbuf = bitbuf;
            bitbuf >>>= u8(entry); bitsleft -= entry;

            if (entry & HUFFDEC_LITERAL) {
              lit = entry >>> 16;
              entry = this.litlen_decode_table[bitbuf & litlen_tablemask];
              REFILL_BITS_IN_FASTLOOP();
              output[out_next++] = lit;
              continue;
            }

            if (entry & HUFFDEC_EXCEPTIONAL) {

              if (entry & HUFFDEC_END_OF_BLOCK) {
                block_done = true;
                break;
              }

              entry = this.litlen_decode_table[(entry >>> 16) + EXTRACT_VARBITS(bitbuf, (entry >>> 8) & 0x3F)];
              saved_bitbuf = bitbuf; bitbuf >>>= u8(entry); bitsleft -= entry;

              REFILL_BITS_IN_FASTLOOP();

              if (entry & HUFFDEC_LITERAL) {
                lit = entry >>> 16;
                entry = this.litlen_decode_table[bitbuf & litlen_tablemask];
                REFILL_BITS_IN_FASTLOOP();
                output[out_next++] = lit;
                continue;
              }

              if (entry & HUFFDEC_END_OF_BLOCK) {
                block_done = true;
                break;
              }
            }

            length = entry >>> 16;
            length += EXTRACT_VARBITS8(saved_bitbuf, entry) >>> u8(entry >>> 8);

            entry = this.offset_decode_table[bitbuf & BITMASK(OFFSET_TABLEBITS)];
            REFILL_BITS_IN_FASTLOOP();
            if (entry & HUFFDEC_EXCEPTIONAL) {
              bitbuf >>>= OFFSET_TABLEBITS; bitsleft -= OFFSET_TABLEBITS;
              entry = this.offset_decode_table[(entry >>> 16) + EXTRACT_VARBITS(bitbuf, (entry >>> 8) & 0x3F)];
              REFILL_BITS_IN_FASTLOOP();
            }
            saved_bitbuf = bitbuf;
            bitbuf >>>= u8(entry); bitsleft -= entry;
            offset = entry >>> 16;
            offset += EXTRACT_VARBITS8(saved_bitbuf, entry) >>> u8(entry >>> 8);
            src = out_next - offset; dst = out_next; out_next += length;

            if (!CAN_CONSUME_AND_THEN_PRELOAD(
              Math.max(OFFSET_MAXBITS - OFFSET_TABLEBITS, OFFSET_MAXFASTBITS), LITLEN_TABLEBITS) &&
                u8(bitsleft) < LITLEN_TABLEBITS - PRELOAD_SLACK)
              REFILL_BITS_IN_FASTLOOP();
            entry = this.litlen_decode_table[bitbuf & litlen_tablemask];
            REFILL_BITS_IN_FASTLOOP();

            output[dst++] = output[src++];
            output[dst++] = output[src++];
            do { output[dst++] = output[src++] } while (dst < out_next);
          } while (in_next < in_fastloop_end && out_next < out_fastloop_end);

          if (block_done) continue;
        }

        for (;;) {
          let length, offset, src, dst;

          REFILL_BITS();
          entry = this.litlen_decode_table[bitbuf & litlen_tablemask];
          saved_bitbuf = bitbuf; bitbuf >>>= u8(entry); bitsleft -= entry;
          if (entry & HUFFDEC_SUBTABLE_POINTER) {
            entry = this.litlen_decode_table[(entry >>> 16) + EXTRACT_VARBITS(bitbuf, (entry >>> 8) & 0x3F)];
            saved_bitbuf = bitbuf; bitbuf >>>= u8(entry); bitsleft -= entry;
          }
          length = entry >>> 16;
          if (entry & HUFFDEC_LITERAL) {
            if (out_next >= out_end) {
              if (!resize) throw 'Deflate::Decompress: Insufficient Space.';
              let bytes = output.byteLength, buffer = output.buffer;
              buffer.resize(bytes * 2);
              output = new Uint8Array(buffer);
            } 
            output[out_next++] = length;
            continue;
          }
          if (entry & HUFFDEC_END_OF_BLOCK) break;
          length += EXTRACT_VARBITS8(saved_bitbuf, entry) >>> u8(entry >>> 8);

          if (length > out_end - out_next) {
            if (!resize) throw 'Deflate::Decompress: Insufficient Space.';
            let bytes = output.byteLength, buffer = output.buffer;
            buffer.resize(bytes * 2);
            output = new Uint8Array(buffer);
          }  
          REFILL_BITS();

          entry = this.offset_decode_table[bitbuf & BITMASK(OFFSET_TABLEBITS)];
          if (entry & HUFFDEC_EXCEPTIONAL) {
            bitbuf >>>= OFFSET_TABLEBITS; bitsleft -= OFFSET_TABLEBITS;
            entry = this.offset_decode_table[(entry >>> 16) + EXTRACT_VARBITS(bitbuf, (entry >>> 8) & 0x3F)];
            REFILL_BITS();
          }
          offset = entry >>> 16; offset += EXTRACT_VARBITS8(bitbuf, entry) >>> u8(entry >>> 8);
          bitbuf >>>= u8(entry); bitsleft -= entry;

          src = out_next - offset;
          dst = out_next;
          out_next += length;

          output[dst++] = output[src++];
          output[dst++] = output[src++];
          do { output[dst++] = output[src++] } while (dst < out_next);
        }
      }

      return resize ?
        new Uint8Array(output.buffer.transferToFixedLength(out_next)) :
        out_next;
    }

    #build_precode_decode_table() {
      return this.#build_decode_table(
        this.precode_decode_table, this.precode_lens, DEFLATE_NUM_PRECODE_SYMS,
        precode_decode_results, PRECODE_TABLEBITS, DEFLATE_MAX_PRE_CODEWORD_LEN,
        this.sorted_syms
      );
    }

    #build_litlen_decode_table(num_litlen_syms) {
      return this.#build_decode_table(
        this.litlen_decode_table, this.lens, num_litlen_syms,
        litlen_decode_results, LITLEN_TABLEBITS, DEFLATE_MAX_LITLEN_CODEWORD_LEN,
        this.sorted_syms, this.litlen_tablebits
      );
    }

    #build_offset_decode_table(num_litlen_syms, num_offset_syms) {
      return this.#build_decode_table(
        this.offset_decode_table, this.lens.subarray(num_litlen_syms), num_offset_syms,
        offset_decode_results, OFFSET_TABLEBITS, DEFLATE_MAX_OFFSET_CODEWORD_LEN,
        this.sorted_syms
      );
    }

    #make_decode_table_entry(decode_results, sym, len) {
      return decode_results[sym] + (len << 8) + len;
    }

    #build_decode_table(decode_table, lens, num_syms, decode_results,
        table_bits, max_codeword_len, sorted_syms, table_bits_ret) {

      let sym, codeword, len, count, codespace_used, cur_table_end;
      let subtable_prefix, subtable_start, subtable_bits;

      this.len_counts.fill(0);
      for (sym = 0; sym < num_syms; sym++) this.len_counts[lens[sym]]++;
      
      while (max_codeword_len > 1 && this.len_counts[max_codeword_len] == 0) max_codeword_len--;
      if (table_bits_ret != undefined) {
        table_bits = Math.min(table_bits, max_codeword_len);
        this.litlen_tablebits = table_bits;
      }

      this.offsets[0] = 0;
      this.offsets[1] = this.len_counts[0];
      codespace_used = 0;
      for (len = 1; len < max_codeword_len; len++) {
        this.offsets[len + 1] = this.offsets[len] + this.len_counts[len];
        codespace_used = (codespace_used << 1) + this.len_counts[len];
      }
      codespace_used = (codespace_used << 1) + this.len_counts[len];

      for (sym = 0; sym < num_syms; sym++) sorted_syms[this.offsets[lens[sym]]++] = sym;
      let sorted_offset = this.offsets[0];

      if (codespace_used > (1 << max_codeword_len)) throw 'Deflate::Decompress: overfull';
      if (codespace_used < (1 << max_codeword_len)) {
        let entry, i;
        if (codespace_used == 0) {
          sym = 0;
        } else {
          if (codespace_used != 1 << (max_codeword_len - 1) || this.len_counts[1] != 1) throw 'Deflate::Decompress: invalid code';
          sym = sorted_syms[sorted_offset];
        }
        entry = this.#make_decode_table_entry(decode_results, sym, 1);
        for (i = 0; i < (1 << table_bits); i++) decode_table[i] = entry;
        return true;
      }

      let sorted = 0; codeword = 0; len = 1;
      while ((count = this.len_counts[len]) == 0) len++;
      cur_table_end = 1 << len;

      while (len <= table_bits) {
        do {
          let bit;
          decode_table[codeword] = this.#make_decode_table_entry(decode_results, sorted_syms[sorted_offset + sorted++], len);
          if (codeword == cur_table_end - 1) {
            for (; len < table_bits; len++) {
              decode_table.copyWithin(cur_table_end, 0, cur_table_end);
              cur_table_end <<= 1;
            }
            return true;
          }

          bit = 1 << bsr32(codeword ^ (cur_table_end - 1));
          codeword &= bit - 1; codeword |= bit;
        } while (--count);

        do {
          if (++len <= table_bits) {
            decode_table.copyWithin(cur_table_end, 0, cur_table_end);
            cur_table_end <<= 1;
          }
        } while ((count = this.len_counts[len]) == 0);
      }

      cur_table_end = 1 << table_bits;
      subtable_prefix = -1;
      subtable_start = 0;
      for (;;) {
        let entry, i, stride, bit;
        if ((codeword & ((1 << table_bits) - 1)) != subtable_prefix) {
          subtable_prefix = (codeword & ((1 << table_bits) - 1));
          subtable_start = cur_table_end;
          subtable_bits = len - table_bits;
          codespace_used = count;
          while (codespace_used < (1 << subtable_bits)) {
            subtable_bits++;
            codespace_used = (codespace_used << 1) + this.len_counts[table_bits + subtable_bits];
          }
          cur_table_end = subtable_start + (1 << subtable_bits);

          decode_table[subtable_prefix] =
            (subtable_start << 16) |
            HUFFDEC_EXCEPTIONAL |
            HUFFDEC_SUBTABLE_POINTER |
            (subtable_bits << 8) | table_bits;
        }

        entry = this.#make_decode_table_entry(decode_results, sorted_syms[sorted_offset + sorted++], len - table_bits);
        i = subtable_start + (codeword >>> table_bits);
        stride = 1 << (len - table_bits);
        do { decode_table[i] = entry; i += stride; } while (i < cur_table_end);

        if (codeword == (1 << len) - 1) return true;
        bit = 1 << bsr32(codeword ^ ((1 << len) - 1));
        codeword &= bit - 1; codeword |= bit; count--;
        while (count == 0) count = this.len_counts[++len];
      }
    }
  }

}