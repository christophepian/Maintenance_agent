import { PrismaClient } from "@prisma/client";
import { dequeuePending, markSent, markFailed, incrementRetry } from "../repositories/whatsAppOutboxRepository";

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set");
  }
  // Lazy require so the module loads without credentials in test/build environments
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const twilio = require("twilio");
  return twilio(accountSid, authToken);
}

export async function sendMessage(toPhone: string, body: string): Promise<void> {
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from) throw new Error("TWILIO_WHATSAPP_FROM must be set");

  const client = getTwilioClient();
  await client.messages.create({
    from,
    to: `whatsapp:${toPhone}`,
    body,
  });
}

export async function drainOutbox(prisma: PrismaClient): Promise<number> {
  const pending = await dequeuePending(prisma);
  let sent = 0;

  for (const record of pending) {
    try {
      await sendMessage(record.toPhone, record.body);
      await markSent(prisma, record.id);
      sent++;
    } catch (err: any) {
      await incrementRetry(prisma, record.id);
      const retryCount = record.retryCount + 1;
      if (retryCount >= 3) {
        await markFailed(prisma, record.id, err?.message ?? "Unknown error");
      }
      console.error(`[whatsAppService] Send failed for ${record.id} (attempt ${retryCount}):`, err?.message);
    }
  }

  return sent;
}
