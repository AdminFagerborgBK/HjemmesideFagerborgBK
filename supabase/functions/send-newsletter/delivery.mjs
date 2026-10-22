// Persist before sending; a failed outcome write leaves pending intent intact.
export async function deliverRecorded({ recordIntent, send, recordOutcome }) {
  const intent = await recordIntent();
  const result = await send();
  await recordOutcome(intent, result);
  return result;
}