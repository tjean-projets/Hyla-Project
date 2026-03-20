import { cn } from '@/lib/utils';

interface HylaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const iconSizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg', xl: 'h-20 w-20 text-2xl' };

export function TjcLogo({ size = 'md', className }: HylaLogoProps) {
  return (
    <div className={cn('rounded-lg bg-gradient-to-br from-[#1e3a5f] to-[#2c5282] flex items-center justify-center', iconSizes[size], className)}>
      <span className="text-white font-bold">H</span>
    </div>
  );
}
