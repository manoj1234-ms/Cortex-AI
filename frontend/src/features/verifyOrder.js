import api from '../utils/axios';

export const verifyOrder = async (payload) => {
   try {
    const {data} = await api.post("/api/billing/verify", payload);
    console.log(data)
    return data

   } catch (error) {
    console.error("Unable to verify order from frontend:", error)
    throw error
   }
};
