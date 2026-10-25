import { Router } from 'express';
import { prisma } from '../../config/prisma.js';

export const categoriesRouter = Router();
categoriesRouter.get('/', async (_request, response) => {
  const categories = await prisma.bookCategory.findMany({
    where: { isActive: true },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    select: {
      id: true, name: true, slug: true, description: true, iconUrl: true,
      _count: { select: { bookLinks: { where: { book: { isActive: true } } } } },
    },
  });
  response.json({ data: categories.map((item) => ({ ...item, image: item.iconUrl, bookCount: item._count.bookLinks })) });
});
