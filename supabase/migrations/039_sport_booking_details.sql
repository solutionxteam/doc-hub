-- 039_sport_booking_details.sql
--
-- Extends sport groups (split_bills.category = 'sport') with booking-specific
-- fields so the LIFF "/liff/sport" registration page can mirror the typical
-- LINE group announcement format, e.g.:
--
--   @All  ตีแบด พุธที่ 10 มิ.ย.
--   เวลา 2-4 ทุ่ม 1 คอร์ด No.2
--   1. พี่กบ
--   2. พี่แนน
--   ...
--   8. ฟิว +1
--   https://maps.app.goo.gl/...
--   SP Badminton Court · 52 นาคนิวาส 6 ...  ★★★★★ · สนามแบดมินตัน
--
-- booking_date / start_time / end_time / court_no / map_url cover the event
-- header + venue card. guest_count on split_participants covers the "+1"
-- guest pattern seen in real bookings (e.g. "8. ฟิว +1").

ALTER TABLE split_bills
  ADD COLUMN IF NOT EXISTS booking_date date,
  ADD COLUMN IF NOT EXISTS start_time   time,
  ADD COLUMN IF NOT EXISTS end_time     time,
  ADD COLUMN IF NOT EXISTS court_no     text,
  ADD COLUMN IF NOT EXISTS map_url      text,
  ADD COLUMN IF NOT EXISTS max_players  integer;

ALTER TABLE split_participants
  ADD COLUMN IF NOT EXISTS guest_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN split_bills.booking_date IS 'Sport booking date (e.g. Wednesday 10 Jun)';
COMMENT ON COLUMN split_bills.start_time   IS 'Booking start time, e.g. 20:00';
COMMENT ON COLUMN split_bills.end_time     IS 'Booking end time, e.g. 22:00';
COMMENT ON COLUMN split_bills.court_no     IS 'Court/field label, e.g. "1 คอร์ด No.2"';
COMMENT ON COLUMN split_bills.map_url      IS 'Google Maps link to the venue';
COMMENT ON COLUMN split_bills.max_players  IS 'Optional cap on number of players';
COMMENT ON COLUMN split_participants.guest_count IS 'Extra guests brought by this participant (the "+1" pattern)';
