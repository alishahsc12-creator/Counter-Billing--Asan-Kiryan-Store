import { useEffect, useState } from 'react';
import { ImageOff, Package } from 'lucide-react';

interface ProductThumbProps {
  name: string;
  imageData?: string;
  category?: string;
  size?: 'sm' | 'md' | 'lg' | 'card';
}

export function ProductThumb({ name, imageData, category, size = 'md' }: ProductThumbProps) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [imageData]);

  const trimmed = (imageData ?? '').trim();
  const hasValidSrc =
    trimmed.length > 0 &&
    !imgFailed &&
    (trimmed.startsWith('data:image/') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('/'));

  const sizeClass =
    size === 'sm'
      ? 'w-9 h-9 rounded-md'
      : size === 'lg'
        ? 'w-20 h-20 rounded-xl'
        : size === 'card'
          ? 'w-full h-24 rounded-lg'
          : 'w-11 h-11 rounded-lg';

  const iconSizeClass =
    size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-7 h-7' : size === 'card' ? 'w-7 h-7' : 'w-5 h-5';

  if (hasValidSrc) {
    return (
      <div
        className={`${sizeClass} shrink-0 overflow-hidden border border-slate-200 dark:border-slate-700 bg-white flex items-center justify-center p-1`}
      >
        <img
          src={trimmed}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      title={category ? `${name} (${category})` : name}
      className={`${sizeClass} shrink-0 flex flex-col items-center justify-center gap-1 border border-dashed border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/70 text-slate-400 dark:text-slate-500 select-none`}
    >
      {imgFailed ? <ImageOff className={iconSizeClass} /> : <Package className={iconSizeClass} />}
      {size === 'card' && <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">No Image</span>}
    </div>
  );
}
