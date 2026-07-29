import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { requireAuth, requireRole } from "./auth.middleware.js";

function mockReqRes(headers: Record<string, string> = {}) {
  const req = { headers, auth: undefined } as unknown as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn();
  return { req, res, next };
}

describe("requireAuth", () => {
  it("rejects a request with no Authorization header", () => {
    const { req, res, next } = mockReqRes();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a malformed bearer token", () => {
    const { req, res, next } = mockReqRes({ authorization: "Bearer not-a-real-jwt" });
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a token signed with the wrong secret", () => {
    const token = jwt.sign({ userId: "u1", role: "ADMIN" }, "wrong-secret-not-the-real-one");
    const { req, res, next } = mockReqRes({ authorization: `Bearer ${token}` });
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts a validly-signed token and attaches the payload to req.auth", () => {
    const token = jwt.sign({ userId: "u1", role: "OBSERVER" }, env.JWT_SECRET);
    const { req, res, next } = mockReqRes({ authorization: `Bearer ${token}` });
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.auth).toMatchObject({ userId: "u1", role: "OBSERVER" });
  });
});

describe("requireRole", () => {
  it("allows a role in the allow-list", () => {
    const { req, res, next } = mockReqRes();
    req.auth = { userId: "u1", role: "ADMIN" };
    requireRole("ADMIN", "OBSERVER")(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects a role that is not in the allow-list — the Observer/mutation boundary", () => {
    const { req, res, next } = mockReqRes();
    req.auth = { userId: "u1", role: "OBSERVER" };
    requireRole("ADMIN")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects when there is no auth payload at all", () => {
    const { req, res, next } = mockReqRes();
    requireRole("ADMIN")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
