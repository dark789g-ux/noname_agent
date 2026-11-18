function readMaximumNumberOfPlayers(status, fallback, minimum) {
  const math = Math;
  const max = math.max;
  const configured = Reflect.get(status, "maximumNumberOfPlayers");
  const result = Reflect.apply(max, math, [configured || fallback, minimum]);
  if (typeof result !== "number") throw new TypeError("Math.max must return a number");
  return result;
}
export {
  readMaximumNumberOfPlayers
};
