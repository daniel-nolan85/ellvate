export type AssistantTool =
  | 'search_events'
  | 'search_missions'
  | 'search_posts';

export interface AssistantToolCall {
  readonly tool: AssistantTool;
  readonly label: string;
}

export interface AssistantChatMessage {
  readonly role: 'user' | 'assistant';
  readonly text: string;
}

export interface AssistantReply {
  readonly reply: string;
  readonly toolCalls: readonly AssistantToolCall[];
}
