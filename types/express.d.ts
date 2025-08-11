import "express";

declare global {
  type AuthRole = "user" | "driver" | "admin";

  interface AuthUser {
    id: number;
    email: string;
    role: AuthRole;
    name?: string;
  }

  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export {};
