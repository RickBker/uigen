// @vitest-environment node
import { vi, test, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

import {
  createSession,
  getSession,
  deleteSession,
  verifySession,
} from "@/lib/auth";

beforeEach(() => {
  vi.clearAllMocks();
});

// createSession

test("createSession sets an httpOnly cookie", async () => {
  await createSession("user-123", "test@example.com");

  expect(mockCookieStore.set).toHaveBeenCalledWith(
    "auth-token",
    expect.any(String),
    expect.objectContaining({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    })
  );
});

test("createSession sets cookie expiry to 7 days from now", async () => {
  const before = Date.now();
  await createSession("user-123", "test@example.com");
  const after = Date.now();

  const [, , options] = mockCookieStore.set.mock.calls[0];
  const expiresMs = (options.expires as Date).getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDays - 1000);
  expect(expiresMs).toBeLessThanOrEqual(after + sevenDays + 1000);
});

// getSession

test("getSession returns null when no token in cookies", async () => {
  mockCookieStore.get.mockReturnValue(undefined);

  expect(await getSession()).toBeNull();
});

test("getSession returns session payload for a valid token", async () => {
  await createSession("user-123", "test@example.com");
  const token = mockCookieStore.set.mock.calls[0][1] as string;

  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();

  expect(session?.userId).toBe("user-123");
  expect(session?.email).toBe("test@example.com");
});

test("getSession returns null for a tampered token", async () => {
  mockCookieStore.get.mockReturnValue({ value: "not.a.valid.jwt" });

  expect(await getSession()).toBeNull();
});

// deleteSession

test("deleteSession removes the auth-token cookie", async () => {
  await deleteSession();

  expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
});

// verifySession

test("verifySession returns null when request has no cookie", async () => {
  const request = new NextRequest("http://localhost/api/test");

  expect(await verifySession(request)).toBeNull();
});

test("verifySession returns session payload for a valid token in the request", async () => {
  await createSession("user-456", "other@example.com");
  const token = mockCookieStore.set.mock.calls[0][1] as string;

  const request = new NextRequest("http://localhost/api/test", {
    headers: { cookie: `auth-token=${token}` },
  });

  const session = await verifySession(request);

  expect(session?.userId).toBe("user-456");
  expect(session?.email).toBe("other@example.com");
});

test("verifySession returns null for a tampered token in the request", async () => {
  const request = new NextRequest("http://localhost/api/test", {
    headers: { cookie: "auth-token=bad.token.value" },
  });

  expect(await verifySession(request)).toBeNull();
});
