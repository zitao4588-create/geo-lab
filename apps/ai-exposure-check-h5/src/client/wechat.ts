const WECHAT_JSSDK_SRC = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js';

interface WechatConfigResponse {
  appId: string;
  timestamp: number;
  nonceStr: string;
  signature: string;
  jsApiList: string[];
}
interface WechatShareData {
  title: string;
  desc: string;
  link: string;
  imgUrl: string;
}

interface WechatSdk {
  config(options: WechatConfigResponse & { debug: boolean }): void;
  ready(callback: () => void): void;
  error(callback: (error: unknown) => void): void;
  updateAppMessageShareData(options: WechatShareData): void;
  updateTimelineShareData(options: WechatShareData): void;
}

declare global {
  interface Window { wx?: WechatSdk }
}

let sdkPromise: Promise<WechatSdk> | null = null;

export function isWechatBrowser() {
  return /MicroMessenger/iu.test(window.navigator.userAgent);
}

export async function configureWechatShare(data: WechatShareData) {
  if (!isWechatBrowser()) return { configured: false, reason: 'not_wechat' } as const;
  try {
    const signedUrl = window.location.href.split('#')[0] || window.location.href;
    const response = await fetch(`/api/wechat/jssdk-config?url=${encodeURIComponent(signedUrl)}`);
    if (!response.ok) return { configured: false, reason: 'server_unavailable' } as const;
    const config = await response.json() as WechatConfigResponse;
    const wx = await loadWechatSdk();
    wx.config({ debug: false, ...config });
    wx.ready(() => {
      wx.updateAppMessageShareData(data);
      wx.updateTimelineShareData(data);
    });
    wx.error(() => {
      /* 分享配置失败时保留复制链接与右上角分享引导 */
    });
    return { configured: true } as const;
  } catch {
    return { configured: false, reason: 'sdk_error' } as const;
  }
}

function loadWechatSdk() {
  if (window.wx) return Promise.resolve(window.wx);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<WechatSdk>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${WECHAT_JSSDK_SRC}"]`);
    const script = existing ?? document.createElement('script');
    const handleLoad = () => window.wx ? resolve(window.wx) : reject(new Error('wechat_sdk_missing'));
    const handleError = () => reject(new Error('wechat_sdk_load_failed'));
    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    if (!existing) {
      script.src = WECHAT_JSSDK_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return sdkPromise;
}
