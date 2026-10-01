import { RoomServiceClient } from "livekit-server-sdk";

import { resolveLiveKitConfig } from "../../config/livekit.config.js";
import { LiveKitConfigurationError } from "./direct-conversation-call.errors.js";
import { liveKitRoomNameForCall } from "./livekit-access.js";

/**
 * Test seam. Production uses RoomServiceClient. A thrown deleter must not
 * change the already-persisted Call end transition.
 */
let roomDeleterForTests: ((roomName: string) => Promise<void>) | null = null;

export function setLiveKitRoomDeleterForTests(
  deleter: ((roomName: string) => Promise<void>) | null,
): void {
  roomDeleterForTests = deleter;
}

async function deleteLiveKitRoom(roomName: string): Promise<void> {
  if (roomDeleterForTests) {
    await roomDeleterForTests(roomName);
    return;
  }

  const config = resolveLiveKitConfig();
  const client = new RoomServiceClient(config.httpHost, config.apiKey, config.apiSecret);
  await client.deleteRoom(roomName);
}

/**
 * Best-effort. The Call row is already terminal. Missing LiveKit config and
 * deletion errors are ignored so end stays durable.
 */
export async function releaseLiveKitRoomAfterEnd(callId: string): Promise<void> {
  const roomName = liveKitRoomNameForCall(callId);

  try {
    await deleteLiveKitRoom(roomName);
  } catch (error) {
    if (error instanceof LiveKitConfigurationError) {
      return;
    }

    console.error(`LiveKit room deletion failed after call end for ${callId}.`);
  }
}
