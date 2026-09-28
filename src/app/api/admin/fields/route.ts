import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/authorization";
import { adminDb } from "@/lib/firebase/admin";
import { generateFieldId } from "@/lib/ids";
import { logAuditEvent } from "@/lib/security/audit";
import { CreateFieldInputSchema, UpdateFieldInputSchema } from "@/lib/validation/fields";
import type { FieldDefinition } from "@/types/fields";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");

    let query: FirebaseFirestore.Query = adminDb.collection("fields");
    if (categoryId) {
      query = query.where("categoryId", "==", categoryId);
    }

    const snapshot = await query.get();
    const fields: FieldDefinition[] = snapshot.docs
      .map((doc) => doc.data() as FieldDefinition)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    return NextResponse.json({ fields });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/admin/fields error:", error);
    return NextResponse.json(
      { error: "Internal server error while fetching dynamic fields" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();

    const body = await request.json();
    const parseResult = await CreateFieldInputSchema.safeParseAsync(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
        },
        { status: 400 }
      );
    }

    const { categoryId, label, type, options, validation, permissions, sortOrder } = parseResult.data;

    // Verify parent category exists
    const categoryDoc = await adminDb.collection("categories").doc(categoryId).get();
    if (!categoryDoc.exists) {
      return NextResponse.json(
        { error: `Category '${categoryId}' does not exist.` },
        { status: 404 }
      );
    }

    const fieldId = await generateFieldId();
    const timestamp = new Date().toISOString();

    const newField: FieldDefinition = {
      fieldId,
      categoryId,
      label,
      type,
      options: options || [],
      validation: {
        required: Boolean(validation?.required),
        min: validation?.min,
        max: validation?.max,
        pattern: validation?.pattern,
        allowedMimeTypes: validation?.allowedMimeTypes,
        maxFileSizeMb: validation?.maxFileSizeMb,
      },
      permissions: {
        cadetEditable: permissions?.cadetEditable !== undefined ? permissions.cadetEditable : true,
        ctoVisible: permissions?.ctoVisible !== undefined ? permissions.ctoVisible : true,
        ctoExportable: permissions?.ctoExportable !== undefined ? permissions.ctoExportable : true,
      },
      sortOrder: sortOrder || 0,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await adminDb.collection("fields").doc(fieldId).set(newField);

    // Audit Log
    await logAuditEvent({
      actorId: session.uid,
      actorEmail: session.email,
      actorRole: "admin",
      action: "field.create",
      entityType: "field",
      entityId: fieldId,
      newState: newField as unknown as Record<string, unknown>,
      metadata: { categoryId },
    });

    return NextResponse.json({ success: true, field: newField }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("POST /api/admin/fields error:", error);
    return NextResponse.json(
      { error: "Internal server error while creating dynamic field" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireAdmin();

    const body = await request.json();
    const { fieldId, ...updateData } = body;

    if (!fieldId || typeof fieldId !== "string") {
      return NextResponse.json(
        { error: "fieldId is required for field updates." },
        { status: 400 }
      );
    }

    const parseResult = await UpdateFieldInputSchema.safeParseAsync(updateData);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
        },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("fields").doc(fieldId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { error: `Field '${fieldId}' does not exist.` },
        { status: 404 }
      );
    }

    const existing = docSnap.data() as FieldDefinition;
    const timestamp = new Date().toISOString();

    const updatedField: FieldDefinition = {
      ...existing,
      label: parseResult.data.label !== undefined ? parseResult.data.label : existing.label,
      options: parseResult.data.options !== undefined ? parseResult.data.options : existing.options,
      validation: {
        ...existing.validation,
        ...(parseResult.data.validation || {}),
      },
      permissions: {
        ...existing.permissions,
        ...(parseResult.data.permissions || {}),
      },
      sortOrder: parseResult.data.sortOrder !== undefined ? parseResult.data.sortOrder : existing.sortOrder,
      isActive: parseResult.data.isActive !== undefined ? parseResult.data.isActive : existing.isActive,
      updatedAt: timestamp,
    };

    await docRef.set(updatedField);

    // Audit Log
    await logAuditEvent({
      actorId: session.uid,
      actorEmail: session.email,
      actorRole: "admin",
      action: "field.update",
      entityType: "field",
      entityId: fieldId,
      previousState: existing as unknown as Record<string, unknown>,
      newState: updatedField as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ success: true, field: updatedField });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("PUT /api/admin/fields error:", error);
    return NextResponse.json(
      { error: "Internal server error while updating dynamic field" },
      { status: 500 }
    );
  }
}
