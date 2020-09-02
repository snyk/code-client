// eslint-disable-next-line @typescript-eslint/ban-types
export default function throttle(emitAction: Function, timeOut: number): Function {
  let lastTime = 0;

  return (...args: number[]): void => {
    const now = Number(new Date());

    if (now - lastTime >= timeOut) {
      emitAction(...args);
      lastTime = now;
    }
  };
}
