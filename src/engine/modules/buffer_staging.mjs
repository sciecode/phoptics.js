const MAX_SIZE = 0x800_0000; // 128MB

export class BufferStaging {
  constructor(backend) {
    this.backend = backend;
    this.ring = [new Uint8Array(MAX_SIZE)];
    this.staged = [];
    this.heap = 0;
    this.current = 0;
  }

  stage(info) {
    this.ring[this.heap].set(info.backing, this.current);

    const size = info.backing.byteLength;

    this.staged.push({
      heap: this.heap,
      bid: info.bid,
      src: this.current,
      dst: info.offset,
      size: size,
    });

    this.current += size;
  }

  upload() {
    for (let staged of this.staged)
      this.backend.write_buffer(staged.bid, staged.dst, this.ring[staged.heap], staged.src, staged.size);
    this.staged.length = 0;
    this.heap = 0;
    this.current = 0;
  }
}