export function deliveryOutcome(sent: number, failed: number) {
  return {success:failed===0,status:failed===0?'sent':'partial',sent_count:sent,failed_count:failed};
}
export function assertTestRecipient(email: string | undefined) {
  if(!email) throw new Error('Test-sending krever innlogget admin');
  return [email];
}