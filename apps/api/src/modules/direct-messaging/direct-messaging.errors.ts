export class DirectMessagingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DirectMessagingValidationError";
  }
}

export class DirectMessagingParticipantNotFoundError extends Error {
  constructor(message = "That Participant could not be found.") {
    super(message);
    this.name = "DirectMessagingParticipantNotFoundError";
  }
}

export class DirectMessagingSelfMessageError extends Error {
  constructor(message = "You cannot start a conversation with yourself.") {
    super(message);
    this.name = "DirectMessagingSelfMessageError";
  }
}

/**
 * Deliberately neutral message (Part 7: "Do not expose the exact private
 * reason unnecessarily") — covers Privacy `"nobody"`, a failed Active
 * Allies check, and any other policy rejection with one identical message.
 */
export class DirectMessagingBlockedError extends Error {
  constructor(message = "Messaging is not available for this Participant.") {
    super(message);
    this.name = "DirectMessagingBlockedError";
  }
}

export class DirectMessagingConversationNotFoundError extends Error {
  constructor(message = "Conversation not found.") {
    super(message);
    this.name = "DirectMessagingConversationNotFoundError";
  }
}

/** A Participant tried to read or send into a conversation they are not a member of. */
export class DirectMessagingAccessDeniedError extends Error {
  constructor(message = "You do not have access to this conversation.") {
    super(message);
    this.name = "DirectMessagingAccessDeniedError";
  }
}

export class DirectMessagingPersistenceUnavailableError extends Error {
  constructor(message = "Direct Collaboration messaging persistence is unavailable. MongoDB is required.") {
    super(message);
    this.name = "DirectMessagingPersistenceUnavailableError";
  }
}

export class DirectMessagingPersistenceError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = "DirectMessagingPersistenceError";
  }
}
