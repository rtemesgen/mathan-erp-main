export { db } from './restStore';
import { getApiErrorMessage } from './api';
import { toast } from 'sonner';
export const auth={currentUser:null as null|{uid:string}};
export enum OperationType {CREATE='create',UPDATE='update',DELETE='delete',LIST='list',GET='get',WRITE='write'}
export function handleApiError(error:unknown,operationType:OperationType,path:string|null){console.error('API error',{error,operationType,path});const message=getApiErrorMessage(error,`Unable to ${operationType} ${path||'the request'}`);toast.error(message);return message;}
