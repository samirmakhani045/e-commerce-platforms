import { randomBytes, randomUUID } from 'crypto';
import pool from '../../config/db.js';
import { countPaidOrders } from '../order/order.model.js';
import {
  findCouponByCode,
  findCouponByCodeForUpdate,
  clearExpiredReservationForCoupon,
  findCouponReservedUntil,
  getActiveReservedHoldSeconds,
  getCouponSecondsRemaining,
  findMilestoneCouponBySeq,
  findMilestoneCouponForUpdate,
  getCouponSettings,
  insertCoupon,
  isCouponHeldByAnotherUser,
  listCoupons,
  redeemCoupon,
  releaseExpiredCouponReservations,
  reserveCoupon,
  updateCouponSettings,
} from './coupon.model.js';

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function normalizeCode(code) {
  return String(code ?? '').trim().toUpperCase();
}

function generateMilestoneCode(milestoneSeq) {
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `MILE${milestoneSeq}-${suffix}`;
}

function formatCouponRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    code: row.code,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    source: row.source,
    milestoneSeq: row.milestone_seq,
    status: row.status,
    reservedByUserId: row.reserved_by_user_id,
    reservedUntil: row.reserved_until,
    redeemedOrderId: row.redeemed_order_id,
    redeemedAt: row.redeemed_at,
    createdAt: row.created_at,
  };
}

function computeDiscount(subtotal, coupon) {
  const value = Number(coupon.discount_value);

  if (coupon.discount_type === 'percent') {
    return roundMoney(subtotal * (value / 100));
  }

  return roundMoney(Math.min(value, subtotal));
}

