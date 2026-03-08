export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * 返回登录页 URL（自建账号密码登录）
 * 支持 returnTo 参数，登录后跳回原页面
 */
export const getLoginUrl = (returnTo?: string) => {
  const base = "/login";
  if (returnTo && returnTo !== "/" && returnTo !== base) {
    return `${base}?returnTo=${encodeURIComponent(returnTo)}`;
  }
  return base;
};
