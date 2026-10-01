import { AccessToken, TrackSource } from "livekit-server-sdk";

import { LIVEKIT_TOKEN_TTL, type LiveKitServerConfig } from "../../config/livekit.config.js";

/**
 * Room and identity stay in one place so a later multi-device policy can
 * change the LiveKit strings without rewriting call authorization.
 * Neither value is taken from the browser.
 */
export function liveKitRoomNameForCall(callId: string): string {
  return callId;
}

export function liveKitIdentityForParticipant(participantId: string): string {
  return participantId;
}

export async function mintLiveKitParticipantToken(input: {
  config: Pick<LiveKitServerConfig, "apiKey" | "apiSecret">;
  callId: string;
  participantId: string;
}): Promise<string> {
  const token = new AccessToken(input.config.apiKey, input.config.apiSecret, {
    identity: liveKitIdentityForParticipant(input.participantId),
    ttl: LIVEKIT_TOKEN_TTL,
  });

  token.addGrant({
    roomJoin: true,
    room: liveKitRoomNameForCall(input.callId),
    canPublish: true,
    canSubscribe: true,
    canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE],
    canPublishData: false,
    roomAdmin: false,
    roomCreate: false,
    roomRecord: false,
    recorder: false,
    ingressAdmin: false,
  });

  return token.toJwt();
}
