export default class BidirectionalMap {
  constructor() {
    this.map = new Map();
    this.reverseMap = new Map();
  }

  set(key, value) {
    this.map.set(key, value);
    this.reverseMap.set(value, key);
  }

  get(key) {
    return this.map.get(key);
  }

  getKey(value) {
    return this.reverseMap.get(value);
  }

  delete(key) {
    const value = this.map.get(key);
    this.map.delete(key);
    this.reverseMap.delete(value);
  }

  clear() {
    this.map.clear();
    this.reverseMap.clear();
  }

  size() {
    return this.map.size;
  }
}
