import { EdvoObj } from './object';

// this is a sparse list that will allow us to
export class SparseList<T extends { destroy: () => void }> extends EdvoObj {
  leading_gap = 0;
  list: T[] = [];
  get min_row() {
    return this.leading_gap;
  }
  get max_row() {
    return this.leading_gap + this.list.length;
  }
  get(idx: number) {
    return this.list[idx - this.leading_gap];
  }
  cull_before(idx: number) {
    const take_gap = Math.min(this.leading_gap, idx);
    const take_list = idx - this.leading_gap;
    this.leading_gap -= take_gap;
    let removed = this.list.splice(0, take_list);
    removed?.forEach((i) => i.destroy());
  }
  cull_after(idx: number) {
    let removed: T[];
    if (idx <= this.leading_gap) {
      removed = this.list;
      this.list = [];
    } else {
      removed = this.list.splice(idx - this.leading_gap);
    }

    removed?.forEach((i) => i.destroy());
  }

  protected cleanup() {
    // this.list.forEach((i) => i.destroy);

    super.cleanup();
  }
}
