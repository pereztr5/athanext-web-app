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
import { buttonVariants } from '@/components/ui/button';
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
      <AlertDialogContent className="max-w-[480px] gap-0 p-0 font-sans text-dark">
        <AlertDialogHeader className="space-y-2.5 px-[25px] pb-5 pt-[30px] text-left">
          <AlertDialogTitle className="text-card-title text-dark">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-paragraph text-dark-300">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="h-px bg-light-525" />
        <AlertDialogFooter className="gap-[10px] px-[25px] py-5 sm:space-x-0">
          <AlertDialogCancel className="mt-0 sm:mt-0">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={buttonVariants({ variant: "destructive" })}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
