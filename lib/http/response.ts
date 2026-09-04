import { NextResponse } from "next/server";

// The single response envelope every API route uses. A caller (browser or C++
// client) can rely on `success` + `code` without parsing prose, and error
// bodies never carry a stack trace or internal detail.

export type ApiSuccess<T> = { success: true; code: string; data: T };
export type ApiError = { success: false; code: string; message: string };

export function ok<T>(data: T, code = "OK", status = 200): NextResponse {
  return NextResponse.json<ApiSuccess<T>>({ success: true, code, data }, { status });
}

export function fail(code: string, message: string, status: number): NextResponse {
  return NextResponse.json<ApiError>({ success: false, code, message }, { status });
}
