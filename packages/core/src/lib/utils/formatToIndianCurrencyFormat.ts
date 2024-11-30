export const formatToIndianCurrencyFormat = (value: number | string) => {
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;

  const roundedValue = Number(numericValue).toFixed(2);

  return `₹ ${Number(roundedValue).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
  })}`;
};