function formatOrderOrdinal(value) {
  const n = Number(value);
  const mod100 = n % 100;

  if (mod100 >= 11 && mod100 <= 13) {
    return `${n}th`;
  }

  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function formatPreMilestoneCounts(intervalN, examples = 4) {
  return Array.from({ length: examples }, (_, index) => (index + 1) * intervalN - 1).join(', ');
}

function isSameUserId(storedUserId, currentUserId) {
  if (!storedUserId || !currentUserId) {
    return false;
  }

  return (
    String(storedUserId).trim().toLowerCase()
    === String(currentUserId).trim().toLowerCase()
  );
}

function isReservationExpired(reservedUntil) {
  if (!reservedUntil) {
    return true;
  }

  const expiryMs =
    reservedUntil instanceof Date
      ? reservedUntil.getTime()
      : new Date(reservedUntil).getTime();

  return Number.isFinite(expiryMs) && expiryMs <= Date.now();
}

function isReservationActive(coupon) {
  return coupon?.status === 'reserved' && !isReservationExpired(coupon.reserved_until);
}

function toIsoExpiry(reservedUntil) {
  if (!reservedUntil) {
    return new Date().toISOString();
  }

  if (reservedUntil instanceof Date) {
    return reservedUntil.toISOString();
  }

  return new Date(reservedUntil).toISOString();
}

async function reserveCouponForUser(connection, couponId, userId, reservationSeconds) {
  const affectedRows = await reserveCoupon(connection, couponId, userId, reservationSeconds);

  if (affectedRows === 0) {
    const error = new Error('Coupon is held by another shopper');
    error.statusCode = 409;
    throw error;
  }

  const reservedUntil = await findCouponReservedUntil(connection, couponId);
  return toIsoExpiry(reservedUntil);
}

function buildSettingsPayload(intervalN, discountPercentX, reservationSeconds) {
  return {
    orderIntervalN: intervalN,
    discountPercentX,
    reservationSeconds,
  };
}

function buildMilestoneOffer(coupon, expiresAt, milestoneInfo, reservedByUserId, secondsRemaining) {
  return {
    code: coupon.code,
    discountType: coupon.discount_type,
    discountValue: Number(coupon.discount_value),
    expiresAt,
    secondsRemaining,
    reservedByUserId,
    reservedForYou: true,
    milestoneSeq: milestoneInfo.milestoneSeq,
    nextOrderNumber: milestoneInfo.nextOrderNumber,
  };
}

async function claimMilestoneCouponForUser(
  connection,
  coupon,
  userId,
  reservationSeconds,
  milestoneInfo,
) {
  const expiresAt = await reserveCouponForUser(
    connection,
    coupon.id,
    userId,
    reservationSeconds,
  );

  const secondsRemaining = await getCouponSecondsRemaining(connection, coupon.id, userId);

  if (secondsRemaining <= 0) {
    const error = new Error('Coupon reservation is not valid');
    error.statusCode = 409;
    throw error;
  }

  return buildMilestoneOffer(
    coupon,
    expiresAt,
    milestoneInfo,
    userId,
    secondsRemaining,
  );
}

/**
 * Offer rules (enforced in SQL on reserve):
 * - available → assign to current user
 * - same holder → extend reservation
 * - expired hold → reassign to current user
 * - active hold by someone else → no offer, no row update
 */
async function tryAssignMilestoneOffer(
  connection,
  coupon,
  userId,
  reservationSeconds,
  milestoneInfo,
  reloadMilestoneCoupon,
) {
  if (!coupon || coupon.status === 'redeemed') {
    return { offer: null, blocked: false, heldByUserId: null };
  }

  const otherHolderId = await isCouponHeldByAnotherUser(connection, coupon.id, userId);

  if (otherHolderId) {
    return {
      offer: null,
      blocked: true,
      heldByUserId: otherHolderId,
    };
  }

  await clearExpiredReservationForCoupon(connection, coupon.id);
  let current = await reloadMilestoneCoupon();

  if (!current || current.status === 'redeemed') {
    return { offer: null, blocked: false, heldByUserId: null };
  }

  try {
    const offer = await claimMilestoneCouponForUser(
      connection,
      current,
      userId,
      reservationSeconds,
      milestoneInfo,
    );
    return { offer, blocked: false, heldByUserId: userId };
  } catch (error) {
    if (error.statusCode === 409) {
      const holderId = await isCouponHeldByAnotherUser(connection, coupon.id, userId);
      return {
        offer: null,
        blocked: true,
        heldByUserId: holderId,
      };
    }

    throw error;
  }
}

function getNextMilestoneInfo(paidOrderCount, intervalN) {
  if (!intervalN || intervalN <= 0) {
    return null;
  }

  const nextOrderNumber = paidOrderCount + 1;

  if (nextOrderNumber % intervalN !== 0) {
    return null;
  }

  return {
    nextOrderNumber,
    milestoneSeq: nextOrderNumber / intervalN,
  };
}

export async function getSettings() {
  const settings = await getCouponSettings(pool);

  return {
    orderIntervalN: Number(settings?.orderIntervalN ?? 5),
    discountPercentX: Number(settings?.discountPercentX ?? 10),
    reservationSeconds: Number(settings?.reservationSeconds ?? 60),
  };
}

export async function saveSettings(payload) {
  const orderIntervalN = Number(payload.orderIntervalN);
  const discountPercentX = Number(payload.discountPercentX);
  const reservationSeconds = Number(payload.reservationSeconds);

  if (!Number.isInteger(orderIntervalN) || orderIntervalN <= 0) {
    const error = new Error('Order interval (n) must be a positive whole number');
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isFinite(discountPercentX) || discountPercentX <= 0 || discountPercentX > 100) {
    const error = new Error('Discount percent (x) must be between 0 and 100');
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isInteger(reservationSeconds) || reservationSeconds <= 0) {
    const error = new Error('Reservation time must be a positive whole number of seconds');
    error.statusCode = 400;
    throw error;
  }

  await updateCouponSettings(pool, {
    orderIntervalN,
    discountPercentX,
    reservationSeconds,
  });

  return getSettings();
}

export async function getAdminCoupons() {
  await releaseExpiredCouponReservations(pool);
  const rows = await listCoupons(pool);
  return rows.map(formatCouponRow);
}

async function createMilestoneCouponRecord(connection, milestoneInfo, discountPercentX, customCode) {
  const code = customCode ? normalizeCode(customCode) : generateMilestoneCode(milestoneInfo.milestoneSeq);

  if (!code) {
    const error = new Error('Coupon code is required');
    error.statusCode = 400;
    throw error;
  }

  const duplicate = await findCouponByCode(connection, code);

  if (duplicate) {
    const error = new Error('Coupon code already exists');
    error.statusCode = 409;
    throw error;
  }

  const id = randomUUID();

  try {
    await insertCoupon(connection, {
      id,
      code,
      discount_type: 'percent',
      discount_value: discountPercentX,
      source: 'milestone',
      milestone_seq: milestoneInfo.milestoneSeq,
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      const duplicateError = new Error('Milestone coupon already exists for this order slot');
      duplicateError.statusCode = 409;
      throw duplicateError;
    }

    throw error;
  }

  return findMilestoneCouponBySeq(connection, milestoneInfo.milestoneSeq);
}

export async function getMilestoneGenerationStatus() {
  await releaseExpiredCouponReservations(pool);
  const settings = await getSettings();
  const paidOrderCount = await countPaidOrders(pool);
  const milestoneInfo = getNextMilestoneInfo(paidOrderCount, settings.orderIntervalN);
  const existing = milestoneInfo
    ? formatCouponRow(await findMilestoneCouponBySeq(pool, milestoneInfo.milestoneSeq))
    : null;

  const activeExisting =
    existing && existing.status !== 'redeemed' ? existing : null;
  const canGenerateMilestone = Boolean(milestoneInfo && !activeExisting);

  let blockedReason = null;

  if (!milestoneInfo) {
    blockedReason = `Milestone coupons can only be created when paid order count is ${formatPreMilestoneCounts(
      settings.orderIntervalN,
    )}, … (one order before each ${formatOrderOrdinal(settings.orderIntervalN)} order).`;
  } else if (activeExisting) {
    blockedReason = `Coupon ${activeExisting.code} already exists for order #${milestoneInfo.nextOrderNumber}. Checkout will use it automatically.`;
  }

  return {
    paidOrderCount,
    settings,
    milestoneInfo,
    existingMilestoneCoupon: activeExisting,
    canGenerateMilestone,
    blockedReason,
  };
}

export async function generateMilestoneCouponAdmin(payload) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const settings = await getCouponSettings(connection);
    const intervalN = Number(settings?.orderIntervalN ?? 0);
    const discountPercentX = Number(settings?.discountPercentX ?? 0);
    const paidOrderCount = await countPaidOrders(connection);
    const milestoneInfo = getNextMilestoneInfo(paidOrderCount, intervalN);

    if (!milestoneInfo) {
      const error = new Error(
        `Cannot generate coupon now. Allowed only when paid orders are ${intervalN - 1}, ${intervalN * 2 - 1}, ${intervalN * 3 - 1}, … (currently ${paidOrderCount}).`,
      );
      error.statusCode = 403;
      throw error;
    }

    const existing = await findMilestoneCouponForUpdate(connection, milestoneInfo.milestoneSeq);

    if (existing && existing.status !== 'redeemed') {
      const error = new Error(
        `Milestone coupon already exists (${existing.code}) for order #${milestoneInfo.nextOrderNumber}.`,
      );
      error.statusCode = 409;
      throw error;
    }

    const created = await createMilestoneCouponRecord(
      connection,
      milestoneInfo,
      discountPercentX,
      payload?.code,
    );

    await connection.commit();
    return formatCouponRow(created);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function reserveCheckoutCoupon(userId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await releaseExpiredCouponReservations(connection);

    const settings = await getCouponSettings(connection);
    const intervalN = Number(settings?.orderIntervalN ?? 0);
    const discountPercentX = Number(settings?.discountPercentX ?? 0);
    const reservationSeconds = Number(settings?.reservationSeconds ?? 60);

    if (intervalN <= 0 || discountPercentX <= 0) {
      await connection.commit();
      return {
        offer: null,
        paidOrderCount: await countPaidOrders(connection),
        settings: {
          orderIntervalN: intervalN,
          discountPercentX,
          reservationSeconds,
        },
      };
    }

    const paidOrderCount = await countPaidOrders(connection);
    const milestoneInfo = getNextMilestoneInfo(paidOrderCount, intervalN);

    if (!milestoneInfo) {
      await connection.commit();
      return {
        offer: null,
        paidOrderCount,
        nextMilestoneOrder: Math.ceil((paidOrderCount + 1) / intervalN) * intervalN,
        settings: {
          orderIntervalN: intervalN,
          discountPercentX,
          reservationSeconds,
        },
      };
    }

    const reloadMilestoneCoupon = () =>
      findMilestoneCouponForUpdate(connection, milestoneInfo.milestoneSeq);

    const settingsPayload = buildSettingsPayload(
      intervalN,
      discountPercentX,
      reservationSeconds,
    );

    let coupon = await reloadMilestoneCoupon();

    if (!coupon) {
      await createMilestoneCouponRecord(connection, milestoneInfo, discountPercentX);
      coupon = await reloadMilestoneCoupon();
    }

    const assignment = await tryAssignMilestoneOffer(
      connection,
      coupon,
      userId,
      reservationSeconds,
      milestoneInfo,
      reloadMilestoneCoupon,
    );

    await connection.commit();

    if (assignment.offer) {
      return {
        offer: assignment.offer,
        paidOrderCount,
        message: `Every ${intervalN} orders unlocks one ${discountPercentX}% coupon. Pay within ${reservationSeconds} seconds to use it.`,
        settings: settingsPayload,
      };
    }

    if (coupon.status === 'redeemed') {
      return {
        offer: null,
        paidOrderCount,
        heldByUserId: null,
        message: 'Milestone coupon has already been used.',
        settings: settingsPayload,
      };
    }

    return {
      offer: null,
      paidOrderCount,
      heldByUserId: assignment.heldByUserId ?? null,
      message: assignment.blocked
        ? 'Milestone coupon is currently held by another shopper. Try again after it expires.'
        : 'Milestone coupon is not available right now.',
      settings: settingsPayload,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function resolveCouponDiscount(connection, userId, couponCode, subtotal) {

  console.log('couponCode', couponCode,userId);
  if (!couponCode) {
    return { discountAmount: 0, appliedCoupon: null, couponId: null };
  }

  const normalizedCode = normalizeCode(couponCode);

  if (!normalizedCode) {
    return { discountAmount: 0, appliedCoupon: null, couponId: null };
  }

  let coupon = await findCouponByCodeForUpdate(connection, normalizedCode);

  if (!coupon) {
    const error = new Error('Invalid coupon code');
    error.statusCode = 400;
    throw error;
  }

  await clearExpiredReservationForCoupon(connection, coupon.id);
  coupon = await findCouponByCodeForUpdate(connection, normalizedCode);

  if (!coupon) {
    const error = new Error('Invalid coupon code');
    error.statusCode = 400;
    throw error;
  }

  if (coupon.status === 'redeemed') {
    const error = new Error('Coupon has already been used');
    error.statusCode = 400;
    throw error;
  }

  if (coupon.source === 'milestone') {
    const holderMatches =
      coupon.status === 'reserved'
      && isSameUserId(coupon.reserved_by_user_id, userId);

    if (holderMatches) {
      let secondsRemaining = await getCouponSecondsRemaining(
        connection,
        coupon.id,
        userId,
      );

      if (secondsRemaining <= 0) {
        secondsRemaining = await getActiveReservedHoldSeconds(connection, coupon.id);
      }

      if (secondsRemaining > 0) {
        const discountAmount = computeDiscount(subtotal, coupon);
        return {
          discountAmount,
          appliedCoupon: coupon.code,
          couponId: coupon.id,
        };
      }

      const error = new Error('Coupon has expired');
      error.statusCode = 409;
      error.conflict = 'coupon_expired';
      throw error;
    }

    if (coupon.status === 'reserved') {
      const error = new Error('Coupon is reserved for another shopper');
      error.statusCode = 409;
      error.conflict = 'coupon_held_by_other';
      throw error;
    }

    const error = new Error('Coupon has expired');
    error.statusCode = 409;
    error.conflict = 'coupon_expired';
    throw error;
  }

  if (isReservationActive(coupon)) {
    if (!isSameUserId(coupon.reserved_by_user_id, userId)) {
      const error = new Error('Coupon is reserved for another shopper');
      error.statusCode = 409;
      throw error;
    }
  }

  const discountAmount = computeDiscount(subtotal, coupon);

  return {
    discountAmount,
    appliedCoupon: coupon.code,
    couponId: coupon.id,
  };
}

export async function markCouponRedeemed(connection, couponId, orderId) {
  if (!couponId) {
    return;
  }

  await redeemCoupon(connection, couponId, orderId);
}
