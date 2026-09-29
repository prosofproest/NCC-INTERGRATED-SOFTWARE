import { NextResponse } from "next/server";
import { requireCadet, requireCadetOwnership, AuthError } from "@/lib/authorization";
import { adminDb } from "@/lib/firebase/admin";
import { generateChangeRequestId } from "@/lib/ids";
import { logAuditEvent } from "@/lib/security/audit";
import { CreateChangeRequestInputSchema } from "@/lib/validation/request";
import type { CadetRecord } from "@/types/cadet";
import type { ChangeRequest } from "@/types/request";
import type { FieldDefinition } from "@/types/fields";

export const dynamic = "force-dynamic";

async function resolveCurrentCadet(session: { uid: string; email: string; cadetId?: string }) {
  if (session.cadetId) {
    const snap = await adminDb.collection("cadets").doc(session.cadetId).get();
    if (snap.exists) {
      return snap.data() as CadetRecord;
    }
  }

  const byUserSnap = await adminDb
    .collection("cadets")
    .where("userId", "==", session.uid)
    .limit(1)
    .get();
  if (!byUserSnap.empty) {
    return byUserSnap.docs[0].data() as CadetRecord;
  }

  const byEmailSnap = await adminDb
    .collection("cadets")
    .where("email", "==", session.email)
    .limit(1)
    .get();
  if (!byEmailSnap.empty) {
    return byEmailSnap.docs[0].data() as CadetRecord;
  }

  return null;
}

export async function GET() {
  try {
    const session = await requireCadet();
    const cadet = await resolveCurrentCadet(session);

    if (!cadet) {
      return NextResponse.json(
        { error: "Cadet profile is not yet linked. Contact your battalion administrator." },
        { status: 404 }
      );
    }

    await requireCadetOwnership(cadet.cadetId);

    const snapshot = await adminDb
      .collection("change_requests")
      .where("cadetId", "==", cadet.cadetId)
      .get();

    const changeRequests: ChangeRequest[] = snapshot.docs
      .map((doc) => doc.data() as ChangeRequest)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ changeRequests });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/cadet/change-requests error:", error);
    return NextResponse.json(
      { error: "Internal server error while fetching change requests" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireCadet();
    const cadet = await resolveCurrentCadet(session);

    if (!cadet) {
      return NextResponse.json(
        { error: "Cadet profile is not yet linked. Contact your battalion administrator." },
        { status: 404 }
      );
    }

    await requireCadetOwnership(cadet.cadetId);

    const body = await request.json();
    const parseResult = await CreateChangeRequestInputSchema.safeParseAsync(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed for change request submission",
          details: parseResult.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
        },
        { status: 400 }
      );
    }

    const { fieldId, newValue, reason } = parseResult.data;

    // Fetch field definition to get snapshot label
    const fieldDoc = await adminDb.collection("fields").doc(fieldId).get();
    if (!fieldDoc.exists) {
      return NextResponse.json(
        { error: `Field '${fieldId}' does not exist.` },
        { status: 404 }
      );
    }

    const fieldData = fieldDoc.data() as FieldDefinition;
    const fieldLabel = fieldData.label || fieldId;
    const oldValue = cadet.dynamicData?.[fieldId] ?? null;

    const changeRequestId = await generateChangeRequestId();
    const timestamp = new Date().toISOString();

    const newChangeRequest: ChangeRequest = {
      changeRequestId,
      cadetId: cadet.cadetId,
      fieldId,
      fieldLabel,
      oldValue,
      newValue,
      reason,
      status: "pending",
      requestedBy: session.uid,
      requestedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await adminDb.collection("change_requests").doc(changeRequestId).set(newChangeRequest);

    // Audit Log Entry
    await logAuditEvent({
      actorId: session.uid,
      actorEmail: session.email,
      actorRole: "cadet",
      action: "change_request.create",
      entityType: "change_request",
      entityId: changeRequestId,
      newState: newChangeRequest as unknown as Record<string, unknown>,
      metadata: {
        cadetId: cadet.cadetId,
        fieldId,
        fieldLabel,
      },
    });

    return NextResponse.json(
      {
        success: true,
        changeRequest: newChangeRequest,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("POST /api/cadet/change-requests error:", error);
    return NextResponse.json(
      { error: "Internal server error while creating change request" },
      { status: 500 }
    );
  }
}
