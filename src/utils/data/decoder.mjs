export const decode_f16 = (u16) => {
  const exp = (u16 & 0x7C00) >> 10, fraction = u16 & 0x03FF;

  const sign = (u16 >> 15 ? - 1 : 1);
  return sign * (!exp ? 6.103515625e-5 * (fraction / 0x400) :
    (exp === 0x1F ?
      (fraction ? NaN : Infinity) :
      Math.pow(2, exp - 15) * (1 + fraction / 0x400)
    )
  );
};