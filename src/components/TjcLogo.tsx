import { cn } from '@/lib/utils';

interface TjcLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm:  { width: 40,  height: 20 },
  md:  { width: 90,  height: 45 },
  lg:  { width: 160, height: 80 },
  xl:  { width: 220, height: 110 },
};

export function TjcLogo({ size = 'md', showText: _showText, className }: TjcLogoProps) {
  const { width, height } = sizes[size];

  return (
    <img
      src="/LOGO BLANC.jpg"
      alt="Thomas Jean Courtage"
      width={width}
      height={height}
      className={cn('object-contain', className)}
    />
  );
}
