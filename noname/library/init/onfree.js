function requireOnFree(callbacks) {
  if (callbacks === void 0) {
    throw new TypeError("The startup callback queue is no longer available");
  }
  return callbacks;
}
export {
  requireOnFree
};
