/** Resolve the logged-in artisan MongoDB id from localStorage userInfo. */
export function getArtisanId() {
  try {
    const userInfo = JSON.parse(localStorage.getItem("userInfo") || "null");
    if (!userInfo || typeof userInfo !== "object") return null;

    const id =
      userInfo._id ||
      userInfo.id ||
      userInfo.user?._id ||
      userInfo.user?.id ||
      null;

    return id ? String(id) : null;
  } catch {
    return null;
  }
}
