let lastTime = 0;

export function throttle(emitAction: Function, timeOut: number): Function {
  const now = new Date();

  return function(...args: number[]): void {
    if (Number(now) - lastTime >= timeOut) {
      emitAction(...args);
      lastTime = Number(now);
    }
  };
}
