import { NextResponse } from "next/server";
import { type ZodType, ZodError } from "zod";

/**
 * Recursively sanitizes primitive string values in an object by trimming whitespace.
 */
function sanitizeInput(data: unknown): unknown {
  if (typeof data === "string") {
    return data.trim();
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeInput);
  }
  if (data !== null && typeof data === "object") {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      sanitizedObj[key] = sanitizeInput(value);
    }
    return sanitizedObj;
  }
  return data;
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; response: NextResponse };

/**
 * Extracts, sanitizes, and validates the JSON body of a Request against a Zod schema.
 * Returns either the strongly typed data or an immediate 400 Bad Request NextResponse.
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: ZodType<T>
): Promise<ValidationResult<T>> {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          error: "Invalid JSON format in request payload.",
        },
        { status: 400 }
      ),
    };
  }

  const sanitized = sanitizeInput(rawBody);
  const result = await schema.safeParseAsync(sanitized);

  if (!result.success) {
    const errorDetails = (result.error as ZodError).issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));

    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          error: "Validation failed for request parameters.",
          details: errorDetails,
        },
        { status: 400 }
      ),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}
