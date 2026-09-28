import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/authorization";
import { adminDb } from "@/lib/firebase/admin";
import { generateCategoryId } from "@/lib/ids";
import { logAuditEvent } from "@/lib/security/audit";
import { CreateCategoryInputSchema, UpdateCategoryInputSchema } from "@/lib/validation/fields";
import type { CategoryDefinition } from "@/types/fields";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();

    const snapshot = await adminDb.collection("categories").get();
    const categories: CategoryDefinition[] = snapshot.docs
      .map((doc) => doc.data() as CategoryDefinition)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    return NextResponse.json({ categories });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/admin/categories error:", error);
    return NextResponse.json(
      { error: "Internal server error while fetching categories" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();

    const body = await request.json();
    const parseResult = await CreateCategoryInputSchema.safeParseAsync(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
        },
        { status: 400 }
      );
    }

    const { name, description, sortOrder } = parseResult.data;
    const categoryId = await generateCategoryId();
    const timestamp = new Date().toISOString();

    const newCategory: CategoryDefinition = {
      categoryId,
      name,
      description: description || "",
      sortOrder: sortOrder || 0,
      isSystem: false,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await adminDb.collection("categories").doc(categoryId).set(newCategory);

    // Audit log
    await logAuditEvent({
      actorId: session.uid,
      actorEmail: session.email,
      actorRole: "admin",
      action: "category.create",
      entityType: "category",
      entityId: categoryId,
      newState: newCategory as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ success: true, category: newCategory }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("POST /api/admin/categories error:", error);
    return NextResponse.json(
      { error: "Internal server error while creating category" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireAdmin();

    const body = await request.json();
    const { categoryId, ...updateData } = body;

    if (!categoryId || typeof categoryId !== "string") {
      return NextResponse.json(
        { error: "categoryId is required for category updates." },
        { status: 400 }
      );
    }

    const parseResult = await UpdateCategoryInputSchema.safeParseAsync(updateData);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
        },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("categories").doc(categoryId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { error: `Category '${categoryId}' does not exist.` },
        { status: 404 }
      );
    }

    const existing = docSnap.data() as CategoryDefinition;

    // Prevent deactivating or deleting system core categories
    if (existing.isSystem && parseResult.data.isActive === false) {
      return NextResponse.json(
        { error: "System core categories cannot be deactivated. They are required for NCC records integrity." },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();
    const updatedCategory: CategoryDefinition = {
      ...existing,
      name: parseResult.data.name !== undefined ? parseResult.data.name : existing.name,
      description: parseResult.data.description !== undefined ? parseResult.data.description : existing.description,
      sortOrder: parseResult.data.sortOrder !== undefined ? parseResult.data.sortOrder : existing.sortOrder,
      isActive: parseResult.data.isActive !== undefined ? parseResult.data.isActive : existing.isActive,
      updatedAt: timestamp,
    };

    await docRef.set(updatedCategory);

    // Audit log
    await logAuditEvent({
      actorId: session.uid,
      actorEmail: session.email,
      actorRole: "admin",
      action: "category.update",
      entityType: "category",
      entityId: categoryId,
      previousState: existing as unknown as Record<string, unknown>,
      newState: updatedCategory as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ success: true, category: updatedCategory });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("PUT /api/admin/categories error:", error);
    return NextResponse.json(
      { error: "Internal server error while updating category" },
      { status: 500 }
    );
  }
}
