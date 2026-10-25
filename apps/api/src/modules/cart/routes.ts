import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { parse } from '../../lib/zod.js';
import { requireAuth } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rate-limit.js';
import { clearCart, getCart, removeCartItem, setCartItem, updateCartItem } from './service.js';

const addSchema = z.object({ bookId: z.string().cuid(), quantity: z.number().int().min(1).max(99).default(1) });
const updateSchema = z.object({ quantity: z.number().int().min(0).max(99) });

export const cartRouter = Router();
cartRouter.use(requireAuth);
cartRouter.get('/', async (request, response) => response.json({ data: await getCart(request.user!.id) }));
cartRouter.delete('/', writeLimiter, async (request, response) => response.json({ data: await clearCart(request.user!.id) }));

const addItem = async (request: Request, response: Response) => {
  const input = parse(addSchema, request.body);
  response.status(201).json({ data: await setCartItem(request.user!.id, input.bookId, input.quantity) });
};
cartRouter.post('/', writeLimiter, addItem);
cartRouter.post('/items', writeLimiter, addItem);
cartRouter.patch('/items/:itemId', writeLimiter, async (request, response) => {
  const input = parse(updateSchema, request.body);
  response.json({ data: await updateCartItem(request.user!.id, z.string().cuid().parse(request.params.itemId), input.quantity) });
});
cartRouter.delete('/items/:itemId', writeLimiter, async (request, response) => {
  response.json({ data: await removeCartItem(request.user!.id, z.string().cuid().parse(request.params.itemId)) });
});
