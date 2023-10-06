// TODO: Import any code to be bundled into final package.
export const sum = (a: number, b: number) => {
  if ('development' === process.env.NODE_ENV) {
    console.log('boop');
  }
  return a + b;
};

(async () => {
  console.log(sum(1, 2));
})();
