-- One basket per order, not one basket per user for all time.
--
-- `Cart.userId` was unique while `Order.cartId` was unique as well, so a cart
-- could only ever produce a single order: after the first checkout the cart was
-- flipped back to ACTIVE and the next order died on the unique violation. A
-- user now accumulates one cart row per order and the newest ACTIVE one is the
-- live basket. `Cart(userId, status, updatedAt)` is already indexed, so lookups
-- stay covered.
DROP INDEX IF EXISTS "Cart_userId_key";