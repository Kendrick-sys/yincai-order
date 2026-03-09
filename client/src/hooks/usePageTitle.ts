import { useEffect } from "react";

const BASE_TITLE = "吟彩销售订单系统";

/**
 * 动态设置页面标题
 * @param subtitle 子标题，为空时仅显示基础标题
 */
export function usePageTitle(subtitle?: string) {
  useEffect(() => {
    document.title = subtitle ? `${subtitle} - ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [subtitle]);
}
