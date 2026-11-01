import React from 'react';
import Modal from './Modal';
import Button from './Button';
import { AlertTriangle } from 'lucide-react';

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex items-start gap-4 mb-6">
        <div className={`p-3 rounded-full ${isDanger ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
          <AlertTriangle size={24} />
        </div>
        <div>
          <p className="text-sm text-[#77716B] leading-relaxed">{message}</p>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-[#1E1B18]/10">
        <Button variant="outline" size="sm" onClick={onClose}>
          {cancelText}
        </Button>
        <Button
          variant={isDanger ? 'danger' : 'primary'}
          size="sm"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
