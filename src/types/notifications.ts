import { z } from "zod";

export type NotificationImportance = "normal" | "important";

export type NotificationRecipientRole = "cadet" | "cto" | "admin" | "all";

export type NotificationRecipient =
  | string // Specific UID or Cadet ID (e.g. CADET_0001, user-uid-123)
  | "role:cadet"
  | "role:cto"
  | "role:admin"
  | "all";

export type NotificationEntityType =
  | "change_request"
  | "data_request"
  | "document"
  | "broadcast"
  | "cadet";

export interface NotificationSender {
  id: string; // Firebase Auth UID or "system"
  name: string; // e.g. "System", "admin@ncc.test", "Capt. Sharma"
  role: "admin" | "cto" | "system";
}

export interface AppNotification {
  notificationId: string; // Permanent ID, e.g. NOTIF_00001
  recipient: NotificationRecipient;
  recipientId?: string | null; // Target UID or Cadet ID
  recipientCadetId?: string | null;
  recipientRole?: NotificationRecipientRole | null;
  sender: NotificationSender;
  title: string;
  message: string;
  importance: NotificationImportance; // "normal" | "important"
  isRead: boolean;
  readAt?: string | null;
  readBy?: string[]; // UIDs who marked a broadcast notification as read
  entityType?: NotificationEntityType | null;
  entityId?: string | null;
  link?: string | null; // Relative URL e.g. "/cadet/change-requests"
  broadcastId?: string | null;
  targetGroup?: "all_cadets" | "selected_cadets" | "all_ctos" | "specific_user" | null;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export const createNotificationSchema = z.object({
  recipient: z.string().min(1, "Recipient is required"),
  recipientCadetId: z.string().optional(),
  title: z.string().trim().min(1, "Title is required").max(150),
  message: z.string().trim().min(1, "Message is required").max(2000),
  importance: z.enum(["normal", "important"]).default("normal"),
  entityType: z.enum(["change_request", "data_request", "document", "broadcast", "cadet"]).optional(),
  entityId: z.string().optional(),
  link: z.string().optional(),
});

export const sendBroadcastNotificationSchema = z.object({
  targetGroup: z.enum(["all_cadets", "selected_cadets", "all_ctos", "specific_user"]),
  targetCadetIds: z.array(z.string()).optional(),
  targetUserId: z.string().optional(),
  title: z.string().trim().min(1, "Title is required").max(150),
  message: z.string().trim().min(1, "Message is required").max(2000),
  importance: z.enum(["normal", "important"]).default("normal"),
  link: z.string().optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type SendBroadcastNotificationInput = z.infer<typeof sendBroadcastNotificationSchema>;
