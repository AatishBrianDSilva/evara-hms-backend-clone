export const formatToIndianCurrencyFormat = (value: number | string) => {
  const numericValue = parseFloat(value as string);

  // Check if the value is numeric
  if (isNaN(numericValue)) {
    return value; // Return the value as is if it is not numeric
  }

  const roundedValue = Math.round(numericValue);

  return `₹ ${roundedValue.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
  })}`;
};
