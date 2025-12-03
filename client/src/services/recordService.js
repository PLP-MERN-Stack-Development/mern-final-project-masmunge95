import api from './api';

export const getRecords = async () => {
  try {
    const response = await api.get('/records');
    return response.data;
  } catch (error) {
    console.error('Error fetching records:', error);
    throw error;
  }
};

export const createRecord = async (formData) => {
  try {
    const response = await api.post('/records', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error creating record:', error);
    throw error;
  }
};

export const deleteRecord = async (recordId) => {
  try {
    const response = await api.delete(`/records/${recordId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting record:', error);
    throw error;
  }
};

export const convertRecordToInvoice = async (recordId, payload = {}) => {
  try {
    const response = await api.post(`/records/${recordId}/convert-to-invoice`, payload);
    return response.data;
  } catch (error) {
    console.error('Error converting record to invoice:', error);
    throw error;
  }
};
