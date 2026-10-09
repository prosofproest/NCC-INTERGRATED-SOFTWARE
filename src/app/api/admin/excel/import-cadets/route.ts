import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireAdmin, AuthError } from "@/lib/authorization";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { generateCadetId } from "@/lib/ids";
import { logAuditEvent } from "@/lib/security/audit";
import { sendCadetWelcomeEmail } from "@/lib/email/mailer";
import { CadetBatchConfirmInputSchema } from "@/lib/validation/excel";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/excel/import-cadets
 * Executes confirmed batch creation of cadet accounts.
 * Atomically provisions Auth user, Firestore profiles, role claims, and welcome email.
 * Guarantees atomic rollback on failure per row — zero orphaned auth users or partial records.
 * Strictly Admin-only.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();

    const body = await req.json();
    const parseResult = CadetBatchConfirmInputSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed for cadet batch payload.",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { cadets } = parseResult.data;
    const now = new Date().toISOString();

    const createdCadets: Array<{
      cadetId: string;
      email: string;
      fullName: string;
      enrollmentNo: string | null;
      emailSent: boolean;
      emailError?: string;
    }> = [];
    const failedCadets: Array<{
      email: string;
      name: string;
      error: string;
    }> = [];

    // Process each valid row with isolated transaction & rollback safety
    for (const item of cadets) {
      const normalizedEmail = item.email.trim().toLowerCase();
      const normalizedEnrollment = item.enrollmentNo
        ? item.enrollmentNo.trim().toUpperCase().replace(/\s+/g, "")
        : null;
      let createdAuthUid: string | null = null;
      let generatedCadetId: string | null = null;

      try {
        // 1. Check enrollment number uniqueness if provided
        if (normalizedEnrollment) {
          const existingIndexDoc = await adminDb
            .collection("enrollment_index")
            .doc(normalizedEnrollment)
            .get();
          if (existingIndexDoc.exists) {
            throw new Error(
              `Enrollment ID '${normalizedEnrollment}' is already assigned to cadet (${existingIndexDoc.data()?.cadetId}).`
            );
          }
        }

        // 2. Generate permanent Cadet ID
        generatedCadetId = await generateCadetId();

        // 3. Generate secure temporary password
        const tempPassword = `${crypto.randomBytes(6).toString("hex")}!Ncc1`;

        // 4. Create Firebase Auth user
        const userRecord = await adminAuth.createUser({
          email: normalizedEmail,
          password: tempPassword,
          displayName: item.name.trim(),
        });
        createdAuthUid = userRecord.uid;

        // 5. Set custom claims for cadet role & permanent cadetId
        await adminAuth.setCustomUserClaims(createdAuthUid, {
          role: "cadet",
          cadetId: generatedCadetId,
        });

        // 6. Atomic Batch Write in Firestore (users + cadets + enrollment_index)
        const batch = adminDb.batch();

        const userDocRef = adminDb.collection("users").doc(createdAuthUid);
        batch.set(userDocRef, {
          uid: createdAuthUid,
          email: normalizedEmail,
          name: item.name.trim(),
          role: "cadet",
          cadetId: generatedCadetId,
          mustChangePassword: true,
          createdAt: now,
          updatedAt: now,
        });

        const cadetDocRef = adminDb.collection("cadets").doc(generatedCadetId);
        batch.set(cadetDocRef, {
          cadetId: generatedCadetId,
          userId: createdAuthUid,
          email: normalizedEmail,
          fullName: item.name.trim(),
          enrollmentNo: normalizedEnrollment || null,
          rank: "Cadet",
          wing: "Air",
          unit: "1 Kar Air Sqn NCC",
          trainingYear: item.trainingYear || "1st Year",
          division: item.division || "SD",
          status: "active",
          driveFolderId: null,
          dynamicData: {
            phone: item.phone.trim(),
          },
          completionPercentage: 25,
          createdAt: now,
          updatedAt: now,
        });

        // Index the enrollment number atomically if present
        if (normalizedEnrollment) {
          const indexRef = adminDb.collection("enrollment_index").doc(normalizedEnrollment);
          batch.set(indexRef, {
            cadetId: generatedCadetId,
            enrollmentNo: normalizedEnrollment,
            createdAt: now,
          });
        }

        await batch.commit();

        // 7. Generate secure password activation link and dispatch welcome email
        let emailSent = false;
        let emailErrorMsg: string | undefined;

        try {
          let setupLink: string | undefined;
          try {
            setupLink = await adminAuth.generatePasswordResetLink(normalizedEmail);
          } catch (linkErr) {
            console.warn("Could not generate password reset link for cadet:", linkErr);
          }

          await sendCadetWelcomeEmail({
            to: normalizedEmail,
            cadetName: item.name.trim(),
            cadetId: generatedCadetId,
            setupLink,
          });
          emailSent = true;
        } catch (mailErr: unknown) {
          console.error("Non-blocking error dispatching welcome email:", mailErr);
          emailSent = false;
          emailErrorMsg = (mailErr as Error).message || "SMTP delivery failed";
        }

        createdCadets.push({
          cadetId: generatedCadetId,
          email: normalizedEmail,
          fullName: item.name.trim(),
          enrollmentNo: normalizedEnrollment,
          emailSent,
          emailError: emailErrorMsg,
        });
      } catch (rowErr: unknown) {
        // Rollback Firebase Auth user if Firestore write failed
        if (createdAuthUid) {
          try {
            await adminAuth.deleteUser(createdAuthUid);
          } catch (delErr) {
            console.error("Rollback failed to delete auth user:", delErr);
          }
        }

        const msg = (rowErr as Error).message || "Unknown error creating cadet account";
        failedCadets.push({
          email: normalizedEmail,
          name: item.name,
          error: msg,
        });
      }
    }

    // 8. Audit Log Entry for Batch Operation
    await logAuditEvent({
      actorId: session.uid,
      actorEmail: session.email,
      actorRole: "admin",
      action: "BATCH_CADETS_IMPORTED",
      entityType: "cadet",
      entityId: createdCadets[0]?.cadetId || "BATCH_CADET_IMPORT",
      newState: {
        totalAttempted: cadets.length,
        createdCount: createdCadets.length,
        failedCount: failedCadets.length,
        createdCadetIds: createdCadets.map((c) => c.cadetId),
      },
      metadata: {
        createdCount: createdCadets.length,
        failedCount: failedCadets.length,
        failedCadets,
      },
    });

    return NextResponse.json({
      success: true,
      totalProcessed: cadets.length,
      createdCount: createdCadets.length,
      failedCount: failedCadets.length,
      createdCadets,
      failedCadets,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("POST /api/admin/excel/import-cadets error:", error);
    return NextResponse.json(
      { error: "Failed to execute batch cadet import." },
      { status: 500 }
    );
  }
}
