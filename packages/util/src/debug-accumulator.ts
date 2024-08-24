// Implements a ring array so we can efficiently keep the last N log entries without constantly splicing the array
// which would be super thrashy in terms of memory allocation
export class RingArray {
  size: number;
  head: number;
  count: number;
  data: Array<any>;

  constructor(size) {
    this.size = size;
    this.data = new Array(size);
    this.head = 0; // Points to the next write position
    this.count = 0; // Number of elements in the buffer
  }

  push(item) {
    this.data[this.head] = item;
    this.head = (this.head + 1) % this.size;
    if (this.count < this.size) {
      this.count++;
    }
  }

  get contents() {
    if (this.count < this.size) {
      return this.data.slice(0, this.count);
    }
    return [...this.data.slice(this.head), ...this.data.slice(0, this.head)];
  }
}
