import { vi, test, expect, beforeEach, describe } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSignInAction = vi.fn();
const mockSignUpAction = vi.fn();

vi.mock("@/actions", () => ({
  signIn: (...args: unknown[]) => mockSignInAction(...args),
  signUp: (...args: unknown[]) => mockSignUpAction(...args),
}));

const mockGetAnonWorkData = vi.fn();
const mockClearAnonWork = vi.fn();

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: () => mockGetAnonWorkData(),
  clearAnonWork: () => mockClearAnonWork(),
}));

const mockGetProjects = vi.fn();

vi.mock("@/actions/get-projects", () => ({
  getProjects: () => mockGetProjects(),
}));

const mockCreateProject = vi.fn();

vi.mock("@/actions/create-project", () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
}));

import { useAuth } from "@/hooks/use-auth";

const anonWork = {
  messages: [{ role: "user", content: "make me a button" }],
  fileSystemData: { "/App.tsx": "export default () => <button />" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-proj-1" });
});

// ─── signIn ────────────────────────────────────────────────────────────────

describe("signIn", () => {
  test("returns the action result on success", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "proj-1" }]);

    const { result } = renderHook(() => useAuth());
    let returnValue;

    await act(async () => {
      returnValue = await result.current.signIn("a@b.com", "password123");
    });

    expect(returnValue).toEqual({ success: true });
  });

  test("returns the action result on failure without navigating", async () => {
    mockSignInAction.mockResolvedValue({ success: false, error: "Invalid credentials" });

    const { result } = renderHook(() => useAuth());
    let returnValue;

    await act(async () => {
      returnValue = await result.current.signIn("a@b.com", "wrong");
    });

    expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockGetProjects).not.toHaveBeenCalled();
  });

  test("saves anon work as a project and redirects when anon work exists", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(anonWork);
    mockCreateProject.mockResolvedValue({ id: "saved-anon-proj" });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password123");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: anonWork.messages,
        data: anonWork.fileSystemData,
      })
    );
    expect(mockClearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/saved-anon-proj");
    expect(mockGetProjects).not.toHaveBeenCalled();
  });

  test("skips anon work when messages array is empty and redirects to existing project", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
    mockGetProjects.mockResolvedValue([{ id: "existing-proj" }]);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password123");
    });

    expect(mockCreateProject).not.toHaveBeenCalled();
    expect(mockClearAnonWork).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/existing-proj");
  });

  test("redirects to most recent existing project when no anon work", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "recent-proj" }, { id: "older-proj" }]);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password123");
    });

    expect(mockPush).toHaveBeenCalledWith("/recent-proj");
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  test("creates a new project and redirects when no anon work and no existing projects", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "brand-new-proj" });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password123");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
    expect(mockPush).toHaveBeenCalledWith("/brand-new-proj");
  });

  test("isLoading is true during sign in and false after", async () => {
    let resolveFn!: (v: unknown) => void;
    mockSignInAction.mockReturnValue(new Promise((r) => (resolveFn = r)));

    const { result } = renderHook(() => useAuth());

    expect(result.current.isLoading).toBe(false);

    let signInPromise: Promise<unknown>;

    act(() => {
      signInPromise = result.current.signIn("a@b.com", "password123");
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveFn({ success: false, error: "Invalid credentials" });
      await signInPromise!;
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false even when the action throws", async () => {
    mockSignInAction.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password123").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("passes email and password to the signIn action", async () => {
    mockSignInAction.mockResolvedValue({ success: false, error: "Invalid credentials" });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "securepass");
    });

    expect(mockSignInAction).toHaveBeenCalledWith("user@example.com", "securepass");
  });
});

// ─── signUp ────────────────────────────────────────────────────────────────

describe("signUp", () => {
  test("returns the action result on success", async () => {
    mockSignUpAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "proj-1" }]);

    const { result } = renderHook(() => useAuth());
    let returnValue;

    await act(async () => {
      returnValue = await result.current.signUp("a@b.com", "password123");
    });

    expect(returnValue).toEqual({ success: true });
  });

  test("returns the action result on failure without navigating", async () => {
    mockSignUpAction.mockResolvedValue({ success: false, error: "Email already registered" });

    const { result } = renderHook(() => useAuth());
    let returnValue;

    await act(async () => {
      returnValue = await result.current.signUp("a@b.com", "password123");
    });

    expect(returnValue).toEqual({ success: false, error: "Email already registered" });
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("saves anon work as a project and redirects when anon work exists", async () => {
    mockSignUpAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(anonWork);
    mockCreateProject.mockResolvedValue({ id: "signup-anon-proj" });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@user.com", "password123");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: anonWork.messages,
        data: anonWork.fileSystemData,
      })
    );
    expect(mockClearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/signup-anon-proj");
  });

  test("creates a new project and redirects when no anon work and no existing projects", async () => {
    mockSignUpAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "first-proj" });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@user.com", "password123");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
    expect(mockPush).toHaveBeenCalledWith("/first-proj");
  });

  test("isLoading is true during sign up and false after", async () => {
    let resolveFn!: (v: unknown) => void;
    mockSignUpAction.mockReturnValue(new Promise((r) => (resolveFn = r)));

    const { result } = renderHook(() => useAuth());

    expect(result.current.isLoading).toBe(false);

    let signUpPromise: Promise<unknown>;

    act(() => {
      signUpPromise = result.current.signUp("new@user.com", "password123");
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveFn({ success: false });
      await signUpPromise!;
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false even when the action throws", async () => {
    mockSignUpAction.mockRejectedValue(new Error("Server error"));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("a@b.com", "password123").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("passes email and password to the signUp action", async () => {
    mockSignUpAction.mockResolvedValue({ success: false });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("register@example.com", "newpass99");
    });

    expect(mockSignUpAction).toHaveBeenCalledWith("register@example.com", "newpass99");
  });
});
