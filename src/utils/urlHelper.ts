/**
 * URL Helper for Rung Chuông Vàng - Trường THPT 25-10
 * Computes direct, unauthenticated public join URLs so students scanning QR codes
 * can immediately access the contestant view without requiring any Google login.
 */

export function getPublicOrigin(): string {
  // 1. User custom domain in localStorage
  try {
    const customDomain = localStorage.getItem('rcv_custom_domain');
    if (customDomain && customDomain.trim()) {
      let domain = customDomain.trim();
      if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
        domain = `https://${domain}`;
      }
      return domain.replace(/\/+$/, '');
    }
  } catch (e) {}

  // 2. In browser environment: detect AI Studio preview / public URL or current origin
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;

    // In AI Studio development environment, 'ais-dev-*' is internal dev host.
    // The public unauthenticated URL for students scanning QR on phones is 'ais-pre-*'.
    if (origin.includes('ais-dev-')) {
      const preOrigin = origin.replace('ais-dev-', 'ais-pre-');
      return preOrigin;
    }

    if (origin && origin !== 'null' && !origin.startsWith('file:')) {
      return origin;
    }
  }

  return 'https://rung-chuong-vang-thpt-25-10.web.app';
}

export function getDynamicJoinUrl(roomCode: string = 'RCV2510'): string {
  const cleanCode = (roomCode || 'RCV2510').trim().toUpperCase();
  const origin = getPublicOrigin();
  // Using query param and hash-friendly format compatible with all mobile browsers
  return `${origin}/join?room=${encodeURIComponent(cleanCode)}`;
}

export async function verifyAndResolveJoinUrl(
  roomCode: string = 'RCV2510',
  forceRecheck: boolean = false
): Promise<{
  joinUrl: string;
  isPre404: boolean;
  preUrl: string;
  devUrl: string;
  isCustom: boolean;
}> {
  const cleanCode = (roomCode || 'RCV2510').trim().toUpperCase();
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const isDevHost = currentOrigin.includes('ais-dev-');

  let preOrigin = isDevHost ? currentOrigin.replace('ais-dev-', 'ais-pre-') : currentOrigin;
  let devOrigin = isDevHost ? currentOrigin : '';

  let customOrigin = '';
  try {
    customOrigin = (localStorage.getItem('rcv_custom_domain') || '').trim();
    if (customOrigin && !customOrigin.startsWith('http')) {
      customOrigin = `https://${customOrigin}`;
    }
    customOrigin = customOrigin.replace(/\/+$/, '');
  } catch (e) {}

  const isCustom = Boolean(customOrigin);
  const finalOrigin = customOrigin || (isDevHost ? preOrigin : currentOrigin) || getPublicOrigin();

  const preUrl = `${preOrigin}/join?room=${encodeURIComponent(cleanCode)}`;
  const devUrl = devOrigin ? `${devOrigin}/join?room=${encodeURIComponent(cleanCode)}` : preUrl;
  const joinUrl = `${finalOrigin}/join?room=${encodeURIComponent(cleanCode)}`;

  let isPre404 = false;

  // If in AI Studio dev mode and not using custom domain, check if pre origin is live
  if (isDevHost && !isCustom && (forceRecheck || typeof window !== 'undefined')) {
    try {
      const checkRes = await fetch(`/api/check-public-url?url=${encodeURIComponent(preOrigin)}`);
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.status === 404 || checkData.reachable === false) {
          isPre404 = true;
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    joinUrl: isPre404 ? devUrl : joinUrl,
    isPre404,
    preUrl,
    devUrl,
    isCustom,
  };
}

export function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return Promise.resolve(successful);
  } catch (err) {
    return Promise.resolve(false);
  }
}
