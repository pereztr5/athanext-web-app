/**
 * DeleteConfirmationDialog Component
 * Reusable confirmation dialog for delete actions
 */

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
import type { ReactNode } from 'react';

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
}

export const DeleteConfirmationDialog = ({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
}: DeleteConfirmationDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[480px] gap-0 p-0 font-sans tracking-[-0.03em] text-[#1A202C]">
        <AlertDialogHeader className="space-y-2.5 px-[25px] pb-5 pt-[30px] text-left">
          <AlertDialogTitle className="text-[20px] font-medium leading-[24px] tracking-[-0.05em] text-[#1A202C]">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#484D56]">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="h-px bg-[#EAEADF]" />
        <AlertDialogFooter className="gap-[10px] px-[25px] py-5 sm:space-x-0">
          <AlertDialogCancel className="mt-0 sm:mt-0">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
