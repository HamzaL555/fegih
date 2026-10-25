import { Prisma } from '../config/prisma-client.js';

export function finalBookPrice(price: Prisma.Decimal | string | number, discountPercent: Prisma.Decimal | string | number) {
  return new Prisma.Decimal(price)
    .mul(new Prisma.Decimal(100).sub(new Prisma.Decimal(discountPercent)))
    .div(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function money(value: Prisma.Decimal | string | number) {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function toMajorUnitString(value: Prisma.Decimal | string | number) {
  return money(value).toFixed(2);
}
