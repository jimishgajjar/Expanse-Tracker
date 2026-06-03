"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, authToken, hash } from "./auth-token";

export async function login(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const token = authToken();
  if (!token) redirect("/"); // auth disabled — nothing to log in to

  const password = String(formData.get("password") ?? "");
  if (hash(password) !== token) return "Incorrect password.";

  const jar = await cookies();
  jar.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  redirect(String(formData.get("next") || "/"));
}

export async function logout() {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE);
  redirect("/login");
}
