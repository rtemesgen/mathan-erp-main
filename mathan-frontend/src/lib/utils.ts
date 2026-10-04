import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getApiErrorMessage } from './api';
import { toast } from 'sonner';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface ApiErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleApiError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: ApiErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null, // We'll handle auth manually for PIN system or server authentication if needed
    },
    operationType,
    path
  };
  console.error('API Error: ', JSON.stringify(errInfo));
  const message = getApiErrorMessage(error, `Unable to ${operationType} ${path || 'the request'}`);
  toast.error(message);
  return message;
}
