// Detection and splitting off the main thread: a long song's split takes about a second.
import { answerHandsRequest } from './answerHandsRequest'
import type { HandsReply, HandsRequest } from './HandsWorkerMessage'

onmessage = (event: MessageEvent<HandsRequest & { readonly id: number }>) => {
  const { id, ...request } = event.data
  let reply: HandsReply
  try {
    reply = { id, result: answerHandsRequest(request) }
  } catch (e) {
    reply = { id, error: e instanceof Error ? e.message : String(e) }
  }
  postMessage(reply)
}
