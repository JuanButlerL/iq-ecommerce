import { NextResponse } from "next/server";

import { AppError } from "@/lib/errors/app-error";

export function routeOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function routeError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.exposeMessage ? error.message : "Unexpected error." },
      { status: error.statusCode },
    );
  }

  console.error(error);

  return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
}
