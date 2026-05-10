import { api } from './api';

export interface PostValidationBody {
  validation_type: 'confirm' | 'dispute';
}

export const postValidation = async (contributionId: string | number, body: PostValidationBody) => {
  const res = await api.post(`/api/contributions/${contributionId}/validate`, body);
  return res.data;
};
