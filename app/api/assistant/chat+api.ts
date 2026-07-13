import { handleAssistantChat } from '@/src/backend/assistant';

export function POST(request: Request): Promise<Response> {
  return handleAssistantChat(request);
}
