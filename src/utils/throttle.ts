export function throttle(emitAction: Function, timeOut: number): Function {
  let lastTime = 0;

  return function(...args: number[]): void {
    const now = Number(new Date());

    if (now - lastTime >= timeOut) {
      emitAction(...args);
      lastTime = now;
    }
  };
}
