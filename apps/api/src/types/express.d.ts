declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: {
        id: string;
        status: string;
        roles: string[];
      };
    }
  }
}

export {};
