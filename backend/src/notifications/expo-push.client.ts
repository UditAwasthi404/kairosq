import { Logger } from '@nestjs/common';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_BATCH = 100;

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: 'default';
  channelId?: string;
};

type ExpoTicket = {
  status?: string;
  id?: string;
  message?: string;
  details?: { error?: string };
};

export type ExpoPushSendResult = {
  sent: number;
  invalidTokens: string[];
};

export async function sendExpoPush(
  messages: ExpoPushMessage[],
): Promise<ExpoPushSendResult> {
  const invalidTokens: string[] = [];
  let sent = 0;
  if (messages.length === 0) {
    return { sent, invalidTokens };
  }

  for (let i = 0; i < messages.length; i += MAX_BATCH) {
    const batch = messages.slice(i, i + MAX_BATCH);
    const tickets = await postTickets(batch);
    tickets.forEach((ticket, index) => {
      if (ticket.status === 'ok') {
        sent += 1;
        return;
      }
      if (ticket.details?.error === 'DeviceNotRegistered') {
        const token = batch[index]?.to;
        if (token) invalidTokens.push(token);
      }
    });
  }

  return { sent, invalidTokens };
}

async function postTickets(messages: ExpoPushMessage[]): Promise<ExpoTicket[]> {
  const logger = new Logger('ExpoPush');
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    if (!response.ok) {
      logger.warn(`Expo push HTTP ${response.status}`);
      return [];
    }
    const body = (await response.json()) as { data?: ExpoTicket[] };
    return Array.isArray(body.data) ? body.data : [];
  } catch (error) {
    logger.warn(
      `Expo push request failed: ${error instanceof Error ? error.message : 'unknown'}`,
    );
    return [];
  }
}
