import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { generateNotificationId } from "@/lib/ids";
import { logAuditEvent } from "@/lib/security/audit";
import {
  AppNotification,
  NotificationImportance,
  NotificationRecipient,
  NotificationEntityType,
  NotificationSender,
} from "@/types/notifications";

export interface CreateNotificationParams {
  recipient: NotificationRecipient;
  recipientCadetId?: string;
  recipientRole?: "cadet" | "cto" | "admin" | "all";
  title: string;
  message: string;
  importance?: NotificationImportance;
  entityType?: NotificationEntityType;
  entityId?: string;
  link?: string;
  sender?: NotificationSender;
  broadcastId?: string;
  targetGroup?: "all_cadets" | "selected_cadets" | "all_ctos" | "specific_user";
}

export interface CreateBroadcastParams {
  targetGroup: "all_cadets" | "selected_cadets" | "all_ctos" | "specific_user";
  targetCadetIds?: string[];
  targetUserId?: string;
  title: string;
  message: string;
  importance?: NotificationImportance;
  link?: string;
  entityType?: NotificationEntityType;
  entityId?: string;
  sender: NotificationSender;
}

const DEFAULT_SYSTEM_SENDER: NotificationSender = {
  id: "system",
  name: "NCC Automated Notification System",
  role: "system",
};

/**
 * Creates an individual notification in the `notifications` Firestore collection.
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<AppNotification> {
  const notificationId = await generateNotificationId();
  const now = new Date().toISOString();

  let resolvedRole = params.recipientRole;
  let resolvedCadetId = params.recipientCadetId;

  // If recipient is a CADET_ ID, automatically associate recipientCadetId
  if (params.recipient.startsWith("CADET_")) {
    resolvedCadetId = params.recipient;
    resolvedRole = "cadet";
  }

  const notificationDoc: AppNotification = {
    notificationId,
    recipient: params.recipient,
    recipientId: params.recipient,
    recipientCadetId: resolvedCadetId || null,
    recipientRole: resolvedRole || null,
    sender: params.sender || DEFAULT_SYSTEM_SENDER,
    title: params.title.trim(),
    message: params.message.trim(),
    importance: params.importance || "normal",
    isRead: false,
    readAt: null,
    readBy: [],
    entityType: params.entityType || null,
    entityId: params.entityId || null,
    link: params.link || null,
    broadcastId: params.broadcastId || null,
    targetGroup: params.targetGroup || null,
    createdAt: now,
    updatedAt: now,
  };

  await adminDb.collection("notifications").doc(notificationId).set(notificationDoc);
  return notificationDoc;
}

/**
 * Creates a broadcast notification targeting multiple recipients per Section 23.
 * Targets: all cadets, selected cadets, all CTOs, or specific user.
 * Generates delivery records and records an immutable audit log entry.
 */
export async function createBroadcastNotification(
  params: CreateBroadcastParams
): Promise<{ broadcastId: string; recipientCount: number; notifications: AppNotification[] }> {
  const {
    targetGroup,
    targetCadetIds = [],
    targetUserId,
    title,
    message,
    importance = "normal",
    link,
    entityType = "broadcast",
    entityId,
    sender,
  } = params;

  const broadcastId = `BCAST_${Date.now()}`;
  const now = new Date().toISOString();
  const recipientsList: Array<{ recipient: string; cadetId?: string; role: "cadet" | "cto" | "admin" }> = [];

  if (targetGroup === "all_cadets") {
    const cadetsSnap = await adminDb.collection("cadets").get();
    cadetsSnap.forEach((doc) => {
      const data = doc.data();
      const cadetId = data.cadetId || doc.id;
      recipientsList.push({
        recipient: cadetId,
        cadetId,
        role: "cadet",
      });
    });

    // Also support role-based fallback broadcast document if 0 cadets exist in DB
    if (recipientsList.length === 0) {
      recipientsList.push({
        recipient: "role:cadet",
        role: "cadet",
      });
    }
  } else if (targetGroup === "selected_cadets") {
    for (const cadetId of targetCadetIds) {
      recipientsList.push({
        recipient: cadetId,
        cadetId,
        role: "cadet",
      });
    }
  } else if (targetGroup === "all_ctos") {
    const ctoSnap = await adminDb.collection("users").where("role", "==", "cto").get();
    ctoSnap.forEach((doc) => {
      recipientsList.push({
        recipient: doc.id,
        role: "cto",
      });
    });

    if (recipientsList.length === 0) {
      recipientsList.push({
        recipient: "role:cto",
        role: "cto",
      });
    }
  } else if (targetGroup === "specific_user" && targetUserId) {
    recipientsList.push({
      recipient: targetUserId,
      cadetId: targetUserId.startsWith("CADET_") ? targetUserId : undefined,
      role: targetUserId.startsWith("CADET_") ? "cadet" : "cto",
    });
  }

  const createdNotifications: AppNotification[] = [];

  // Write in batches of 400 to observe Firestore limits
  const BATCH_SIZE = 400;
  for (let i = 0; i < recipientsList.length; i += BATCH_SIZE) {
    const chunk = recipientsList.slice(i, i + BATCH_SIZE);
    const batch = adminDb.batch();

    for (const item of chunk) {
      const notifId = await generateNotificationId();
      const notifDoc: AppNotification = {
        notificationId: notifId,
        recipient: item.recipient,
        recipientId: item.recipient,
        recipientCadetId: item.cadetId || null,
        recipientRole: item.role || null,
        sender,
        title: title.trim(),
        message: message.trim(),
        importance,
        isRead: false,
        readAt: null,
        readBy: [],
        entityType: entityType || null,
        entityId: entityId || broadcastId,
        link: link || null,
        broadcastId,
        targetGroup,
        createdAt: now,
        updatedAt: now,
      };

      const ref = adminDb.collection("notifications").doc(notifId);
      batch.set(ref, notifDoc);
      createdNotifications.push(notifDoc);
    }

    await batch.commit();
  }

  // Record Audit Log for broadcast send
  await logAuditEvent({
    actorId: sender.id,
    actorEmail: sender.name,
    actorRole: sender.role,
    action: "BROADCAST_NOTIFICATION_SENT",
    entityType: "notification",
    entityId: broadcastId,
    newState: {
      broadcastId,
      targetGroup,
      recipientCount: recipientsList.length,
      title,
      importance,
    },
    metadata: {
      targetGroup,
      targetCadetCount: targetCadetIds.length,
      recipientCount: recipientsList.length,
    },
  });

  return {
    broadcastId,
    recipientCount: recipientsList.length,
    notifications: createdNotifications,
  };
}

