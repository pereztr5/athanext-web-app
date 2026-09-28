import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  contentClassName?: string;
}

export const ConfirmationDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  contentClassName,
}: ConfirmationDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={cn('max-w-[480px] gap-0 p-0 font-sans tracking-[-0.03em] text-[#1A202C]', contentClassName)}
      >
        <AlertDialogHeader className="space-y-2.5 px-[25px] pb-5 pt-[30px] text-left">
          <AlertDialogTitle className="text-[20px] font-medium leading-[24px] tracking-[-0.05em] text-[#1A202C]">
            {title}
          </AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#484D56]">
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <div className="h-px bg-[#EAEADF]" />
        <AlertDialogFooter className="gap-[10px] px-[25px] py-5 sm:space-x-0">
          <AlertDialogCancel className="mt-0 sm:mt-0">{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmationDialog;
