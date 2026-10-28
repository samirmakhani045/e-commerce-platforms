export async function getCouponSettings(connection) {
  const [rows] = await connection.query(
    `SELECT
       order_interval_n AS orderIntervalN,
       discount_percent_x AS discountPercentX,
       reservation_seconds AS reservationSeconds
     FROM coupon_settings
     WHERE id = 1
     LIMIT 1`,
  );

  return rows[0] ?? null;
}

export async function updateCouponSettings(connection, settings) {
  await connection.query(
    `UPDATE coupon_settings
     SET
       order_interval_n = ?,
       discount_percent_x = ?,
       reservation_seconds = ?
     WHERE id = 1`,
    [settings.orderIntervalN, settings.discountPercentX, settings.reservationSeconds],
  );
}

export async function releaseExpiredCouponReservations(connection) {
  await connection.query(
    `UPDATE coupons
     SET
       status = 'available',
       reserved_by_user_id = NULL,
       reserved_until = NULL
     WHERE status = 'reserved'
       AND reserved_until IS NOT NULL
       AND reserved_until <= UTC_TIMESTAMP()`,
  );
}

export async function clearCouponReservation(connection, couponId) {
  await connection.query(
    `UPDATE coupons
     SET
       status = 'available',
       reserved_by_user_id = NULL,
       reserved_until = NULL
     WHERE id = ?
       AND status = 'reserved'`,
    [couponId],
  );
}

export async function findCouponByCodeForUpdate(connection, code) {
  const [rows] = await connection.query(
    `SELECT
       id,
       code,
       discount_type,
       discount_value,
       source,
       milestone_seq,
       status,
       reserved_by_user_id,
       reserved_until
     FROM coupons
     WHERE code = ?
     LIMIT 1
     FOR UPDATE`,
    [code],
  );

  return rows[0] ?? null;
}

export async function findMilestoneCouponBySeq(connection, milestoneSeq) {
  const [rows] = await connection.query(
    `SELECT
       id,
       code,
       discount_type,
       discount_value,
       source,
       milestone_seq,
       status,
       reserved_by_user_id,
       reserved_until,
       redeemed_order_id,
       redeemed_at,
       created_at
     FROM coupons
     WHERE milestone_seq = ?
     LIMIT 1`,
    [milestoneSeq],
  );

  return rows[0] ?? null;
}

export async function findMilestoneCouponForUpdate(connection, milestoneSeq) {
  const [rows] = await connection.query(
    `SELECT
       id,
       code,
       discount_type,
       discount_value,
       source,
       milestone_seq,
       status,
       reserved_by_user_id,
       reserved_until
     FROM coupons
     WHERE milestone_seq = ?
     LIMIT 1
     FOR UPDATE`,
    [milestoneSeq],
  );

  return rows[0] ?? null;
}

export async function insertCoupon(connection, coupon) {
  await connection.query(
    `INSERT INTO coupons (
       id,
       code,
       discount_type,
       discount_value,
       source,
       milestone_seq,
       status
     ) VALUES (?, ?, ?, ?, ?, ?, 'available')`,
    [
      coupon.id,
      coupon.code,
      coupon.discount_type,
      coupon.discount_value,
      coupon.source,
      coupon.milestone_seq,
    ],
  );
}

export async function clearExpiredReservationForCoupon(connection, couponId) {
  await connection.query(
    `UPDATE coupons
     SET
       status = 'available',
       reserved_by_user_id = NULL,
       reserved_until = NULL
     WHERE id = ?
       AND status = 'reserved'
       AND reserved_until IS NOT NULL
       AND reserved_until <= UTC_TIMESTAMP()`,
    [couponId],
  );
}

export async function isCouponHeldByAnotherUser(connection, couponId, userId) {
  const [rows] = await connection.query(
    `SELECT reserved_by_user_id AS holderId
     FROM coupons
     WHERE id = ?
       AND status = 'reserved'
       AND reserved_by_user_id IS NOT NULL
       AND reserved_until IS NOT NULL
       AND reserved_until > UTC_TIMESTAMP()
       AND LOWER(TRIM(reserved_by_user_id)) <> LOWER(TRIM(?))
     LIMIT 1`,
    [couponId, userId],
  );

  return rows[0]?.holderId ?? null;
}

export async function reserveCoupon(connection, couponId, userId, reservationSeconds) {
  const [result] = await connection.query(
    `UPDATE coupons
     SET
       status = 'reserved',
       reserved_by_user_id = ?,
       reserved_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND)
     WHERE id = ?
       AND status <> 'redeemed'
       AND (
         status = 'available'
         OR (
           status = 'reserved'
           AND LOWER(TRIM(reserved_by_user_id)) = LOWER(TRIM(?))
         )
         OR (
           status = 'reserved'
           AND (
             reserved_until IS NULL
             OR reserved_until <= UTC_TIMESTAMP()
           )
         )
       )`,
    [userId, reservationSeconds, couponId, userId],
  );

  return result.affectedRows;
}

export async function findCouponReservedUntil(connection, couponId) {
  const [rows] = await connection.query(
    `SELECT reserved_until AS reservedUntil
     FROM coupons
     WHERE id = ?
     LIMIT 1`,
    [couponId],
  );

  return rows[0]?.reservedUntil ?? null;
}

export async function getCouponSecondsRemaining(connection, couponId, userId) {
  const [rows] = await connection.query(
    `SELECT
       GREATEST(
         0,
         TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), reserved_until)
       ) AS secondsRemaining
     FROM coupons
     WHERE id = ?
       AND status = 'reserved'
       AND LOWER(TRIM(reserved_by_user_id)) = LOWER(TRIM(?))
       AND reserved_until IS NOT NULL
       AND reserved_until > UTC_TIMESTAMP()
     LIMIT 1`,
    [couponId, userId],
  );

  const raw = rows[0]?.secondsRemaining;
  return raw == null ? 0 : Number(raw);
}

/** Active hold time on the row (UTC), without filtering by user — use after holder match in app code. */
export async function getActiveReservedHoldSeconds(connection, couponId) {
  const [rows] = await connection.query(
    `SELECT
       GREATEST(
         0,
         TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), reserved_until)
       ) AS secondsRemaining
     FROM coupons
     WHERE id = ?
       AND status = 'reserved'
       AND reserved_until IS NOT NULL
       AND reserved_until > UTC_TIMESTAMP()
     LIMIT 1`,
    [couponId],
  );

  const raw = rows[0]?.secondsRemaining;
  return raw == null ? 0 : Number(raw);
}

export async function redeemCoupon(connection, couponId, orderId) {
  await connection.query(
    `UPDATE coupons
     SET
       status = 'redeemed',
       reserved_by_user_id = NULL,
       reserved_until = NULL,
       redeemed_order_id = ?,
       redeemed_at = UTC_TIMESTAMP()
     WHERE id = ?
       AND status IN ('available', 'reserved')`,
    [orderId, couponId],
  );
}

export async function listCoupons(connection) {
  const [rows] = await connection.query(
    `SELECT
       id,
       code,
       discount_type,
       discount_value,
       source,
       milestone_seq,
       status,
       reserved_by_user_id,
       reserved_until,
       redeemed_order_id,
       redeemed_at,
       created_at
     FROM coupons
     ORDER BY created_at DESC`,
  );

  return rows;
}

export async function findCouponByCode(connection, code) {
  const [rows] = await connection.query(
    `SELECT id FROM coupons WHERE code = ? LIMIT 1`,
    [code],
  );

  return rows[0] ?? null;
}
