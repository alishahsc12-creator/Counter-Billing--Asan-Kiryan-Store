export function formatRs(amount: number | string | null | undefined, showDecimalsIfNeeded = true): string {
  const num = Number(amount ?? 0);
  if (!Number.isFinite(num)) return 'Rs. 0';
  const rounded = Math.round(num * 100) / 100;
  const hasDecimals = Math.abs(rounded % 1) > 0.001;
  const formatted = rounded.toLocaleString('en-PK', {
    minimumFractionDigits: hasDecimals && showDecimalsIfNeeded ? 2 : 0,
    maximumFractionDigits: showDecimalsIfNeeded ? 2 : 0,
  });
  return `Rs. ${formatted}`;
}

export function formatQty(qty: number, unit?: string): string {
  const num = Math.round(Number(qty || 0) * 1000) / 1000;
  const str = Number.isInteger(num) ? num.toString() : num.toFixed(3).replace(/\.?0+$/, '');
  return unit ? `${str} ${unit}` : str;
}

export function getLocalDateStr(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalTimeStr(date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function getOffsetDateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return getLocalDateStr(d);
}

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDisplayDateTime(isoOrDate: string, timeStr?: string): string {
  if (timeStr && isoOrDate.length === 10) {
    return `${formatDisplayDate(isoOrDate)} · ${timeStr.slice(0, 5)}`;
  }
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return isoOrDate;
  return d.toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function sanitizeMobileForWhatsApp(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    return `92${digits.slice(1)}`;
  }
  if (digits.startsWith('92')) {
    return digits;
  }
  return `92${digits}`;
}

export async function compressProductImage(file: File): Promise<string> {
  const looksLikeImage =
    file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i.test(file.name);
  if (!looksLikeImage) {
    throw new Error('Please select a valid image file (PNG, JPG, WebP, or GIF).');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Image file is too large. Maximum allowed size is 8 MB.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl) {
        reject(new Error('Empty image file.'));
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid or unsupported image file.'));
      img.onload = () => {
        const MAX_DIM = 400;
        let width = img.width || MAX_DIM;
        let height = img.height || MAX_DIM;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width >= height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.85);
        resolve(compressed);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
