import { deliverPendingEmails, type EmailDeliveryResult } from "@/lib/email";
import { deliverPendingSms, type SmsDeliveryResult } from "@/lib/sms";

export type MessageDeliveryResult = { emails: EmailDeliveryResult; texts: SmsDeliveryResult };

// Sends everything queued for workshops and customers: emails through Resend, texts
// through ClickSend.
export async function deliverPendingMessages(): Promise<MessageDeliveryResult> {
  const [emails, texts] = await Promise.all([deliverPendingEmails(), deliverPendingSms()]);
  return { emails, texts };
}
