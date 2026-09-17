const WELCOME_POPUP_COUPON_MARKER = "[WELCOME_POPUP]";

export function isWelcomePopupCoupon(description?: string | null) {
  return description?.includes(WELCOME_POPUP_COUPON_MARKER) ?? false;
}

export function stripWelcomePopupCouponMarker(description?: string | null) {
  if (!description) {
    return "";
  }

  return description
    .replace(WELCOME_POPUP_COUPON_MARKER, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function buildCouponDescription(description: string, welcomePopupEnabled: boolean) {
  const cleanDescription = stripWelcomePopupCouponMarker(description);

  if (!welcomePopupEnabled) {
    return cleanDescription || null;
  }

  return cleanDescription ? `${WELCOME_POPUP_COUPON_MARKER} ${cleanDescription}` : WELCOME_POPUP_COUPON_MARKER;
}

export function getWelcomePopupCouponMarker() {
  return WELCOME_POPUP_COUPON_MARKER;
}
