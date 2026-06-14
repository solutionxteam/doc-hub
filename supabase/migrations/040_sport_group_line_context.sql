-- 040_sport_group_line_context.sql
--
-- Lets the bot push bill/payment update cards back into the LINE group/room
-- where a sport group was created (à la KhunThong):
--   - bill created/finalized card
--   - "{name} จ่ายแล้ว ... ให้ {collector}" payment confirmation + rank medal
--   - "จ่ายครบแล้ว 🎉" celebration card once everyone has paid
--   - periodic "อย่าลืมจ่ายด้วยนะ 📌" reminder for outstanding bills

ALTER TABLE split_bills
  ADD COLUMN IF NOT EXISTS line_group_id text;

COMMENT ON COLUMN split_bills.line_group_id IS
  'LINE group/room id (event.source.groupId / roomId) where this sport group was created — used to push bill/payment update cards back into the chat.';