/**
 * Retrieves notifications for an authenticated user based on UID, cadetId, and role.
 * Includes direct messages and role-level broadcasts.
 */
export async function getUserNotifications(user: {
  uid: string;
  role: string;
  cadetId?: string;
  limit?: number;
}): Promise<AppNotification[]> {
  const recipients: string[] = [user.uid, `role:${user.role}`, "all"];
  if (user.cadetId) {
    recipients.push(user.cadetId);
  }

  // Query by recipient without compound order to avoid requiring custom composite indexes
  const snapshot = await adminDb
    .collection("notifications")
    .where("recipient", "in", recipients)
    .get();

  const notifications: AppNotification[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data() as AppNotification;
    // Compute read status for this specific user
    const isBroadcast =
      data.recipient === "all" ||
      data.recipient.startsWith("role:");

    const userHasRead = isBroadcast
      ? Boolean(data.readBy?.includes(user.uid))
      : Boolean(data.isRead);

    notifications.push({
      ...data,
      isRead: userHasRead,
    });
  });

  // Sort descending by createdAt in memory
  notifications.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const maxLimit = user.limit || 50;
  return notifications.slice(0, maxLimit);
}

/**
 * Calculates unread notifications count for a user.
 */
export async function getUnreadNotificationCount(user: {
  uid: string;
  role: string;
  cadetId?: string;
}): Promise<number> {
  const notifications = await getUserNotifications({ ...user, limit: 100 });
  return notifications.filter((n) => !n.isRead).length;
}

/**
 * Marks a single notification as read for a given user.
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<{ success: boolean; isRead: boolean }> {
  const notifRef = adminDb.collection("notifications").doc(notificationId);
  const snap = await notifRef.get();

  if (!snap.exists) {
    return { success: false, isRead: false };
  }

  const data = snap.data() as AppNotification;
  const now = new Date().toISOString();

  if (data.recipient === "all" || data.recipient.startsWith("role:")) {
    await notifRef.update({
      readBy: FieldValue.arrayUnion(userId),
      updatedAt: now,
    });
  } else {
    await notifRef.update({
      isRead: true,
      readAt: now,
      updatedAt: now,
    });
  }

  return { success: true, isRead: true };
}

/**
 * Marks all notifications as read for a given user.
 */
export async function markAllNotificationsAsRead(user: {
  uid: string;
  role: string;
  cadetId?: string;
}): Promise<{ count: number }> {
  const notifications = await getUserNotifications({ ...user, limit: 100 });
  const unreadList = notifications.filter((n) => !n.isRead);

  const batch = adminDb.batch();
  const now = new Date().toISOString();

  for (const n of unreadList) {
    const ref = adminDb.collection("notifications").doc(n.notificationId);
    if (n.recipient === "all" || n.recipient.startsWith("role:")) {
      batch.update(ref, {
        readBy: FieldValue.arrayUnion(user.uid),
        updatedAt: now,
      });
    } else {
      batch.update(ref, {
        isRead: true,
        readAt: now,
        updatedAt: now,
      });
    }
  }

  await batch.commit();
  return { count: unreadList.length };
}

/**
 * Retrieves sent broadcasts for Admin overview.
 */
export async function getAdminSentBroadcasts(limit = 50): Promise<Array<{
  broadcastId: string;
  title: string;
  message: string;
  targetGroup: string;
  recipientCount: number;
  readCount: number;
  importance: NotificationImportance;
  senderName: string;
  createdAt: string;
}>> {
  const snapshot = await adminDb
    .collection("notifications")
    .where("targetGroup", "!=", null)
    .get();

  const groups: Record<
    string,
    {
      broadcastId: string;
      title: string;
      message: string;
      targetGroup: string;
      recipientCount: number;
      readCount: number;
      importance: NotificationImportance;
      senderName: string;
      createdAt: string;
    }
  > = {};

  snapshot.forEach((doc) => {
    const data = doc.data() as AppNotification;
    const bId = data.broadcastId || data.notificationId;

    if (!groups[bId]) {
      groups[bId] = {
        broadcastId: bId,
        title: data.title,
        message: data.message,
        targetGroup: data.targetGroup || "broadcast",
        recipientCount: 0,
        readCount: 0,
        importance: data.importance,
        senderName: data.sender?.name || "Admin",
        createdAt: data.createdAt,
      };
    }

    groups[bId].recipientCount += 1;
    if (data.isRead || (data.readBy && data.readBy.length > 0)) {
      groups[bId].readCount += 1;
    }
  });

  const list = Object.values(groups);
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return list.slice(0, limit);
}
